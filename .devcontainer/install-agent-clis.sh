#!/usr/bin/env bash
#
# ## Install Grok Build + Hermes Agent CLIs (privacy-safe)
#
# Installs official contributor CLIs into the multi-arch Linux devcontainer:
#   - Grok Build (`grok`) — https://github.com/xai-org/grok-build
#     installer: https://x.ai/cli/install.sh
#   - Hermes Agent (`hermes`) — https://github.com/NousResearch/hermes-agent
#     installer: https://hermes-agent.nousresearch.com/install.sh
#
# Privacy:
#   - Never writes API keys, GROK_DEPLOYMENT_KEY, or model credentials.
#   - Never prints environment variables or auth files.
#   - Auth is interactive after install (`grok login`, `hermes setup`).
#   - Home dirs ~/.grok and ~/.hermes are volume-mounted (see devcontainer.json).
#
# Usage:
#   bash .devcontainer/install-agent-clis.sh
#   bash .devcontainer/install-agent-clis.sh --help
#   DEVCONTAINER_SKIP_AGENT_CLIS=1 bash .devcontainer/install-agent-clis.sh
#   FORCE_AGENT_CLI_INSTALL=1 bash .devcontainer/install-agent-clis.sh
#
# @command install-agent-clis
set -euo pipefail

SKIP="${DEVCONTAINER_SKIP_AGENT_CLIS:-0}"
FORCE="${FORCE_AGENT_CLI_INSTALL:-0}"

usage() {
  cat <<'EOF'
Usage: install-agent-clis.sh [--help]

Install Grok Build (grok) and Hermes Agent (hermes) CLIs for contributor use.

Environment:
  DEVCONTAINER_SKIP_AGENT_CLIS=1   Skip both installs
  FORCE_AGENT_CLI_INSTALL=1        Re-run installers even if commands exist

Auth (after install — never committed):
  grok login          # or set GROK_DEPLOYMENT_KEY only in your shell session
  hermes setup        # interactive provider/model config under ~/.hermes

See docs/dev-environment.md and SECURITY.md.
EOF
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if [[ ${SKIP} == "1" ]]; then
  echo "install-agent-clis: skipped (DEVCONTAINER_SKIP_AGENT_CLIS=1)" >&2
  exit 0
fi

export PATH="${HOME}/.local/bin:${HOME}/.hermes/bin:${PATH}"

# @function install_grok
# Install Grok Build CLI via official installer when missing.
install_grok() {
  if command -v grok >/dev/null 2>&1 && [[ ${FORCE} != "1" ]]; then
    echo "install-agent-clis: grok already on PATH ($(command -v grok))"
    return 0
  fi
  echo "install-agent-clis: installing Grok Build CLI (https://github.com/xai-org/grok-build)"
  # GROK_BIN_DIR keeps binary under user-local path (no root).
  export GROK_BIN_DIR="${GROK_BIN_DIR:-${HOME}/.local/bin}"
  mkdir -p "${GROK_BIN_DIR}"
  if ! curl -fsSL https://x.ai/cli/install.sh | bash; then
    echo "install-agent-clis: grok install failed (network or installer); continue without grok" >&2
    return 0
  fi
  if command -v grok >/dev/null 2>&1; then
    echo "install-agent-clis: grok ready ($(grok --version 2>/dev/null || echo installed))"
  else
    echo "install-agent-clis: grok binary not on PATH after install; ensure ${GROK_BIN_DIR} is on PATH" >&2
  fi
}

# @function install_hermes
# Install Hermes Agent CLI via official installer when missing.
install_hermes() {
  if command -v hermes >/dev/null 2>&1 && [[ ${FORCE} != "1" ]]; then
    echo "install-agent-clis: hermes already on PATH ($(command -v hermes))"
    return 0
  fi
  echo "install-agent-clis: installing Hermes Agent CLI (https://github.com/NousResearch/hermes-agent)"
  # Official installer is interactive-friendly; non-interactive flags vary by version.
  # Prefer bare install; never pass secrets.
  if ! curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash; then
    echo "install-agent-clis: hermes install failed (network or installer); continue without hermes" >&2
    return 0
  fi
  # Managed installs often put hermes under ~/.local/bin or ~/.hermes
  export PATH="${HOME}/.local/bin:${HOME}/.hermes/bin:${PATH}"
  if command -v hermes >/dev/null 2>&1; then
    echo "install-agent-clis: hermes ready"
  else
    # Common post-install location for managed layout
    if [[ -x "${HOME}/.hermes/hermes-agent/venv/bin/hermes" ]]; then
      mkdir -p "${HOME}/.local/bin"
      ln -sfn "${HOME}/.hermes/hermes-agent/venv/bin/hermes" "${HOME}/.local/bin/hermes" 2>/dev/null || true
    fi
    if command -v hermes >/dev/null 2>&1; then
      echo "install-agent-clis: hermes ready (linked to ~/.local/bin)"
    else
      echo "install-agent-clis: hermes not on PATH after install; open a new shell or check ~/.hermes" >&2
    fi
  fi
}

install_grok
install_hermes

echo "install-agent-clis: done (auth is interactive — never commit keys)"
exit 0
