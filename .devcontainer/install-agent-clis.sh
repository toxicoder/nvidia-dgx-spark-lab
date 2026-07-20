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
#   - Auth is interactive after install, and only when the user runs the tools
#     (`grok login`, `hermes setup`). Create-time install never runs setup wizards.
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

Auth (user-initiated only after install — never committed, not during create):
  grok login          # or set GROK_DEPLOYMENT_KEY only in your shell session
  hermes setup        # only when you want to use Hermes (provider/model under ~/.hermes)

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

# @function ensure_agent_homes
# Make ~/.grok and ~/.hermes writable for vscode (named volume ownership).
#
# Empty Docker named volumes over these paths are often root-owned. The official
# grok installer always writes under ~/.grok (downloads/bin/auth) even when
# GROK_BIN_DIR points the binary at ~/.local/bin. Fix ownership before install.
ensure_agent_homes() {
  local dir
  mkdir -p "${HOME}/.local/bin" 2>/dev/null || true
  for dir in "${HOME}/.grok" "${HOME}/.hermes"; do
    if [[ ! -d ${dir} ]]; then
      if ! mkdir -p "${dir}" 2>/dev/null; then
        if command -v sudo >/dev/null 2>&1; then
          sudo mkdir -p "${dir}" || true
          sudo chown "$(id -u):$(id -g)" "${dir}" || true
        else
          echo "install-agent-clis: cannot create ${dir} (permission denied; no sudo)" >&2
        fi
      fi
    fi
    if [[ -d ${dir} ]] && [[ ! -w ${dir} ]]; then
      echo "install-agent-clis: ${dir} not writable (likely root-owned volume); fixing ownership" >&2
      if command -v sudo >/dev/null 2>&1; then
        if ! sudo chown -R "$(id -u):$(id -g)" "${dir}"; then
          echo "install-agent-clis: chown failed for ${dir}; installers may fail" >&2
        fi
      else
        echo "install-agent-clis: ${dir} not writable and sudo unavailable" >&2
        echo "install-agent-clis: host fix: docker volume rm dgx-lab-grok-home dgx-lab-hermes-home then rebuild" >&2
      fi
    fi
  done
}

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
    echo "install-agent-clis: grok install failed (network, installer, or ~/.grok not writable)" >&2
    echo 'install-agent-clis: if Permission denied under ~/.grok, run: sudo chown -R "$(id -u):$(id -g)" ~/.grok ~/.hermes' >&2
    echo "install-agent-clis: or on host: docker volume rm dgx-lab-grok-home dgx-lab-hermes-home && rebuild container" >&2
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
  # Install CLI only during create — never run the interactive Blank Slate wizard.
  # Users run `hermes setup` (or first interactive `hermes`) when they need it.
  # Never pass secrets.
  if ! curl -fsSL https://hermes-agent.nousresearch.com/install.sh |
    bash -s -- --skip-setup --non-interactive; then
    echo "install-agent-clis: hermes install failed (network, installer, or ~/.hermes not writable)" >&2
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

ensure_agent_homes
install_grok
install_hermes

echo "install-agent-clis: done (auth is interactive — never commit keys)"
exit 0
