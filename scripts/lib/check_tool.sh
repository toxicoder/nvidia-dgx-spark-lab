#!/usr/bin/env bash
#
# ## check_tool helper
#
# Resilient tool checker used by lints/run_*.sh and ansible run scripts.
# By default, a missing tool prints a message and exits 0 so local runs can
# continue gracefully when optional linters are not installed.
#
# When CI=true or REQUIRE_LINT_TOOLS=1, a missing tool is fatal (exit 1) so
# CI and strict local runs cannot silently skip lint steps.
#
# @function check_tool
# Usage (from a script):
#   source "$(dirname "$0")/../lib/check_tool.sh"
#   check_tool shellcheck "apt install shellcheck"
#   check_tool yamllint "pip install yamllint"
check_tool() {
  local tool="$1"
  local install_hint="${2:-pip install or apt install $tool}"
  if ! command -v "$tool" >/dev/null 2>&1; then
    if [[ "${CI:-}" == "true" || "${REQUIRE_LINT_TOOLS:-}" == "1" ]]; then
      echo "$tool missing - required in CI/strict mode ($install_hint)" >&2
      exit 1
    fi
    echo "$tool missing - skipping (resilient; $install_hint)"
    exit 0
  fi
}

# Example usage:
# source "$(dirname "$0")/../lib/check_tool.sh"   # adjust relative
# check_tool shellcheck "apt install shellcheck"