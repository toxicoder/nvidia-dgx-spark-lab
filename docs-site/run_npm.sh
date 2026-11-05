#!/usr/bin/env bash
#
# Bazel entry point wrapper for docs-site npm scripts.
# Lets users do:
#   bazelisk run //docs-site:install
#   bazelisk run //docs-site:dev
#   bazelisk run //docs-site:build
#   bazelisk run //docs-site:typecheck
#   bazelisk run //docs-site:unit
#
# All arguments after -- are passed through to the underlying npm command.
set -euo pipefail

# Robustly locate the docs-site package directory.
# When invoked via `bazel run`, prefer BUILD_WORKSPACE_DIRECTORY so we run from the real
# source tree (not bazel-bin symlinks): the Next build reads content from the sibling
# docs/ directory and Playwright globs tests from disk, neither of which works reliably
# through the runfiles sandbox.
if [[ -n ${BUILD_WORKSPACE_DIRECTORY:-} && -d "${BUILD_WORKSPACE_DIRECTORY}/docs-site" ]]; then
  cd "${BUILD_WORKSPACE_DIRECTORY}/docs-site"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$SCRIPT_DIR"
fi

# Map the bazel target name (via $0 or first arg) to an npm script.
# sh_test passes the subcommand as $1 (e.g. args = ["unit"]), not as $0.
TARGET_NAME="$(basename "${0:-npm}")"
SUBCMD="$TARGET_NAME"
if [[ $SUBCMD == "run_npm.sh" || $SUBCMD == "npm" ]] && [[ $# -gt 0 ]]; then
  SUBCMD="$1"
  shift
fi

# bazelisk run //docs-site:build invokes "build build" — drop the duplicated subcommand arg.
if [[ $# -gt 0 && $1 == "$SUBCMD" ]]; then
  shift
fi

# Vitest is the one consumer that must run out of the *physical* package directory. Vite
# resolves a module to its real path before serving it, so under `bazelisk test` a suite run
# from the runfiles tree loads React, vitest and vitest.setup.ts twice -- once per tree --
# and jest-dom's expect.extend lands on a different expect than the specs use (`Invalid Chai
# property: toBeInTheDocument`). tsc, the Next builds and the codemods read files instead of
# importing them, so they keep working through runfiles; pulling them in here as well is what
# stacked three `//:test-fast` targets onto a single node_modules.
if [[ $SUBCMD == "unit" ]]; then
  PHYSICAL=""
  if [[ -f package.json ]]; then
    PHYSICAL="$(dirname "$(readlink -f package.json 2>/dev/null || true)")"
  fi
  if [[ -n $PHYSICAL && -d $PHYSICAL && $PHYSICAL != "$PWD" ]]; then
    cd "$PHYSICAL"
  fi
fi

ensure_deps() {
  # The lock is taken unconditionally, not only when the install is needed: holding it across
  # the check and the run is what keeps a peer from deleting node_modules under a running
  # suite. See docs-site/scripts/npm-install-lock.sh.
  if [[ -f scripts/npm-install-lock.sh ]]; then
    # shellcheck source=/dev/null
    source ./scripts/npm-install-lock.sh
    npm_install_lock "$PWD"
  fi
  if [[ ! -x "node_modules/.bin/next" || ! -x "node_modules/.bin/vitest" ]]; then
    echo "→ docs-site: installing npm deps (node_modules missing)"
    npm ci --legacy-peer-deps
  fi
}

CMD="npm"

case "$SUBCMD" in
  install)
    exec $CMD ci --legacy-peer-deps "$@"
    ;;
  dev)
    ensure_deps
    # Dev resources are served cross-origin when addressed by IP, which Next rejects.
    exec $CMD run dev -- --hostname localhost "$@"
    ;;
  build)
    ensure_deps
    exec $CMD run build "$@"
    ;;
  build-latest)
    ensure_deps
    exec $CMD run build:latest "$@"
    ;;
  build-development)
    ensure_deps
    exec $CMD run build:development "$@"
    ;;
  serve)
    ensure_deps
    # scripts/serve_static.mjs takes positional [port] [root].
    exec $CMD run serve -- "$@"
    ;;
  typecheck)
    ensure_deps
    exec $CMD run typecheck "$@"
    ;;
  unit)
    ensure_deps
    exec $CMD run unit "$@"
    ;;
  visual)
    ensure_deps
    exec $CMD run visual "$@"
    ;;
  visual-update)
    ensure_deps
    exec $CMD run visual:update "$@"
    ;;
  nav)
    ensure_deps
    exec $CMD run nav:generate "$@"
    ;;
esac

# Fallback / generic escape hatch: bazelisk run //docs-site:npm -- <any npm args>
if [[ $# -gt 0 ]]; then
  exec $CMD "$@"
fi

echo "docs-site npm runner. Common:"
echo "  bazelisk run //docs-site:install"
echo "  bazelisk run //docs-site:dev"
echo "  bazelisk run //docs-site:build"
echo "  bazelisk run //docs-site:typecheck"
echo "  bazelisk run //docs-site:unit"
echo "  bazelisk run //docs-site:visual"
echo ""
echo "Pass extra flags after -- , e.g. bazelisk run //docs-site:build -- --debug"
exit 1
