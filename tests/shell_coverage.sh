#!/usr/bin/env bash
# Run BATS under kcov (sequential shards) and enforce 100% line coverage on scripts/**/*.sh.
set -euo pipefail

if [[ -n ${TEST_SRCDIR:-} && -d "${TEST_SRCDIR}/_main" ]]; then
  ROOT="${TEST_SRCDIR}/_main"
else
  ROOT="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
fi
cd "$ROOT"
# Follow runfiles → workspace symlinks so kcov and BATS hit the same physical tree.
if [[ -f "${ROOT}/scripts/manage.sh" ]]; then
  ROOT="$(dirname "$(dirname "$(readlink -f "${ROOT}/scripts/manage.sh")")")"
else
  ROOT="$(pwd -P)"
fi
cd "$ROOT"

if ! command -v kcov >/dev/null 2>&1; then
  echo "shell_coverage: kcov not installed (apt install kcov or use devcontainer)" >&2
  exit 1
fi

# @function _kcov_probe
# Probe whether kcov can instrument /usr/bin/true on this host.
# @returns 0 if functional; 1 on macOS arm64 or broken kcov.
_kcov_probe() {
  local probe_out
  probe_out="$(mktemp -d)"
  if kcov --include-path="${ROOT}/scripts" "$probe_out" \
    "${ROOT}/scripts/lib/check_tool.sh" --help >/dev/null 2>&1; then
    rm -rf "$probe_out"
    return 0
  fi
  rm -rf "$probe_out"
  return 1
}
# Bazel sh_test always sets TEST_SRCDIR on Linux CI/devcontainer; skip brittle /usr/bin/true probe.
if [[ -z ${TEST_SRCDIR:-} ]] && ! _kcov_probe; then
  echo "shell_coverage: kcov installed but not functional on this host (use Linux devcontainer)" >&2
  exit 1
fi

OUT="${TEST_TMPDIR:-/tmp}/kcov-shell-$$"
rm -rf "$OUT"
mkdir -p "$OUT"

export REPO_ROOT="$ROOT"
export LAB_MOCK_NODES_JSON='[{"name":"spark0","allocatable":{"cpu":"128","memory":"1024Gi","gpu":"16"}}]'
export LAB_MOCK_PODS_JSON='[]'

KCOV_COMMON=(
  --include-path="${ROOT}/scripts"
  --bash-parse-files-in-dir="${ROOT}/scripts"
  --exclude-pattern='/tests/,/node_modules/,/bats-core/,/dashboard/,/.cache/'
)

BATS_RUNNER="${ROOT}/tests/bats_runner.sh"
chmod +x "$BATS_RUNNER"

# Sequential shards — kcov helper binaries collide when multiple shards run in parallel.
SHARDS=(manage utilities check_tool domains tooling)
shard_failed=0

# @function _shell_coverage_run_shard
# Run one BATS shard under kcov; if kcov exits non-zero, confirm with a plain bats run.
# kcov propagates non-zero from instrumented test subprocesses even when the suite passes.
# @param $1 Shard name (manage, utilities, …).
_shell_coverage_run_shard() {
  local shard="$1"
  mkdir -p "$OUT/$shard"
  # Invoke bats_runner directly — kcov only propagates bash tracing when the shebang
  # script is the kcov target; wrapping with `bash bats_runner.sh` yields empty reports.
  if kcov "${KCOV_COMMON[@]}" "$OUT/$shard" \
    "$BATS_RUNNER" "${shard}.bats"; then
    return 0
  fi
  if "$BATS_RUNNER" "${shard}.bats" >/dev/null; then
    echo "shell_coverage: shard ${shard}: kcov exit non-zero but bats passed (instrumentation noise)" >&2
    return 0
  fi
  echo "shell_coverage: shard ${shard} failed" >&2
  return 1
}

for shard in "${SHARDS[@]}"; do
  if ! _shell_coverage_run_shard "$shard"; then
    shard_failed=1
  fi
done

if [[ $shard_failed -ne 0 ]]; then
  echo "shell_coverage: one or more kcov shards failed" >&2
  exit 1
fi

python3 - "$OUT" "$ROOT" <<'PY'
"""Merge kcov shard coverage and enforce 100% line coverage on scripts/**/*.sh."""
from __future__ import annotations

import json
import pathlib
import sys
import xml.etree.ElementTree as ET


def _merge_lines(
    merged: dict[str, dict[str, int]], path: str, lines: dict[str, int]
) -> None:
    """OR-merge line hits for path into merged."""
    norm = path.replace("\\", "/")
    bucket = merged.setdefault(norm, {})
    for ln, hit in lines.items():
        prev = bucket.get(str(ln), 0)
        bucket[str(ln)] = 1 if (prev or hit) else 0


def merge_shard_coverage(out_dir: pathlib.Path) -> dict[str, dict]:
    """Merge per-file line hits from kcov shard trees (OR across shards)."""
    merged: dict[str, dict[str, int]] = {}

    # Modern kcov: per-line data in sonarqube.xml (coverage.json files is summary-only).
    for xml_path in out_dir.rglob("sonarqube.xml"):
        try:
            root = ET.parse(xml_path).getroot()
        except (ET.ParseError, OSError):
            continue
        for file_el in root.findall("file"):
            fpath = file_el.get("path", "")
            if not fpath:
                continue
            lines: dict[str, int] = {}
            for line_el in file_el.findall("lineToCover"):
                ln = str(line_el.get("lineNumber", ""))
                if not ln:
                    continue
                covered = line_el.get("covered", "false").lower() == "true"
                lines[ln] = 1 if covered else 0
            if lines:
                _merge_lines(merged, fpath, lines)

    # Legacy kcov: line hits embedded in coverage.json dict entries.
    for cov_path in out_dir.rglob("coverage.json"):
        try:
            data = json.loads(cov_path.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        files = data.get("files", data)
        if isinstance(files, dict):
            for key, info in files.items():
                if not isinstance(info, dict):
                    continue
                lines = info.get("lines", {})
                if isinstance(lines, dict):
                    _merge_lines(
                        merged,
                        key,
                        {str(ln): 1 if hit else 0 for ln, hit in lines.items()},
                    )
                elif isinstance(lines, list):
                    _merge_lines(
                        merged,
                        key,
                        {str(i + 1): 1 if hit else 0 for i, hit in enumerate(lines)},
                    )
    return merged


def uncovered_for_script(merged: dict[str, dict], rel: str) -> list | None:
    """Return uncovered line numbers for rel, or None if file missing from report."""
    norm_rel = rel.replace("\\", "/")
    found = False
    bad: list = []
    for key, lines in merged.items():
        key_norm = key.replace("\\", "/")
        if norm_rel not in key_norm and not key_norm.endswith(norm_rel):
            continue
        found = True
        if isinstance(lines, dict):
            bad.extend(ln for ln, hit in lines.items() if not hit)
        else:
            bad.extend(i + 1 for i, hit in enumerate(lines) if hit == 0)
    if not found:
        return None
    return bad


def main() -> int:
    out_dir = pathlib.Path(sys.argv[1])
    root = pathlib.Path(sys.argv[2])
    merged = merge_shard_coverage(out_dir)
    scripts = sorted((root / "scripts").rglob("*.sh"))
    uncovered: list[tuple[str, list]] = []

    for script in scripts:
        rel = script.relative_to(root).as_posix()
        bad = uncovered_for_script(merged, rel)
        if bad is None:
            uncovered.append((rel, ["not_in_kcov_report"]))
        elif bad:
            uncovered.append((rel, bad[:10]))

    if uncovered:
        print("shell_coverage: uncovered lines:", file=sys.stderr)
        for rel, lines in uncovered:
            print(f"  {rel}: {lines}", file=sys.stderr)
        return 1

    print("shell_coverage: 100% line coverage on scripts/**/*.sh")
    return 0


sys.exit(main())
PY
