#!/usr/bin/env python3
"""In-use overlay for disk-wizard candidates (open fds, kubectl, hf pid)."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

HF_PROC_NAMES = frozenset({"hf", "huggingface-cli", "huggingface_hub"})


def load_open_paths(
    mock_path: str | None = None,
    *,
    env: dict[str, str] | None = None,
) -> set[str]:
    """Load realpaths of open files.

    When ``LAB_MOCK_OPEN_FILES`` is set (including empty), /proc is not scanned
    so hermetic tests stay deterministic.

    Args:
        mock_path: Optional file with one path per line.
        env: Environment override.

    Returns:
        Set of realpaths.
    """
    src = env if env is not None else dict(os.environ)
    path = mock_path or src.get("LAB_MOCK_OPEN_FILES")
    if path is not None:
        if path == "" or not os.path.isfile(path):
            return set()
        out: set[str] = set()
        for line in Path(path).read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                out.add(os.path.realpath(line) if not line.startswith(("docker://", "crictl://")) else line)
        return out
    return _scan_proc_fds()


def _scan_proc_fds() -> set[str]:
    """Read /proc/*/fd and /proc/*/maps (Linux). Empty on macOS or errors.

    Returns:
        Open realpaths.
    """
    proc = Path("/proc")
    if not proc.is_dir():
        return set()
    found: set[str] = set()
    try:
        pids = list(proc.iterdir())
    except OSError:
        return set()
    for pid_dir in pids:
        if not pid_dir.name.isdigit():
            continue
        fd_dir = pid_dir / "fd"
        try:
            for fd in fd_dir.iterdir():
                try:
                    target = os.readlink(fd)
                except OSError:
                    continue
                if target.startswith("/"):
                    found.add(os.path.realpath(target) if os.path.exists(target) else target)
        except OSError:
            pass
        maps = pid_dir / "maps"
        try:
            text = maps.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for line in text.splitlines():
            # "addr perms offset dev inode pathname"
            parts = line.split()
            if len(parts) >= 6 and parts[-1].startswith("/"):
                found.add(parts[-1])
    return found


def load_hostpath_mounts(
    pods_json: str | None = None,
    *,
    env: dict[str, str] | None = None,
) -> list[str]:
    """hostPath paths from a kubectl pods JSON blob.

    Args:
        pods_json: Raw JSON or path. Default ``LAB_MOCK_PODS_JSON``.
        env: Environment override.

    Returns:
        Host paths (may be relative to /mnt/models).
    """
    src = env if env is not None else dict(os.environ)
    raw = pods_json if pods_json is not None else src.get("LAB_MOCK_PODS_JSON", "")
    if not raw:
        return []
    text = raw
    if os.path.isfile(raw):
        text = Path(raw).read_text(encoding="utf-8")
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    mounts: list[str] = []
    items = data.get("items") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return []
    for pod in items:
        if not isinstance(pod, dict):
            continue
        spec = pod.get("spec") or {}
        for vol in spec.get("volumes") or []:
            hp = vol.get("hostPath") if isinstance(vol, dict) else None
            if isinstance(hp, dict) and hp.get("path"):
                mounts.append(str(hp["path"]))
    return mounts


def _hf_proc_running(proc_root: str = "/proc") -> bool:
    """True when an hf / huggingface-cli process is visible under proc_root.

    Args:
        proc_root: ``/proc`` or a fake tree for tests.

    Returns:
        Whether a Hugging Face download helper is running.
    """
    root = Path(proc_root)
    if not root.is_dir():
        return False
    try:
        pids = list(root.iterdir())
    except OSError:
        return False
    for pid_dir in pids:
        if not pid_dir.name.isdigit():
            continue
        comm = ""
        try:
            comm = (pid_dir / "comm").read_text(encoding="utf-8", errors="replace").strip()
        except OSError:
            comm = ""
        if comm in HF_PROC_NAMES:
            return True
        try:
            raw = (pid_dir / "cmdline").read_bytes()
        except OSError:
            continue
        cmd = raw.replace(b"\x00", b" ").decode("utf-8", errors="replace")
        low = cmd.lower()
        if "huggingface-cli" in low or "huggingface_hub" in low:
            return True
        first = cmd.split()[0] if cmd.split() else ""
        if os.path.basename(first) in HF_PROC_NAMES:
            return True
    return False


def hf_pid_present(*, env: dict[str, str] | None = None, proc_root: str | None = None) -> bool:
    """True when an hf download pidfile exists, mock says so, or hf is in /proc.

    Hermetic tests set ``LAB_HERMETIC=1`` or ``LAB_MOCK_HF_PID`` and never scan
    the real ``/proc`` (a developer laptop may have an unrelated ``hf``).

    Args:
        env: Environment override.
        proc_root: Optional fake ``/proc`` (unit tests).

    Returns:
        Whether apply should refuse HF junk.
    """
    src = env if env is not None else dict(os.environ)
    if src.get("LAB_MOCK_HF_PID") == "1":
        return True
    models = src.get("MODELS_DIR") or "/mnt/models"
    if os.path.isfile(os.path.join(models, ".hf-download.pid")):
        return True
    if proc_root is not None:
        return _hf_proc_running(proc_root)
    if src.get("LAB_HERMETIC") == "1" or "LAB_MOCK_HF_PID" in src:
        return False
    return _hf_proc_running("/proc")


def _path_is_open(path: str, open_paths: set[str]) -> bool:
    """True if path equals or contains an open file, or is a prefix of one.

    Args:
        path: Candidate.
        open_paths: Open realpaths.

    Returns:
        Whether the path is in use via fd/mmap.
    """
    if path.startswith(("docker://", "crictl://")):
        return path in open_paths
    try:
        real = os.path.realpath(path)
    except OSError:
        real = path
    if real in open_paths:
        return True
    prefix = real.rstrip("/") + "/"
    for opened in open_paths:
        if opened == real or opened.startswith(prefix) or real.startswith(opened.rstrip("/") + "/"):
            return True
    return False


def apply_overlay(
    rows: list[dict[str, Any]],
    *,
    open_paths: set[str] | None = None,
    hostpath_mounts: list[str] | None = None,
    hf_pid: bool = False,
    running_images: set[str] | None = None,
    visual_running: bool = False,
    mode_c_running: bool = False,
    flash_next_running: bool = False,
) -> list[dict[str, Any]]:
    """Promote in-use / refused candidates to dangerous / reclaim none.

    Args:
        rows: Classified candidates (mutated copies).
        open_paths: Open file realpaths.
        hostpath_mounts: Pod hostPath values.
        hf_pid: Hugging Face download running.
        running_images: containerd/docker image ids in use.
        visual_running: A workload:visual Deployment is up.
        mode_c_running: DeepSeek Mode C Job is up.
        flash_next_running: Flash-Next Job is up.

    Returns:
        New list with overlay fields.
    """
    opened = open_paths or set()
    mounts = [os.path.realpath(m) if not m.startswith(("docker://", "crictl://")) else m for m in (hostpath_mounts or [])]
    images = running_images or set()
    out: list[dict[str, Any]] = []
    for raw in rows:
        row = dict(raw)
        reasons: list[str] = list(row.get("in_use_reasons") or [])
        path = str(row.get("path") or "")
        refuse = [str(x) for x in (row.get("refuse_if") or [])]
        if hf_pid and "hf_pid" in refuse:
            reasons.append("hf download running")
        if _path_is_open(path, opened):
            reasons.append("open file descriptor or mmap")
        if path.startswith(("docker://", "crictl://")):
            ident = path.split("/")[-1]
            if ident in images or any(ident in img or img in path for img in images):
                reasons.append("image in use by a running container")
            if "image_in_use" in refuse and images:
                if ident in images or any(x in path for x in images):
                    reasons.append("image_in_use")
        else:
            try:
                real = os.path.realpath(path)
            except OSError:
                real = path
            for mount in mounts:
                if real == mount or real.startswith(mount.rstrip("/") + "/") or mount.startswith(real.rstrip("/") + "/"):
                    reasons.append(f"pod hostPath {mount}")
                    break
        sid = str(row.get("id") or "")
        if visual_running and sid in {"comfy-outputs-media", "dangling-symlink"}:
            reasons.append("visual Comfy Deployment running")
        if mode_c_running and ("dsv41-engram" in path or sid == "dsv41-engram"):
            reasons.append("Mode C Job running")
        if flash_next_running and sid == "ple-mmap":
            reasons.append("Flash-Next Job running")
        if reasons:
            row["in_use"] = True
            row["in_use_reasons"] = reasons
            row["risk"] = "dangerous"
            row["reclaim"] = "none"
            row["step"] = "C"
            row["needs_confirm"] = False
            extra = " In use: " + "; ".join(reasons) + "."
            why = str(row.get("why") or "")
            if extra.strip() not in why:
                row["why"] = (why + extra).strip()
        out.append(row)
    return out


def _cli() -> int:
    """Read classified JSON array on stdin; write overlayed array on stdout.

    Returns:
        Process status.
    """
    import sys

    raw = sys.stdin.read()
    if not raw.strip():
        print("[]")
        return 0
    rows = json.loads(raw)
    if not isinstance(rows, list):
        print("[]")
        return 0
    images: set[str] = set()
    extra = os.environ.get("LAB_MOCK_CRICTL_IN_USE", "")
    if extra:
        if os.path.isfile(extra):
            extra = Path(extra).read_text(encoding="utf-8")
        for line in extra.splitlines():
            line = line.strip()
            if line:
                images.add(line)
    overlayed = apply_overlay(
        rows,
        open_paths=load_open_paths(),
        hostpath_mounts=load_hostpath_mounts(),
        hf_pid=hf_pid_present(),
        running_images=images,
        visual_running=os.environ.get("LAB_MOCK_VISUAL", "0") == "1",
        mode_c_running=os.environ.get("LAB_MOCK_MODE_C", "0") == "1",
        flash_next_running=os.environ.get("LAB_MOCK_FLASH_NEXT", "0") == "1",
    )
    json.dump(overlayed, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli())

