#!/usr/bin/env bash
# Start Hermes workspace-dev gateway after Kasm desktop is ready.
set -euo pipefail

HERMES_HOME="${HERMES_HOME:-/home/kasm-user/.hermes-workspace}"
SEED_DIR="${HERMES_SEED_DIR:-/opt/spark-lab/hermes-seed}"
LOG_FILE="${HERMES_HOME}/logs/workspace-gateway.log"

mkdir -p "${HERMES_HOME}/logs"

if [[ ! -f "${HERMES_HOME}/config.yaml" && -d "${SEED_DIR}" ]]; then
  cp -a "${SEED_DIR}/." "${HERMES_HOME}/"
fi

if [[ ! -f "${HERMES_HOME}/.env" ]]; then
  cat >"${HERMES_HOME}/.env" <<EOF
API_SERVER_KEY=$(openssl rand -hex 32)
HERMES_DASHBOARD_BASIC_AUTH_USERNAME=kasm
HERMES_DASHBOARD_BASIC_AUTH_PASSWORD=$(openssl rand -hex 16)
HERMES_DASHBOARD_BASIC_AUTH_SECRET=$(openssl rand -hex 32)
OPENAI_API_KEY=none
EOF
fi

export HERMES_HOME
export HERMES_DASHBOARD=1
export API_SERVER_ENABLED=true
export API_SERVER_HOST=0.0.0.0

if pgrep -f "gateway run" >/dev/null 2>&1; then
  exit 0
fi

/usr/bin/desktop_ready

nohup /opt/hermes/.venv/bin/hermes gateway run >>"${LOG_FILE}" 2>&1 &
disown || true