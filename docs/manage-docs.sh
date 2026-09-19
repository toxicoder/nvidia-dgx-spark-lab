#!/usr/bin/env bash
# ##
# Purpose: Entry point for the Fumadocs documentation site (serve, build, preview, status, clean).
# Source of truth: docs-site/ is the Next.js app; docs/ holds its markdown/MDX content.
# Regenerate: n/a (hand-maintained).
# Safety: Runs npm in the repository checkout; never publishes. Deployment is CI-only.
#
# The site was migrated from Material for MkDocs to Fumadocs on the Next.js App Router.
# Content stays in docs/ so the shell/dashboard generators keep writing into docs/generated/
# and Bazel data dependencies keep listing the same files.
#
# Bazel note: this script is the primary interface for local docs work and is also what
# //docs:serve, //docs:docs, //docs:preview and //docs:status execute.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n ${BUILD_WORKSPACE_DIRECTORY:-} ]]; then
  # `bazel run` executes from bazel-out; operate on the real checkout so generated docs,
  # node_modules and the static export land where a developer can see and commit them.
  REPO_ROOT="${BUILD_WORKSPACE_DIRECTORY}"
  SCRIPT_DIR="${REPO_ROOT}/docs"
else
  REPO_ROOT="$(dirname "$SCRIPT_DIR")"
fi
SITE_DIR="$REPO_ROOT/docs-site"
DEFAULT_PORT=3005
PORT=${PORT:-$DEFAULT_PORT}
AUTO_OPEN_BROWSER=true

# Set AUTO_SETUP_DOCS=false to skip the automatic npm ci on first use.
: "${AUTO_SETUP_DOCS:=true}"

info() { echo -e "\033[1;34m[INFO]\033[0m $*"; }
success() { echo -e "\033[1;32m[SUCCESS]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; }

# @function docs_node_is_ready
# Ensure Node is available and the docs-site dependencies are installed.
#
# Args:
#   $1 — "install" to force an install even when node_modules looks present.
# Returns:
#   Shell status; exits the script when the toolchain cannot satisfy the build.
docs_node_is_ready() {
  local force="${1:-}"
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    error "Node.js 22+ and npm are required for the documentation site."
    error "In the devcontainer they are preinstalled; on a host: brew install node@22."
    exit 1
  fi

  # process.versions.node is like "22.14.0" with no "v" prefix: take the first dotted part.
  local node_major
  node_major="$(node -p 'Number.parseInt(process.versions.node.split(".")[0], 10)' 2>/dev/null || echo 0)"
  if [[ ! ${node_major:-0} =~ ^[0-9]+$ ]] || [[ ${node_major:-0} -lt 20 ]]; then
    error "Node ${node:-unknown} is too old for Next 16 (need 20+, 22 recommended)."
    exit 1
  fi

  if [[ $force == "install" || ! -x "$SITE_DIR/node_modules/.bin/next" ]]; then
    if [[ $AUTO_SETUP_DOCS == "true" ]]; then
      info "Installing documentation site dependencies (npm ci)"
      "$SCRIPT_DIR/setup-docs.sh" || {
        error "Failed to prepare the docs site via docs/setup-docs.sh"
        exit 1
      }
    elif [[ ! -x "$SITE_DIR/node_modules/.bin/next" ]]; then
      error "docs-site/node_modules is missing. Run ./docs/setup-docs.sh first."
      exit 1
    fi
  fi
}

generate_code_docs() {
  info "Ensuring generated docs are up to date (shell + dashboard API)..."

  if command -v python3 >/dev/null 2>&1; then
    python3 "$SCRIPT_DIR/generate_shell_docs.py" || warn "Shell doc generation had issues (non-fatal)"
  else
    warn "python3 not found - skipping shell docs generation"
  fi

  local dash_dir="$REPO_ROOT/dashboard"
  local generated_dash="$REPO_ROOT/docs/generated/dashboard-api"
  if [[ -d $dash_dir && -f "$dash_dir/package.json" ]]; then
    if command -v npm >/dev/null 2>&1 && [[ -d "$dash_dir/node_modules" ]]; then
      # TypeDoc is expensive; only re-run it when a source is newer than the generated tree.
      local need_dash=false
      if [[ ! -d $generated_dash ]]; then
        need_dash=true
      elif find "$dash_dir" -path '*/node_modules' -prune -o \
        \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.json' \) -newer "$generated_dash" -print -quit | grep -q .; then
        need_dash=true
      fi

      if [[ $need_dash == true ]]; then
        (
          cd "$dash_dir" || exit 1
          npm run docs:generate 2>/dev/null || warn "TypeDoc generation skipped (run 'cd dashboard && npm ci' if needed)"
        )
      fi
    else
      warn "Dashboard node_modules missing - API docs not generated (run npm ci in dashboard/)"
    fi
  fi
}

check_content() {
  if [[ ! -f "$SITE_DIR/source.config.ts" ]]; then
    error "docs-site/source.config.ts not found - the docs app is incomplete."
    exit 1
  fi
}

open_browser() {
  local url="http://127.0.0.1:${PORT}"
  if [[ $AUTO_OPEN_BROWSER == "true" ]]; then
    if command -v python3 &>/dev/null; then
      python3 -m webbrowser "$url" 2>/dev/null || true
    elif [[ $OSTYPE == "darwin"* ]]; then
      open "$url" 2>/dev/null || true
    elif command -v xdg-open &>/dev/null; then
      xdg-open "$url" 2>/dev/null || true
    fi
  fi
}

run_site_script() {
  local script="$1"
  shift
  check_content
  docs_node_is_ready
  (cd "$SITE_DIR" && npm run "$script" -- "$@")
}

case "${1:-help}" in
  serve)
    shift
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --port)
          PORT="$2"
          shift 2
          ;;
        --no-browser)
          AUTO_OPEN_BROWSER=false
          shift
          ;;
        *)
          error "Unknown option for serve: $1"
          exit 1
          ;;
      esac
    done

    docs_node_is_ready
    generate_code_docs
    check_content

    info "Starting the Fumadocs dev server on port ${PORT}..."
    [[ $AUTO_OPEN_BROWSER == "true" ]] && info "Browser will open automatically (use --no-browser to disable)"
    open_browser

    # The dev server must be reached over localhost: Next rejects cross-origin dev
    # resources requested via 127.0.0.1, which breaks hydration.
    (cd "$SITE_DIR" && exec npm run dev -- --port "$PORT" --hostname localhost)
    ;;

  build)
    shift
    # Empty means the plain root export: what //docs:render-check, the visual suite, and
    # a developer's preview consume.  The published aliases need a basePath and are asked
    # for explicitly with --version.
    VERSION=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --strict)
          # Kept for compatibility: strictness is the default (next build fails on errors).
          shift
          ;;
        --no-strict)
          warn "--no-strict is obsolete; the Next build has no non-strict mode."
          shift
          ;;
        --version)
          VERSION="$2"
          shift 2
          ;;
        *)
          error "Unknown option for build: $1"
          exit 1
          ;;
      esac
    done

    docs_node_is_ready
    generate_code_docs
    check_content

    # The published site keeps the MkDocs URL layout: /<repo>/latest/ and
    # /<repo>/development/ are separate exports (DOCS_ALIAS sets Next's basePath).
    build_script="build"
    case "$VERSION" in
      "") ;;
      latest) build_script="build:latest" ;;
      development) build_script="build:development" ;;
      *)
        error "--version must be latest or development, got $VERSION"
        exit 1
        ;;
    esac

    info "Building the documentation site${VERSION:+ as $VERSION (basePath set)}..."
    (cd "$SITE_DIR" && npm run "$build_script")
    success "Build complete. Output is in docs-site/out/"
    ;;

  preview)
    docs_node_is_ready
    generate_code_docs
    check_content

    info "Building production preview..."
    (cd "$SITE_DIR" && npm run build)
    success "Serving the static export from docs-site/out/ on port ${PORT}..."
    # scripts/serve_static.mjs takes positional [port] [root].
    (cd "$SITE_DIR" && npm run serve -- "$PORT" out)
    ;;

  typecheck)
    shift
    run_site_script typecheck "$@"
    ;;

  test)
    shift
    docs_node_is_ready
    (cd "$SITE_DIR" && npm run unit -- "$@")
    ;;

  visual)
    shift
    # The committed baselines are drawn by the CI image, so the comparison runs there too;
    # a laptop Chromium differs in font metrics and would report every page as changed.
    bash "$SITE_DIR/scripts/visual_linux.sh" "$@"
    ;;

  visual-update)
    shift
    bash "$SITE_DIR/scripts/visual_linux.sh" --update "$@"
    ;;

  status)
    echo "=== Documentation Status ==="
    echo "Content root:          $([ -d "$REPO_ROOT/docs" ] && echo 'docs/' || echo 'MISSING')"
    echo "Navigation tree:       $([ -f "$SITE_DIR/lib/nav.json" ] && echo 'docs-site/lib/nav.json' || echo 'MISSING (hand-edit docs-site/lib/nav.json, then npm run nav:check)')"
    echo "source.config.ts:      $([ -f "$SITE_DIR/source.config.ts" ] && echo 'present' || echo 'MISSING')"
    if [[ -x "$SITE_DIR/node_modules/.bin/next" ]]; then
      echo "Dependencies:          installed ($(node -p "require('$SITE_DIR/node_modules/next/package.json').version" 2>/dev/null || echo '?'))"
    else
      echo "Dependencies:          not installed (run ./docs/setup-docs.sh)"
    fi
    if command -v node >/dev/null 2>&1; then
      echo "Node:                  $(node --version 2>/dev/null || echo 'not in PATH')"
    else
      echo "Node:                  not in PATH"
    fi
    echo "Static export:         $([ -f "$SITE_DIR/out/index.html" ] && echo 'docs-site/out/' || echo 'not built (npm run build)')"
    echo "Default port:          $DEFAULT_PORT"
    echo "Auto-open browser:     $AUTO_OPEN_BROWSER"
    ;;

  clean)
    info "Cleaning build artifacts..."
    rm -rf "$SITE_DIR/out" "$SITE_DIR/out-linux" "$SITE_DIR/.deps-linux-stamp" \
      "$SITE_DIR/.next" "$SITE_DIR/.source"
    success "Clean complete."
    ;;

  help | *)
    cat <<EOF
Usage: $0 {serve|build|preview|typecheck|test|visual|visual-update|status|clean} [options]

Commands:
  serve          Start the Next dev server with hot reload
                 Options: --port 3005      Set custom port
                          --no-browser     Do not auto-open a browser
  build          Build the static export into docs-site/out/
                 Options: --version latest|development   Build with that basePath
  preview        Build + serve the static export (final check before commit)
  typecheck      next typegen + tsc --noEmit
  test           Run the Vitest unit suite (widgets and content transforms)
  visual         Run the visual regression suite in the CI image (needs Docker)
  visual-update  Refresh the visual baselines in the CI image (needs Docker; review the diff)
  status         Show the state of the docs toolchain
  clean          Remove docs-site/out, out-linux, .next and .source

Examples:
  ./docs/manage-docs.sh serve
  ./docs/manage-docs.sh serve --port 3007 --no-browser
  ./docs/manage-docs.sh build --version development
  ./docs/manage-docs.sh preview
EOF
    ;;
esac
