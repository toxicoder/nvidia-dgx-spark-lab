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

set -euo pipefail

# shellcheck source=lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/lib/paths.sh"
SCRIPT_DIR="$(lab_script_dir 0 scripts)"
if [[ -n "${BUILD_WORKSPACE_DIRECTORY:-}" ]]; then
  ROOT="${BUILD_WORKSPACE_DIRECTORY}"
else
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
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

if [[ -z "$MODE" ]]; then
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
if [[ -z "$PRETTIER" ]]; then
  echo "yaml_format.sh: prettier not found (run: cd dashboard && npm ci)" >&2
  exit 1
fi

cd "$ROOT"

PRETTIER_FLAG="--write"
if [[ "$MODE" == "--check" ]]; then
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
  echo "yaml_format.sh: no YAML files found"
  exit 0
fi

echo "yaml_format.sh: ${MODE#--} ${#YAML_FILES[@]} YAML file(s) with prettier"

run_prettier() {
  # shellcheck disable=SC2086
  if [[ "$PRETTIER" == *" "* ]]; then
    eval "$PRETTIER" --config "$ROOT/prettier.config.mjs" --ignore-path "$ROOT/.prettierignore" \
      "$PRETTIER_FLAG" \"\${@}\"
  else
    "$PRETTIER" --config "$ROOT/prettier.config.mjs" --ignore-path "$ROOT/.prettierignore" \
      "$PRETTIER_FLAG" "$@"
  fi
}

run_prettier "${YAML_FILES[@]}"