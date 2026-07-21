#!/usr/bin/env bash
#
# Bazel entry point wrapper for dashboard npm scripts.
# Lets users do:
#   bazel run //dashboard:install
#   bazel run //dashboard:dev
#   bazel run //dashboard:build
#   bazel run //dashboard:test
#   bazel run //dashboard:docs
#
# All arguments after -- are passed through to the underlying npm command.
set -euo pipefail

# Robustly locate the dashboard package directory.
# When invoked via `bazel run`, we prefer BUILD_WORKSPACE_DIRECTORY so that
# we run from the real source tree (not bazel-bin/ symlinks). This is
# especially important for tools like Playwright that do filesystem globbing
# for test discovery.
if [[ -n ${BUILD_WORKSPACE_DIRECTORY:-} && -d "${BUILD_WORKSPACE_DIRECTORY}/dashboard" ]]; then
  cd "${BUILD_WORKSPACE_DIRECTORY}/dashboard"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$SCRIPT_DIR"
fi

# Map bazel target name (via $0 or first arg) to npm script.
# sh_test passes the subcommand as $1 (e.g. args = ["test"]), not as $0.
TARGET_NAME="$(basename "${0:-npm}")"
SUBCMD="$TARGET_NAME"
if [[ $SUBCMD == "run_npm.sh" || $SUBCMD == "npm" ]] && [[ $# -gt 0 ]]; then
  SUBCMD="$1"
  shift
fi

# bazel run //dashboard:build invokes "build build" — drop duplicate subcommand arg.
if [[ $# -gt 0 && $1 == "$SUBCMD" ]]; then
  shift
fi

ensure_deps() {
  if [[ ! -x "node_modules/.bin/vitest" && ! -x "node_modules/.bin/playwright" ]]; then
    echo "→ dashboard: installing npm deps (node_modules missing)"
    npm ci --legacy-peer-deps
  fi
}

CMD="npm"
if [[ $SUBCMD == "install" ]]; then
  exec $CMD ci --legacy-peer-deps "$@"
fi

if [[ $SUBCMD == "dev" ]]; then
  exec $CMD run dev "$@"
fi

if [[ $SUBCMD == "build" ]]; then
  exec $CMD run build "$@"
fi

if [[ $SUBCMD == "test" ]]; then
  ensure_deps
  exec $CMD run test -- --run "$@"
fi

if [[ $SUBCMD == "test-coverage" || $SUBCMD == "coverage" ]]; then
  ensure_deps
  exec $CMD run test:coverage "$@"
fi

if [[ $SUBCMD == "docs" || $SUBCMD == "typedoc" ]]; then
  exec $CMD run docs:generate "$@"
fi

if [[ $SUBCMD == "visual" ]]; then
  ensure_deps
  # USE_MOCKS so that server components (RSC) render using the mock fixtures.
  # This populates the panels + treemap for meaningful goldens.
  USE_MOCKS=1 AUTH_BYPASS=1 exec $CMD exec playwright test "$@"
fi

# Fallback / generic
if [[ $# -gt 0 ]]; then
  exec $CMD "$@"
fi

echo "dashboard npm runner. Common:"
echo "  bazel run //dashboard:install"
echo "  bazel run //dashboard:dev"
echo "  bazel run //dashboard:build"
echo "  bazel run //dashboard:test"
echo "  bazel run //dashboard:test-coverage"
echo "  bazel run //dashboard:docs"
echo ""
echo "Pass extra flags after -- , e.g. bazel run //dashboard:build -- --debug"
exit 1
