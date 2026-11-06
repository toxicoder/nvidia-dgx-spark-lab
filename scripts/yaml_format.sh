#!/usr/bin/env bash
#
# ## YAML formatter (prettier)
#
# Format or check YAML across the repo via prettier.
# Excludes Jinja templates (*.yaml.j2) and build/cache trees.
#
# Usage:
#   scripts/yaml_format.sh --write    # format in place (//:fix)
#   scripts/yaml_format.sh --check    # verify formatting (lint)
#
# Safety: an empty file list is a hard failure. This gate previously resolved its
# repo root with `lab_script_dir 0`, which returns the directory of `lib/paths.sh`
# (`scripts/lib`) rather than the script's own directory, so it searched
# `scripts/**/*.yaml`, found none, printed "no YAML files found" and exited 0.

set -euo pipefail

# shellcheck source=lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/lib/paths.sh"
# depth 1 = this file's own directory; depth 0 would resolve to scripts/lib.
SCRIPT_DIR="$(lab_script_dir 1 scripts)"
if [[ -n ${BUILD_WORKSPACE_DIRECTORY:-} ]]; then
  ROOT="${BUILD_WORKSPACE_DIRECTORY}"
elif [[ -n ${TEST_SRCDIR:-} ]]; then
  ROOT="${TEST_SRCDIR}/_main"
else
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

# Runfiles only materialise declared data deps, so re-root on the physical
# workspace through this script's own source symlink, as //lints:shfmt does.
SELF="${SCRIPT_DIR}/$(basename "${BASH_SOURCE[0]:-$0}")"
if [[ -L $SELF ]]; then
  ROOT="$(dirname "$(dirname "$(readlink -f "$SELF")")")"
fi

MODE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --write | --check)
      MODE="$1"
      shift
      ;;
    -h | --help)
      cat <<'EOF'
Usage: yaml_format.sh --write | --check

  --write   Format all tracked YAML with prettier.
  --check   Exit non-zero if any YAML file needs formatting.
EOF
      exit 0
      ;;
    *)
      echo "yaml_format.sh: unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z $MODE ]]; then
  echo "yaml_format.sh: pass --write or --check" >&2
  exit 2
fi

resolve_prettier() {
  if [[ -x "$ROOT/dashboard/node_modules/.bin/prettier" ]]; then
    echo "$ROOT/dashboard/node_modules/.bin/prettier"
    return 0
  fi
  if command -v prettier >/dev/null 2>&1; then
    echo prettier
    return 0
  fi
  if command -v npx >/dev/null 2>&1; then
    echo "npx --yes prettier@3"
    return 0
  fi
  return 1
}

PRETTIER="$(resolve_prettier || true)"
if [[ -z $PRETTIER ]]; then
  echo "yaml_format.sh: prettier not found (run: cd dashboard && npm ci)" >&2
  exit 1
fi

cd "$ROOT"

PRETTIER_FLAG="--write"
if [[ $MODE == "--check" ]]; then
  PRETTIER_FLAG="--check"
fi

YAML_FILES=()
while IFS= read -r -d '' file; do
  YAML_FILES+=("$file")
done < <(
  find . \( -name '*.yaml' -o -name '*.yml' \) \
    ! -path '*/bazel-*/*' \
    ! -path './site/*' \
    ! -path './.venv*' \
    ! -path './node_modules/*' \
    ! -path './dashboard/node_modules/*' \
    ! -path './bazel-bin/*' \
    ! -path './bazel-out/*' \
    ! -name '*.yaml.j2' \
    ! -name '*.yml.j2' \
    ! -path './helm/*/templates/*' \
    -print0
)

if [[ ${#YAML_FILES[@]} -eq 0 ]]; then
  echo "yaml_format.sh: no YAML files found from ${ROOT}" >&2
  exit 1
fi

echo "yaml_format.sh: ${MODE#--} ${#YAML_FILES[@]} YAML file(s) with prettier"

run_prettier() {
  # Prefer a single executable path; fall back to word-split only for
  # "npx --yes prettier@3" style resolvers (no user input).
  if [[ $PRETTIER == *" "* ]]; then
    # shellcheck disable=SC2086 # intentional split of trusted PRETTIER command words
    $PRETTIER --config "$ROOT/prettier.config.mjs" --ignore-path "$ROOT/.prettierignore" \
      "$PRETTIER_FLAG" "$@"
  else
    "$PRETTIER" --config "$ROOT/prettier.config.mjs" --ignore-path "$ROOT/.prettierignore" \
      "$PRETTIER_FLAG" "$@"
  fi
}

run_prettier "${YAML_FILES[@]}"
