#!/usr/bin/env bash
#
# ## install-operator-client
#
# One-command bootstrap for the operator client — the machine that runs
# Ansible against the Sparks and drives `manage.sh` / Bazel (macOS, Linux,
# or WSL2 on Windows). Installs and verifies: git, ssh, python3,
# Ansible >= 2.14, kubectl, helm, bazelisk, jq.
#
# Idempotent: tools already on PATH are skipped. macOS uses Homebrew (no
# sudo); Linux uses apt/dnf; Windows uses the WSL2 path
# (scripts/utilities/install-operator-client.ps1) and fails here with a
# pointer to it.
#
# Usage:
#   ./scripts/utilities/install-operator-client.sh status
#   ./scripts/utilities/install-operator-client.sh run
#   bazelisk run //scripts:run-utility -- install-operator-client status
#
# @command install-operator-client
set -euo pipefail

CMD="${1:-status}"

# Tools the operator client needs; `ansible` additionally needs >= 2.14.
REQUIRED_TOOLS=(git ssh python3 ansible kubectl helm bazelisk jq)
MIN_ANSIBLE="2.14"

# @function operator_client_os
# Detect the host OS for the install path: Darwin | Linux | Windows.
# Honors LAB_OPERATOR_CLIENT_OS (test override); WSL reports as Linux.
operator_client_os() {
  if [[ -n ${LAB_OPERATOR_CLIENT_OS:-} ]]; then
    echo "$LAB_OPERATOR_CLIENT_OS"
    return 0
  fi
  local os
  os="$(uname -s)"
  case "$os" in
    Darwin) echo "Darwin" ;;
    Linux) echo "Linux" ;;
    MINGW* | MSYS* | CYGWIN*) echo "Windows" ;;
    *) echo "Windows" ;;
  esac
}

# @function tool_present
# True when the named tool is on PATH.
tool_present() {
  command -v "$1" >/dev/null 2>&1
}

# @function tool_version
# Print a short version line for a tool, or "unknown".
tool_version() {
  local tool="$1"
  case "$tool" in
    ansible) ansible --version 2>/dev/null | head -n1 || echo "unknown" ;;
    kubectl) kubectl version --client 2>/dev/null | head -n1 || echo "unknown" ;;
    helm) helm version --short 2>/dev/null || echo "unknown" ;;
    jq) jq --version 2>/dev/null || echo "unknown" ;;
    git) git --version 2>/dev/null || echo "unknown" ;;
    python3) python3 --version 2>/dev/null || echo "unknown" ;;
    *) echo "unknown" ;;
  esac
}

# @function ansible_version_ok
# True when ansible is present and its core version is >= MIN_ANSIBLE.
ansible_version_ok() {
  local ver
  ver="$(ansible --version 2>/dev/null | sed -n 's/^ansible \[core \([0-9][0-9.]*\).*/\1/p' | head -n1)"
  [[ -n $ver ]] || return 1
  [[ "$(printf '%s\n%s\n' "$ver" "$MIN_ANSIBLE" | sort -V | head -n1)" == "$MIN_ANSIBLE" ]]
}

# @function cmd_status
# Report which operator-client tools are ready; always exits 0.
cmd_status() {
  echo "Operator Client Status"
  echo "Host: $(uname -s) / $(uname -m) (install path: $(operator_client_os))"
  echo ""
  local t missing=0
  for t in "${REQUIRED_TOOLS[@]}"; do
    if [[ $t == "ansible" ]]; then
      if ansible_version_ok; then
        echo "  OK  ${t} (>= ${MIN_ANSIBLE}, $(tool_version ansible))"
      elif tool_present ansible; then
        echo "  --  ${t} present but older than ${MIN_ANSIBLE} ($(tool_version ansible))"
        missing=1
      else
        echo "  --  ${t} (need >= ${MIN_ANSIBLE})"
        missing=1
      fi
      continue
    fi
    if tool_present "$t"; then
      echo "  OK  ${t} ($(tool_version "$t"))"
    else
      echo "  --  ${t}"
      missing=1
    fi
  done
  echo ""
  if [[ $missing -eq 0 ]]; then
    echo "Operator client is ready: 'bazelisk run //:manage -- setup'."
  else
    echo "Tools above marked '--' are missing — run: ./scripts/utilities/install-operator-client.sh run"
  fi
}

# @function brew_install_tool
# Install one tool via Homebrew (macOS); $1 = tool name.
brew_install_tool() {
  local formula
  case "$1" in
    ssh) formula="openssh" ;;
    python3) formula="python" ;;
    *) formula="$1" ;;
  esac
  brew install --formula "$formula"
}

# @function linux_install_tool
# Install one tool on Linux; $1 = tool name. Uses apt/dnf when available,
# official downloads otherwise.
linux_install_tool() {
  local tool="$1"
  case "$tool" in
    git | ssh | python3 | jq | ansible)
      if command -v apt-get >/dev/null 2>&1; then
        local pkg
        case "$tool" in
          ssh) pkg="openssh-client" ;;
          python3) pkg="python3" ;;
          *) pkg="$tool" ;;
        esac
        sudo apt-get install -y -qq "$pkg"
      elif command -v dnf >/dev/null 2>&1; then
        local pkg
        case "$tool" in
          ssh) pkg="openssh-clients" ;;
          python3) pkg="python3" ;;
          *) pkg="$tool" ;;
        esac
        sudo dnf install -y -q "$pkg"
      else
        echo "  ! no supported package manager (apt-get/dnf) for ${tool}" >&2
        return 1
      fi
      ;;
    kubectl)
      local arch
      arch="$(uname -m)"
      case "$arch" in
        x86_64) arch="amd64" ;;
        aarch64 | arm64) arch="arm64" ;;
      esac
      local url="https://dl.k8s.io/release/v1.31.0/bin/linux/${arch}/kubectl"
      curl -fsSL -o /tmp/kubectl "$url"
      sudo install -m 0755 /tmp/kubectl /usr/local/bin/kubectl
      rm -f /tmp/kubectl
      ;;
    helm)
      local ver="v3.15.2" arch
      arch="$(uname -m)"
      case "$arch" in
        x86_64) arch="amd64" ;;
        aarch64 | arm64) arch="arm64" ;;
      esac
      curl -fsSL -o /tmp/helm.tar.gz "https://get.helm.sh/helm-${ver}-linux-${arch}.tar.gz"
      sudo tar -xzf /tmp/helm.tar.gz -C /tmp linux-"$arch"/helm
      sudo install -m 0755 "/tmp/linux-${arch}/helm" /usr/local/bin/helm
      rm -rf "/tmp/linux-${arch}" /tmp/helm.tar.gz
      ;;
    bazelisk)
      local arch
      arch="$(uname -m)"
      case "$arch" in
        x86_64) arch="amd64" ;;
        aarch64 | arm64) arch="arm64" ;;
      esac
      curl -fsSL -o /tmp/bazelisk "https://github.com/bazelbuild/bazelisk/releases/latest/download/bazelisk-linux-${arch}"
      sudo install -m 0755 /tmp/bazelisk /usr/local/bin/bazelisk
      rm -f /tmp/bazelisk
      ;;
  esac
}

# @function cmd_run
# Install any missing operator-client tools, then verify; exits non-zero if
# anything is still missing after the install attempt.
cmd_run() {
  local os
  os="$(operator_client_os)"
  echo "=== Operator client install (${os}) ==="
  case "$os" in
    Darwin)
      if ! command -v brew >/dev/null 2>&1; then
        echo "Homebrew not found. Install it first (https://brew.sh) or use the devcontainer." >&2
        exit 1
      fi
      local t
      for t in "${REQUIRED_TOOLS[@]}"; do
        if [[ $t == "ansible" ]] && ansible_version_ok; then
          continue
        fi
        if [[ $t != "ansible" ]] && tool_present "$t"; then
          continue
        fi
        echo "→ brew install ${t}"
        brew_install_tool "$t"
      done
      ;;
    Linux)
      local t
      # Single package-index refresh for the whole run.
      if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update -qq
      fi
      for t in "${REQUIRED_TOOLS[@]}"; do
        if [[ $t == "ansible" ]] && ansible_version_ok; then
          continue
        fi
        if [[ $t != "ansible" ]] && tool_present "$t"; then
          continue
        fi
        echo "→ install ${t}"
        linux_install_tool "$t" || echo "  ! ${t} install failed (best effort)" >&2
      done
      ;;
    *)
      echo "This script runs inside macOS/Linux/WSL. On Windows, first run:" >&2
      echo '  powershell -ExecutionPolicy Bypass -File .\scripts\utilities\install-operator-client.ps1' >&2
      echo "then re-run this script from inside WSL (Ubuntu)." >&2
      exit 1
      ;;
  esac
  echo ""
  cmd_status
  # Fail if any required tool is still missing.
  local t still=0
  for t in "${REQUIRED_TOOLS[@]}"; do
    if [[ $t == "ansible" ]]; then
      ansible_version_ok || still=1
      continue
    fi
    tool_present "$t" || still=1
  done
  if [[ $still -eq 1 ]]; then
    echo "Operator client not ready — install the missing tools manually, then re-run 'status'." >&2
    exit 1
  fi
  echo ""
  echo "Done. Next: cd into the lab repo and run 'bazelisk run //:manage -- setup'."
}

case "${CMD}" in
  status) cmd_status ;;
  run) cmd_run ;;
  -h | --help | help)
    echo "Usage: install-operator-client.sh status|run"
    ;;
  *)
    echo "Unknown command: ${CMD}" >&2
    echo "Usage: install-operator-client.sh status|run" >&2
    exit 1
    ;;
esac
