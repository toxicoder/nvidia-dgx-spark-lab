#!/usr/bin/env python3
"""Restricted YAML loader + classifier for config/disk-catalog.yaml."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections.abc import Iterator, Mapping, Sequence
from pathlib import Path
from typing import Any, TypedDict

# Restricted YAML keys (keep skip names in sync with scripts/lib/disk_scan.sh).
_LIST_KEYS = (
    "match_suffix",
    "match_contains",
    "match_basename",
    "match_prefix",
    "roots",
    "refuse_if",
    "prefixes",
    "basenames",
)
_BOOL_KEYS = ("match_broken_symlink", "match_refuse", "match_keep_set")
_INT_KEYS = ("leftover_weight",)
_STR_KEYS = (
    "risk",
    "reclaim",
    "what",
    "why",
    "leftover_when",
    "docker_type",
    "educate",
    "redownload_hint",
)
RISK_PENALTY = {"safe": 1, "review": 4, "dangerous": 100}
VALID_RISK = frozenset(RISK_PENALTY)
VALID_RECLAIM = frozenset({"delete", "quarantine", "docker-prune", "none"})
SKIP_DIR_NAMES = frozenset(
    {
        ".git",
        "node_modules",
        "__pycache__",
        ".venv",
        "venv",
        ".tox",
        ".disk-quarantine",
        ".reap-quarantine",
    }
)
SKIP_BASENAMES = frozenset(
    {
        ".disk-wizard-plan.json",
        ".disk-wizard.log",
    }
)
WALK_PROGRESS_EVERY = 500
INCOMPLETE_SAFE_SUFFIXES = (".incomplete", ".lock")


class CatalogSignature(TypedDict):
    """One disk-catalog signature row."""

    risk: str
    reclaim: str
    leftover_weight: int
    what: str
    why: str
    leftover_when: str
    docker_type: str
    educate: str
    redownload_hint: str
    match_broken_symlink: bool
    match_refuse: bool
    match_keep_set: bool
    match_suffix: list[str]
    match_contains: list[str]
    match_basename: list[str]
    match_prefix: list[str]
    roots: list[str]
    refuse_if: list[str]


class DiskCatalog(TypedDict):
    """Parsed config/disk-catalog.yaml."""

    schema: int
    keep_prefixes: list[str]
    keep_basenames: list[str]
    signatures: dict[str, CatalogSignature]


def _empty_sig() -> CatalogSignature:
    """Default signature fields.

    Returns:
        Mutable signature mapping.
    """
    return {
        "risk": "review",
        "reclaim": "none",
        "leftover_weight": 0,
        "what": "",
        "why": "",
        "leftover_when": "",
        "docker_type": "",
        "educate": "",
        "redownload_hint": "",
        "match_broken_symlink": False,
        "match_refuse": False,
        "match_keep_set": False,
        "match_suffix": [],
        "match_contains": [],
        "match_basename": [],
        "match_prefix": [],
        "roots": [],
        "refuse_if": [],
    }


def load_catalog(path: Path) -> DiskCatalog:
    """Parse the restricted disk-catalog YAML subset.

    Args:
        path: Catalog file.

    Returns:
        Mapping with schema, keep-set, and signatures.

    Raises:
        ValueError: Invalid risk or reclaim.
    """
    text = path.read_text(encoding="utf-8")
    signatures: dict[str, CatalogSignature] = {}
    keep_prefixes: list[str] = []
    keep_basenames: list[str] = []
    section = ""
    sig = ""
    list_key = ""
    schema = 1
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        if line.startswith("schema:"):
            schema = int(line.split(":", 1)[1].strip())
            continue
        if line == "keep_set:":
            section = "keep_set"
            sig = ""
            list_key = ""
            continue
        if line == "signatures:":
            section = "signatures"
            sig = ""
            list_key = ""
            continue
        if section == "keep_set":
            stripped = line.strip()
            if stripped.endswith(":") and stripped[:-1] in ("prefixes", "basenames"):
                list_key = stripped[:-1]
                continue
            if list_key and stripped.startswith("- "):
                item = stripped[2:].strip().strip('"').strip("'")
                if list_key == "prefixes":
                    keep_prefixes.append(item)
                else:
                    keep_basenames.append(item)
            continue
        if section != "signatures":
            continue
        if line.startswith("  ") and not line.startswith("    ") and line.strip().endswith(":"):
            sig = line.strip()[:-1]
            signatures[sig] = _empty_sig()
            list_key = ""
            continue
        if not sig:
            continue
        stripped = line.strip()
        if stripped.endswith(":") and stripped[:-1] in _LIST_KEYS:
            list_key = stripped[:-1]
            continue
        if list_key and stripped.startswith("- "):
            signatures[sig][list_key].append(  # type: ignore[literal-required]
                stripped[2:].strip().strip('"').strip("'")
            )
            continue
        if ":" in stripped and not stripped.startswith("- "):
            list_key = ""
            key, val = stripped.split(":", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key in _BOOL_KEYS:
                signatures[sig][key] = val.lower() == "true"  # type: ignore[literal-required]
            elif key in _INT_KEYS:
                signatures[sig][key] = int(val or "0")  # type: ignore[literal-required]
            elif key in _STR_KEYS:
                signatures[sig][key] = val  # type: ignore[literal-required]
    for sid, row in signatures.items():
        if row["risk"] not in VALID_RISK:
            raise ValueError(f"{sid}: bad risk {row['risk']!r}")
        if row["reclaim"] not in VALID_RECLAIM:
            raise ValueError(f"{sid}: bad reclaim {row['reclaim']!r}")
    return {
        "schema": schema,
        "keep_prefixes": keep_prefixes,
        "keep_basenames": keep_basenames,
        "signatures": signatures,
    }


def expand_roots(env: dict[str, str] | None = None) -> dict[str, str]:
    """Resolve catalog root tokens to absolute directories.

    Args:
        env: Override environment. Default os.environ.

    Returns:
        Token → path.
    """
    src = env if env is not None else dict(os.environ)
    home = src.get("DISK_WIZARD_HOME") or src.get("HOME") or str(Path.home())
    models = src.get("MODELS_DIR") or "/mnt/models"
    mapping = {
        "MODELS_DIR": models,
        "HOME_CACHE": str(Path(home) / ".cache"),
        "HOME_HF": str(Path(home) / ".cache" / "huggingface"),
        "HOME_OLLAMA": str(Path(home) / ".ollama"),
        "TMP": "/tmp",
        "VAR_TMP": "/var/tmp",
        "ROOT_GLOB": src.get("DISK_WIZARD_ROOT_GLOB_BASE") or "/",
    }
    return {key: os.path.realpath(val) for key, val in mapping.items()}


def rank_score(size_bytes: int, leftover_weight: int, risk: str) -> float:
    """Size × leftover weight / risk penalty.

    Args:
        size_bytes: File or object size.
        leftover_weight: Catalog weight.
        risk: safe|review|dangerous.

    Returns:
        Rank score (higher = show first).
    """
    penalty = RISK_PENALTY.get(risk, 4)
    if penalty <= 0:
        penalty = 4
    return (max(int(size_bytes), 0) * max(int(leftover_weight), 0)) / float(penalty)


def is_keep_set(path: str, catalog: DiskCatalog) -> bool:
    """True when path matches keep-set prefixes or basenames.

    Incomplete/lock files inside a keep-set tree are not keep-set (they are junk).

    Args:
        path: Absolute or synthetic path.
        catalog: Loaded catalog.

    Returns:
        Whether this is a documented lab weight.
    """
    base = os.path.basename(path)
    if base.endswith(INCOMPLETE_SAFE_SUFFIXES):
        return False
    if base in catalog["keep_basenames"]:
        return True
    for prefix in catalog["keep_prefixes"]:
        if prefix and prefix in path:
            return True
    return False


def path_under_roots(path: str, roots: list[str]) -> bool:
    """True when realpath(path) is equal to or under one allowed root.

    Args:
        path: Candidate path (docker:// always False).
        roots: Allowed absolute roots.

    Returns:
        Whether the path is jailed.
    """
    if path.startswith("docker://") or path.startswith("crictl://"):
        return False
    try:
        real = os.path.realpath(path)
    except OSError:
        return False
    for root in roots:
        if not root:
            continue
        rr = os.path.realpath(root)
        if real == rr or real.startswith(rr + os.sep):
            return True
    return False


def _path_matches(path: str, sig: Mapping[str, Any], keep: bool) -> bool:
    """True when a signature applies to path.

    Args:
        path: Absolute path or docker:// id.
        sig: Signature mapping.
        keep: Whether path is keep-set.

    Returns:
        Whether this signature matches.
    """
    base = os.path.basename(path)
    if sig.get("match_keep_set") and keep:
        return True
    if sig.get("match_broken_symlink"):
        return os.path.islink(path) and not os.path.exists(path)
    for suf in sig.get("match_suffix") or []:
        if path.endswith(suf) or base.endswith(suf):
            return True
    for pre in sig.get("match_prefix") or []:
        if base.startswith(pre):
            return True
    for name in sig.get("match_basename") or []:
        if base == name:
            return True
    for needle in sig.get("match_contains") or []:
        if needle in path:
            return True
    docker_type = str(sig.get("docker_type") or "")
    if docker_type and (path.startswith("docker://") or path.startswith("crictl://")):
        ntype = normalize_runtime_type(docker_type)
        body = path.split("://", 1)[-1]
        if ntype in path or docker_type in path:
            return True
        if body.startswith(ntype + "/") or body.startswith(docker_type + "/"):
            return True
    return False


def _candidate(
    sid: str, path: str, size_bytes: int, sig: Mapping[str, Any]
) -> dict[str, Any]:
    """Build a rankable candidate dict.

    Args:
        sid: Signature id.
        path: Path or docker id.
        size_bytes: Size.
        sig: Signature fields.

    Returns:
        JSON-ready mapping.
    """
    risk = str(sig.get("risk") or "review")
    weight = int(sig.get("leftover_weight") or 0)
    step = "A" if risk == "safe" else ("C" if risk == "dangerous" else "B")
    return {
        "id": sid,
        "path": path,
        "size_bytes": int(size_bytes),
        "risk": risk,
        "reclaim": sig.get("reclaim") or "none",
        "what": sig.get("what") or "",
        "why": sig.get("why") or "",
        "leftover_when": sig.get("leftover_when") or "",
        "educate": sig.get("educate") or "",
        "redownload_hint": sig.get("redownload_hint") or "",
        "docker_type": sig.get("docker_type") or "",
        "refuse_if": list(sig.get("refuse_if") or []),
        "score": rank_score(size_bytes, weight, risk),
        "step": step,
        "in_use": False,
        "in_use_reasons": [],
        "needs_confirm": risk == "review",
    }


def classify_path(
    path: str,
    catalog: DiskCatalog,
    *,
    size_bytes: int = 0,
    broken_symlink: bool | None = None,
) -> dict[str, Any]:
    """Classify one path against signatures (keep-set first, then file order).

    Args:
        path: Absolute path or docker:// / crictl:// synthetic id.
        catalog: Loaded catalog.
        size_bytes: Size for scoring.
        broken_symlink: Optional override (tests).

    Returns:
        Candidate mapping (id may be ``unknown-large``).
    """
    keep = is_keep_set(path, catalog)
    if broken_symlink is None and not path.startswith(("docker://", "crictl://")):
        broken_symlink = os.path.islink(path) and not os.path.exists(path)
    row: dict[str, Any]
    if keep:
        sig = catalog["signatures"].get("keep-set-weight") or _empty_sig()
        row = _candidate("keep-set-weight", path, size_bytes, sig)
    else:
        row = {}
        for sid, sig in catalog["signatures"].items():
            if sid == "keep-set-weight":
                continue
            if broken_symlink and sid == "dangling-symlink":
                row = _candidate(sid, path, size_bytes, sig)
                break
            if sid == "dangling-symlink" and not broken_symlink:
                continue
            if _path_matches(path, sig, keep):
                row = _candidate(sid, path, size_bytes, sig)
                break
        if not row:
            unknown = _empty_sig()
            unknown["what"] = "Unclassified path"
            unknown["why"] = "No catalog signature matched"
            unknown["leftover_when"] = "manual review"
            unknown["risk"] = "review"
            unknown["reclaim"] = "none"
            unknown["leftover_weight"] = 1
            unknown["educate"] = "Inspect before deleting. The wizard will not auto-apply unknown paths."
            row = _candidate("unknown-large", path, size_bytes, unknown)
    hint = recency_hint(path)
    if hint:
        row["recency_hint"] = hint
    return row


def rank_candidates(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sort by score descending, then size, then path.

    Args:
        rows: Candidate mappings.

    Returns:
        New sorted list.
    """
    return sorted(
        rows,
        key=lambda r: (
            -float(r.get("score") or 0),
            -int(r.get("size_bytes") or 0),
            str(r.get("path") or ""),
        ),
    )


def recommend_rows(
    rows: list[dict[str, Any]],
    target_bytes: int,
    *,
    include_review: bool = True,
) -> list[dict[str, Any]]:
    """Greedy fill of safe items (largest first), then optional review.

    Dangerous / in-use / reclaim none are never included.

    Args:
        rows: Classified candidates.
        target_bytes: Desired reclaim.
        include_review: Append review items if still short.

    Returns:
        Ordered recommendation list with running totals.
    """
    safe = [
        r
        for r in rows
        if r.get("risk") == "safe"
        and r.get("reclaim") in {"delete", "quarantine"}
        and not r.get("in_use")
    ]
    safe.sort(key=lambda r: -int(r.get("size_bytes") or 0))
    picked: list[dict[str, Any]] = []
    total = 0
    for row in safe:
        item = dict(row)
        item["needs_confirm"] = False
        picked.append(item)
        total += int(row.get("size_bytes") or 0)
        if total >= target_bytes > 0:
            break
    if include_review and (target_bytes <= 0 or total < target_bytes):
        review = [
            r
            for r in rows
            if r.get("risk") == "review"
            and r.get("reclaim") in {"delete", "quarantine", "docker-prune"}
            and not r.get("in_use")
        ]
        review.sort(key=lambda r: -int(r.get("size_bytes") or 0))
        for row in review:
            item = dict(row)
            item["needs_confirm"] = True
            picked.append(item)
            total += int(row.get("size_bytes") or 0)
            if total >= target_bytes > 0:
                break
    running = 0
    out: list[dict[str, Any]] = []
    for row in picked:
        running += int(row.get("size_bytes") or 0)
        item = dict(row)
        item["running_bytes"] = running
        out.append(item)
    return out


def pressure_for(used_pct: float, avail_bytes: int) -> str:
    """ok / warn / crit from used percent and free bytes.

    Args:
        used_pct: 0–100.
        avail_bytes: Free bytes on the models filesystem.

    Returns:
        Pressure label.
    """
    avail_gib = avail_bytes / (1024**3)
    if used_pct >= 85 or avail_gib < 50:
        return "crit"
    if used_pct >= 70 or avail_gib < 200:
        return "warn"
    return "ok"


def _entry_size(row: Mapping[str, Any]) -> int:
    """Integer size_bytes from a mapping.

    Args:
        row: Candidate or largest-entry mapping.

    Returns:
        Non-negative byte count.
    """
    raw = row.get("size_bytes") or 0
    if isinstance(raw, bool):
        return 0
    if isinstance(raw, (int, float)):
        return int(raw)
    return 0


def format_gib(n: int) -> str:
    """Human GiB string.

    Args:
        n: Bytes.

    Returns:
        Formatted size.
    """
    return f"{(max(int(n), 0) / 1024 / 1024 / 1024):.2f} GiB"


_RUNTIME_TYPE_ALIASES = {
    "build-cache": "build-cache",
    "local-volumes": "local-volume",
    "local-volume": "local-volume",
    "images": "unused-image",
    "image": "unused-image",
    "unused-image": "unused-image",
    "dangling-image": "dangling-image",
    "in-use-image": "in-use-image",
    "containers": "containers",
    "container": "containers",
}

_PROTECTED_EXACT = frozenset(
    {
        "/",
        "/etc",
        "/usr",
        "/bin",
        "/sbin",
        "/boot",
        "/dev",
        "/proc",
        "/sys",
        "/lib",
        "/lib64",
        "/root",
        "/home",
        "/var/lib/rancher",
        "/var/lib/kubelet",
        "/var/lib/rancher/k3s",
        "/var/lib/rancher/k3s/server",
    }
)
_PROTECTED_PREFIXES = (
    "/etc/",
    "/usr/",
    "/bin/",
    "/sbin/",
    "/boot/",
    "/dev/",
    "/proc/",
    "/sys/",
    "/lib/",
    "/lib64/",
    "/var/lib/rancher/",
    "/var/lib/kubelet/",
)


def normalize_runtime_type(dtype: str) -> str:
    """Map docker system df Type strings to catalog docker_type tokens.

    Args:
        dtype: Raw type (``Build Cache``, ``Local Volumes``, …).

    Returns:
        Canonical token used in ``docker://`` / ``crictl://`` paths.
    """
    collapsed = str(dtype or "").strip().lower().replace("_", "-").replace(" ", "-")
    return _RUNTIME_TYPE_ALIASES.get(collapsed, collapsed)


def recency_hint(path: str, now: float | None = None) -> str:
    """Education-only recency from refs/last_accessed mtime (never atime).

    Args:
        path: File or hub repo directory.
        now: Optional epoch seconds (tests).

    Returns:
        Human hint, or empty.
    """
    if not path or path.startswith(("docker://", "crictl://")):
        return ""
    clock = time.time() if now is None else float(now)
    best_mtime: float | None = None
    source = ""
    for rel in ("refs/main", "refs", "last_accessed"):
        candidate = os.path.join(path, rel)
        if not os.path.exists(candidate):
            continue
        try:
            mtime = os.path.getmtime(candidate)
        except OSError:
            continue
        if best_mtime is None or mtime > best_mtime:
            best_mtime = mtime
            source = os.path.basename(rel.rstrip("/")) or rel
    if best_mtime is None:
        return ""
    days = max(0, int((clock - best_mtime) / 86400))
    return f"{source} mtime ~{days}d ago (not atime; NVMe often noatime)"


def is_protected_path(
    path: str,
    *,
    models_dir: str = "",
    repo_root: str = "",
) -> bool:
    """True when apply must refuse (OS, k3s, models root, this checkout).

    Args:
        path: Candidate path.
        models_dir: MODELS_DIR (the directory itself is protected, children are not).
        repo_root: Lab checkout (the tree is protected).

    Returns:
        Whether the path is forbidden to delete or quarantine.
    """
    if path.startswith(("docker://", "crictl://")):
        return False
    if not path:
        return True
    try:
        real = os.path.realpath(path)
    except OSError:
        return True

    def _one(candidate: str) -> bool:
        if candidate in _PROTECTED_EXACT or candidate.rstrip("/") in _PROTECTED_EXACT:
            return True
        for prefix in _PROTECTED_PREFIXES:
            if candidate.startswith(prefix):
                return True
        return False

    if _one(path) or _one(real):
        return True
    if models_dir:
        try:
            md = os.path.realpath(models_dir)
        except OSError:
            md = models_dir
        if real == md:
            return True
    if repo_root:
        try:
            rr = os.path.realpath(repo_root)
        except OSError:
            rr = repo_root
        if real == rr or real.startswith(rr + os.sep):
            return True
    return False


def same_fs(left: str, right: str) -> bool:
    """True when both paths exist on the same device (quarantine must not copy).

    Args:
        left: Source path.
        right: Destination path or parent.

    Returns:
        Whether ``st_dev`` matches.
    """
    try:
        return os.stat(left).st_dev == os.stat(right).st_dev
    except OSError:
        return False


def is_factory_bittest_path(path: str, glob_base: str | None = None) -> bool:
    """True for a direct child of the OEM glob base whose name contains bittest.

    Never treats the glob base itself as allowed for a general walk.

    Args:
        path: Candidate.
        glob_base: Volume root (default ``DISK_WIZARD_ROOT_GLOB_BASE`` or ``/``).

    Returns:
        Whether this is the OEM leftover exception.
    """
    base = os.path.realpath(glob_base or os.environ.get("DISK_WIZARD_ROOT_GLOB_BASE") or "/")
    try:
        real = os.path.realpath(path)
    except OSError:
        return False
    name = os.path.basename(real)
    if "bittest" not in name.lower():
        return False
    return os.path.dirname(real) == base


def step_totals(rows: Sequence[Mapping[str, Any]]) -> dict[str, int]:
    """Sum size_bytes per A/B/C step.

    Args:
        rows: Classified candidates.

    Returns:
        Mapping step → bytes.
    """
    out = {"A": 0, "B": 0, "C": 0}
    for row in rows:
        step = str(row.get("step") or "")
        if step in out:
            out[step] += _entry_size(row)
    return out


def _file_row(path: str) -> dict[str, Any]:
    """JSONL row for one walked path.

    Args:
        path: File or symlink path.

    Returns:
        Mapping with path, size_bytes, broken_symlink.
    """
    broken = os.path.islink(path) and not os.path.exists(path)
    size = 0
    if not broken:
        try:
            size = int(os.path.getsize(path))
        except OSError:
            size = 0
    return {"path": path, "size_bytes": size, "broken_symlink": broken}


def dir_size_bytes(path: str) -> int:
    """Apparent size of files under path (no dir-symlink follow).

    Args:
        path: Directory or file.

    Returns:
        Sum of file sizes.
    """
    if os.path.isfile(path) or os.path.islink(path):
        try:
            return int(os.path.getsize(path))
        except OSError:
            return 0
    if not os.path.isdir(path):
        return 0
    total = 0
    for row in walk_root_files(path, max_depth=64):
        total += int(row.get("size_bytes") or 0)
    return total


def walk_root_files(
    root: str,
    max_depth: int = 8,
    *,
    skip_dirs: frozenset[str] | None = None,
    skip_basenames: frozenset[str] | None = None,
) -> Iterator[dict[str, Any]]:
    """Yield file/symlink rows under root, depth-capped, with skip-dir prune.

    Does not follow directory symlinks.

    Args:
        root: Directory to walk.
        max_depth: Inclusive depth (root is 0; files in root are 1).
        skip_dirs: Directory basenames to prune.
        skip_basenames: File basenames to omit.

    Yields:
        JSONL-ready row mappings.
    """
    dirs = skip_dirs if skip_dirs is not None else SKIP_DIR_NAMES
    bases = skip_basenames if skip_basenames is not None else SKIP_BASENAMES
    if max_depth < 1 or not os.path.isdir(root):
        return

    def rec(dirpath: str, depth: int) -> Iterator[dict[str, Any]]:
        """Walk one directory at the given depth."""
        child_depth = depth + 1
        if child_depth > max_depth:
            return
        try:
            entries = os.scandir(dirpath)
        except OSError:
            return
        with entries:
            for entry in entries:
                name = entry.name
                try:
                    is_link = entry.is_symlink()
                    is_dir = False if is_link else entry.is_dir(follow_symlinks=False)
                except OSError:
                    continue
                if is_dir:
                    if name in dirs:
                        continue
                    yield from rec(entry.path, child_depth)
                    continue
                if is_link or entry.is_file(follow_symlinks=False):
                    if name in bases:
                        continue
                    yield _file_row(entry.path)

    yield from rec(root, 0)


def shallow_paths(roots: list[str]) -> Iterator[dict[str, Any]]:
    """Directory-granularity candidates plus incomplete/lock/core globs.

    Args:
        roots: Existing directories to scan.

    Yields:
        path/size/broken_symlink rows (files and directories).
    """
    seen: set[str] = set()
    for root in roots:
        if not root or not os.path.isdir(root):
            continue
        try:
            entries = list(os.scandir(root))
        except OSError:
            continue
        for entry in entries:
            name = entry.name
            if name in SKIP_DIR_NAMES or name in SKIP_BASENAMES:
                continue
            path = entry.path
            if path in seen:
                continue
            seen.add(path)
            try:
                is_link = entry.is_symlink()
                is_dir = False if is_link else entry.is_dir(follow_symlinks=False)
            except OSError:
                continue
            if is_dir:
                yield {
                    "path": path,
                    "size_bytes": dir_size_bytes(path),
                    "broken_symlink": False,
                }
            else:
                yield _file_row(path)
        hub = os.path.join(root, "huggingface", "hub")
        if os.path.isdir(hub):
            try:
                for entry in os.scandir(hub):
                    if entry.name in SKIP_DIR_NAMES:
                        continue
                    path = entry.path
                    if path in seen:
                        continue
                    seen.add(path)
                    yield {
                        "path": path,
                        "size_bytes": dir_size_bytes(path),
                        "broken_symlink": False,
                    }
            except OSError:
                pass
        for row in walk_root_files(root, max_depth=8):
            base = os.path.basename(str(row["path"]))
            if base.endswith(INCOMPLETE_SAFE_SUFFIXES) or base == "core" or base.startswith("core."):
                p = str(row["path"])
                if p not in seen:
                    seen.add(p)
                    yield row


def largest_entries(root: str, limit: int = 30, max_depth: int = 8) -> dict[str, Any]:
    """Top files and directories under root.

    Args:
        root: Allowed directory.
        limit: Max entries per list.
        max_depth: Walk depth.

    Returns:
        ``{"files": [...], "dirs": [...]}`` with path and size_bytes.
    """
    files: list[dict[str, Any]] = []
    dir_sizes: dict[str, int] = {}
    if os.path.isdir(root):
        dir_sizes[os.path.realpath(root)] = 0
    for row in walk_root_files(root, max_depth=max_depth):
        path = str(row["path"])
        size = int(row["size_bytes"] or 0)
        files.append({"path": path, "size_bytes": size})
        parent = os.path.dirname(path)
        while True:
            dir_sizes[parent] = dir_sizes.get(parent, 0) + size
            nxt = os.path.dirname(parent)
            if nxt == parent:
                break
            parent = nxt
    files.sort(key=lambda r: -_entry_size(r))
    dirs = [{"path": p, "size_bytes": s} for p, s in dir_sizes.items()]
    dirs.sort(key=lambda r: -_entry_size(r))
    n = max(int(limit), 1)
    return {"files": files[:n], "dirs": dirs[:n]}


def emit_walk_progress(msg: str) -> None:
    """Write a survey progress line to stderr.

    Args:
        msg: Body.
    """
    print(f"[disk-wizard] {msg}", file=sys.stderr, flush=True)


def walk_roots_to_stdout(roots: list[str], max_depth: int) -> int:
    """Walk roots, write JSONL to stdout, progress to stderr.

    Args:
        roots: Directories to scan.
        max_depth: Inclusive find-style max depth.

    Returns:
        Number of JSONL rows written.
    """
    total = 0
    for root in roots:
        if not root or not os.path.isdir(root):
            continue
        emit_walk_progress(f"Scanning {root} (max depth {max_depth})…")
        started = time.monotonic()
        count = 0
        for row in walk_root_files(root, max_depth):
            print(json.dumps(row, sort_keys=True), flush=False)
            count += 1
            total += 1
            if count % WALK_PROGRESS_EVERY == 0:
                emit_walk_progress(f"  still scanning {root}: {count} paths…")
        sys.stdout.flush()
        elapsed = time.monotonic() - started
        emit_walk_progress(f"  {root}: {count} paths ({elapsed:.1f}s)")
    return total


def _cli(argv: list[str] | None = None) -> int:
    """CLI: json | classify | rank | walk | recommend | largest | shallow.

    Args:
        argv: Optional argument list.

    Returns:
        Process status.
    """
    parser = argparse.ArgumentParser(prog="disk_catalog")
    parser.add_argument("--catalog", required=True)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("json")
    p_cl = sub.add_parser("classify")
    p_cl.add_argument("--path", required=True)
    p_cl.add_argument("--size", type=int, default=0)
    p_cl.add_argument("--broken-symlink", action="store_true")
    sub.add_parser("rank")
    p_walk = sub.add_parser("walk")
    p_walk.add_argument("roots", nargs="+")
    p_walk.add_argument("--max-depth", type=int, default=8)
    p_rec = sub.add_parser("recommend")
    p_rec.add_argument("--target-gib", type=float, default=0)
    p_lg = sub.add_parser("largest")
    p_lg.add_argument("--path", required=True)
    p_lg.add_argument("--n", type=int, default=30)
    p_lg.add_argument("--max-depth", type=int, default=8)
    p_sh = sub.add_parser("shallow")
    p_sh.add_argument("roots", nargs="+")
    args = parser.parse_args(argv)
    if args.cmd == "walk":
        walk_roots_to_stdout(list(args.roots), int(args.max_depth))
        return 0
    if args.cmd == "shallow":
        for row in shallow_paths(list(args.roots)):
            print(json.dumps(row, sort_keys=True))
        return 0
    if args.cmd == "largest":
        print(json.dumps(largest_entries(args.path, int(args.n), int(args.max_depth)), sort_keys=True))
        return 0
    cat = load_catalog(Path(args.catalog))
    if args.cmd == "json":
        print(json.dumps(cat, sort_keys=True))
        return 0
    if args.cmd == "classify":
        row = classify_path(
            args.path,
            cat,
            size_bytes=args.size,
            broken_symlink=True if args.broken_symlink else None,
        )
        print(json.dumps(row, sort_keys=True))
        return 0
    rows: list[dict[str, Any]] = []
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        item = json.loads(line)
        path = str(item.get("path") or "")
        size = int(item.get("size_bytes") or 0)
        if item.get("id") and item.get("risk"):
            rows.append(item)
            continue
        rows.append(
            classify_path(
                path,
                cat,
                size_bytes=size,
                broken_symlink=item.get("broken_symlink"),
            )
        )
    ranked = rank_candidates(rows)
    if args.cmd == "recommend":
        target = int(float(args.target_gib) * 1024 * 1024 * 1024)
        print(json.dumps(recommend_rows(ranked, target), sort_keys=True))
        return 0
    print(json.dumps(ranked, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli())
