#!/usr/bin/env bash
# Runner for the generator unittest so it can be used as sh_test src.
set -euo pipefail
# The .py is next to us in the runfiles for this package.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/test_generate_shell_docs.py" "$@"
