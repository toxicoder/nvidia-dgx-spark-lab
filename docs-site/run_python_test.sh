#!/usr/bin/env bash
#
# Bazel entry point for the python unittest suites that live beside the docs-site sources
# (the nav transcriber and the MkDocs->MDX codemod).
#
# Usage (from a bazel run): run_python_test.sh <test_module.py> [more args]
set -euo pipefail

if [[ -n ${BUILD_WORKSPACE_DIRECTORY:-} && -d "${BUILD_WORKSPACE_DIRECTORY}/docs-site" ]]; then
  cd "${BUILD_WORKSPACE_DIRECTORY}/docs-site"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$SCRIPT_DIR"
fi

if [[ $# -eq 0 ]]; then
  echo "usage: $(basename "$0") <test_module.py> [unittest args...]" >&2
  exit 2
fi

TEST_MODULE="$1"
shift

if [[ ! -f ${TEST_MODULE} ]]; then
  echo "test module ${TEST_MODULE} not found in $(pwd)" >&2
  exit 1
fi

# discover keeps the package dir importable so the tests can `import gen_nav` etc.
# out of scripts/.
exec python3 -m unittest discover -s . -p "${TEST_MODULE}" -t . -v "$@"
