#!/usr/bin/env bash
set -euo pipefail

# Quality-of-life improved docs management script
# Works with bash and zsh. Compatible with previous instructions.
#
# Bazel note: This script is the primary interface for local docs work.
# You can also create a docs/BUILD.bazel target that calls this script
# or mkdocs directly if you want `bazel run //docs:serve`.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${BUILD_WORKSPACE_DIRECTORY:-}" ]]; then
    # When invoked via `bazel run`, use the real source workspace so that
    # side effects (venv, .bazelignore updates, generated docs, temp configs)
    # land in the user's checkout instead of a bazel-out/ tree. This also
    # lets us exec sibling scripts like setup-docs.sh from their real location.
    REPO_ROOT="${BUILD_WORKSPACE_DIRECTORY}"
    SCRIPT_DIR="${REPO_ROOT}/docs"
else
    REPO_ROOT="$(dirname "$SCRIPT_DIR")"
fi
VENV_DIR="$REPO_ROOT/.venv-docs"
MKDOCS_YML="$REPO_ROOT/mkdocs.yml"
DEFAULT_PORT=8000
PORT=${PORT:-$DEFAULT_PORT}
AUTO_OPEN_BROWSER=true

# Set AUTO_SETUP_DOCS=false to disable automatic venv creation/installation
: "${AUTO_SETUP_DOCS:=true}"

# Simple colored output helpers
info()    { echo -e "\033[1;34m[INFO]\033[0m $*"; }
success() { echo -e "\033[1;32m[SUCCESS]\033[0m $*"; }
warn()    { echo -e "\033[1;33m[WARN]\033[0m $*"; }
error()   { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; }

ensure_supporting_files() {
    # Auto-ensure supporting files that setup-docs.sh normally creates
    # (quietly, so users can just run `serve`)
    if [[ -f "$REPO_ROOT/.bazelignore" ]]; then
        if ! grep -q "site/" "$REPO_ROOT/.bazelignore" 2>/dev/null; then
            cat >> "$REPO_ROOT/.bazelignore" << 'EOG'

# MkDocs generated output and venv (Bazel should ignore)
site/
.venv-docs/
__pycache__/
EOG
        fi
    fi

    if [[ ! -f "$SCRIPT_DIR/BUILD.bazel" ]]; then
        cat > "$SCRIPT_DIR/BUILD.bazel" << 'EOG'
"""Bazel targets for documentation site (Material for MkDocs)."""

load("@rules_shell//shell:sh_binary.bzl", "sh_binary")

sh_binary(
    name = "serve",
    srcs = ["manage-docs.sh"],
    args = ["serve"],
    data = [
        "//:mkdocs.yml",
        "assets",
        "generate_shell_docs.py",
        "hooks.py",
        "requirements.txt",
        "setup-docs.sh",
    ],
    visibility = ["//visibility:public"],
)

sh_binary(
    name = "docs",
    srcs = ["manage-docs.sh"],
    args = ["build"],
    data = [
        "//:mkdocs.yml",
        "assets",
        "generate_shell_docs.py",
        "hooks.py",
        "requirements.txt",
        "setup-docs.sh",
    ],
    visibility = ["//visibility:public"],
)

sh_binary(
    name = "status",
    srcs = ["manage-docs.sh"],
    args = ["status"],
    visibility = ["//visibility:public"],
)
EOG
    fi
}

ensure_docs_env() {
    # Official automation: always delegate venv + dependency + supporting file
    # creation to the canonical setup-docs.sh in quiet mode.
    # This ensures 100% consistent logic in one official place.
    QUIET=true "$SCRIPT_DIR/setup-docs.sh" || {
        error "Failed to ensure docs environment via official setup-docs.sh"
        exit 1
    }

    # shellcheck disable=SC1091
    source "$VENV_DIR/bin/activate"

    # Verify activation
    if [[ "${VIRTUAL_ENV:-}" != *".venv-docs" ]]; then
        error "Failed to activate the docs virtualenv at $VENV_DIR after official setup."
        exit 1
    fi

    # Sanity checks
    if ! command -v mkdocs >/dev/null 2>&1; then
        error "mkdocs not available after official setup."
        exit 1
    fi

}

# Legacy name kept for any external callers.
# Respects AUTO_SETUP_DOCS when possible.
activate_venv() {
    if [[ "$AUTO_SETUP_DOCS" == "true" ]]; then
        ensure_docs_env
    else
        # original strict behavior
        if [[ ! -d "$VENV_DIR" ]]; then
            error "Virtual environment not found at $VENV_DIR"
            error "Run './docs/setup-docs.sh' first."
            exit 1
        fi
        source "$VENV_DIR/bin/activate"
        if [[ "${VIRTUAL_ENV:-}" != *".venv-docs" ]]; then
            error "Failed to activate the docs virtualenv at $VENV_DIR"
            exit 1
        fi
    fi
}

generate_code_docs() {
    info "Ensuring generated docs are up to date (shell + TypeScript)..."

    # Shell reference (Python extractor - always available in venv)
    if command -v python3 >/dev/null 2>&1; then
        python3 "$SCRIPT_DIR/generate_shell_docs.py" || warn "Shell doc generation had issues (non-fatal)"
    else
        warn "python3 not found - skipping shell docs generation"
    fi

    # Dashboard TypeScript docs (best effort)
    DASH_DIR="$REPO_ROOT/dashboard"
    GENERATED_DASH="$REPO_ROOT/docs/generated/dashboard-api"
    if [[ -d "$DASH_DIR" && -f "$DASH_DIR/package.json" ]]; then
        if command -v npm >/dev/null 2>&1 && [[ -d "$DASH_DIR/node_modules" ]]; then
            # Only run (expensive) TypeDoc if TS/JS sources are newer than generated output.
            # This keeps repeated `serve` fast and avoids unnecessary watcher noise / unresponsiveness.
            need_dash=false
            if [[ ! -d "$GENERATED_DASH" ]]; then
                need_dash=true
            else
                # Find any source file newer than the generated dir
                if find "$DASH_DIR" -path '*/node_modules' -prune -o \
                    \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.json' \) -newer "$GENERATED_DASH" -print -quit | grep -q .; then
                    need_dash=true
                fi
            fi

            if [[ "$need_dash" == true ]]; then
                (
                    cd "$DASH_DIR" || exit 1
                    npm run docs:generate 2>/dev/null || warn "TypeDoc generation skipped or failed (run 'cd dashboard && npm ci' if needed)"
                )
            fi
        else
            warn "Dashboard node_modules missing - TypeDoc docs not generated (run npm ci in dashboard/)"
        fi
    fi
}

check_config() {
    if [[ ! -f "$MKDOCS_YML" ]]; then
        error "mkdocs.yml not found at $MKDOCS_YML"
        exit 1
    fi
}

open_browser() {
    local url="http://127.0.0.1:${PORT}"
    if [[ "$AUTO_OPEN_BROWSER" == "true" ]]; then
        if command -v python3 &>/dev/null; then
            python3 -m webbrowser "$url" 2>/dev/null || true
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            open "$url" 2>/dev/null || true
        elif command -v xdg-open &>/dev/null; then
            xdg-open "$url" 2>/dev/null || true
        fi
    fi
}

case "${1:-help}" in
    serve)
        shift
        while [[ $# -gt 0 ]]; do
            case "$1" in
                --port)
                    PORT="$2"; shift 2 ;;
                --no-browser)
                    AUTO_OPEN_BROWSER=false; shift ;;
                *)
                    error "Unknown option for serve: $1"; exit 1 ;;
            esac
        done

        if [[ "$AUTO_SETUP_DOCS" == "true" ]]; then
            ensure_docs_env
        else
            activate_venv
        fi
        check_config
        generate_code_docs

        info "Starting Material for MkDocs dev server on port ${PORT}..."
        if [[ "$AUTO_OPEN_BROWSER" == "true" ]]; then
            info "Browser will open automatically (use --no-browser to disable)"
        fi
        open_browser

        # Create a temporary config with site_url overridden so that `mkdocs serve`
        # runs at the root (http://127.0.0.1:PORT/) instead of the GitHub Pages subpath.
        # We place the temp file inside the repo root so that relative paths like
        # docs_dir: docs continue to resolve correctly.
        TMP_SERVE_CONFIG="$(mktemp "$REPO_ROOT/.mkdocs-serve-XXXXXX.yml")"
        sed "s|^site_url:.*|site_url: \"http://127.0.0.1:${PORT}/\"|" "$MKDOCS_YML" > "$TMP_SERVE_CONFIG"

        # Clean up temp config on exit or interrupt
        trap 'rm -f "$TMP_SERVE_CONFIG" 2>/dev/null || true' EXIT INT TERM

        mkdocs serve -f "$TMP_SERVE_CONFIG" --dev-addr "127.0.0.1:${PORT}"
        ;;

    build)
        shift
        STRICT="--strict"
        while [[ $# -gt 0 ]]; do
            case "$1" in
                --no-strict)
                    STRICT=""; shift ;;
                --strict)
                    STRICT="--strict"; shift ;;  # legacy support, already default
                *)
                    error "Unknown option for build: $1"; exit 1 ;;
            esac
        done

        if [[ "$AUTO_SETUP_DOCS" == "true" ]]; then
            ensure_docs_env
        else
            activate_venv
        fi
        check_config
        generate_code_docs

        info "Building documentation (strict mode: ${STRICT:+enabled})..."
        mkdocs build -f "$MKDOCS_YML" $STRICT
        success "Build complete. Output is in site/"
        ;;

    preview)
        if [[ "$AUTO_SETUP_DOCS" == "true" ]]; then
            ensure_docs_env
        else
            activate_venv
        fi
        check_config
        generate_code_docs

        info "Building strict production preview..."
        mkdocs build -f "$MKDOCS_YML" --strict
        success "Serving static site from site/ on port ${PORT}..."
        python3 -m http.server --directory site "$PORT"
        ;;

    deploy)
        if [[ "$AUTO_SETUP_DOCS" == "true" ]]; then
            ensure_docs_env
        else
            activate_venv
        fi
        check_config
        info "Deploying to GitHub Pages..."
        mkdocs gh-deploy -f "$MKDOCS_YML" --force
        success "Deployment complete."
        ;;

    status)
        echo "=== Documentation Status ==="
        echo "mkdocs.yml:          $([ -f "$MKDOCS_YML" ] && echo 'present' || echo 'MISSING')"
        echo "Virtualenv:          $([ -d "$VENV_DIR" ] && echo 'present' || echo 'will be auto-provisioned via official setup-docs.sh')"
        echo "Default port:        $DEFAULT_PORT"
        echo "Auto-open browser:   $AUTO_OPEN_BROWSER"
        if command -v mkdocs &>/dev/null; then
            echo "mkdocs version:      $(mkdocs --version 2>/dev/null || echo 'not in PATH')"
        else
            echo "mkdocs version:      will be provisioned automatically via official setup-docs.sh"
        fi
        ;;

    clean)
        info "Cleaning build artifacts..."
        rm -rf "$REPO_ROOT/site"
        success "Clean complete."
        ;;

    help|*)
        cat << EOF
Usage: $0 {serve|build|preview|deploy|status|clean} [options]

Commands:
  serve     Start live development server with hot reload
            Options: --port 8080    Set custom port
                     --no-browser   Do not auto-open browser
            The docs environment is automatically provisioned by calling
            the official ./docs/setup-docs.sh (quietly) when needed.
  build     Build the documentation site (strict mode by default)
            Options: --no-strict    Disable strict mode
  preview   Build + serve the static site (good final check before commit)
  deploy    Deploy to GitHub Pages
  status    Show current documentation environment status
  clean     Remove the site/ build directory

Examples:
  ./docs/manage-docs.sh serve
  ./docs/manage-docs.sh serve --port 8080 --no-browser
  ./docs/manage-docs.sh build
  ./docs/manage-docs.sh preview
EOF
        ;;
esac
