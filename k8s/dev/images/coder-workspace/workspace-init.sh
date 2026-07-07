#!/usr/bin/env bash
# Post-start wiring for Coder dev container (Hermes sidecar in same pod).
set -euo pipefail

MCP_EXAMPLE="${MCP_EXAMPLE:-/etc/spark-lab/coder-workspace.mcp.json.example}"
CURSOR_MCP="${HOME}/.cursor/mcp.json"
VSCODE_MCP="${HOME}/.vscode/mcp.json"

mkdir -p "$(dirname "$CURSOR_MCP")" "$(dirname "$VSCODE_MCP")"

if [[ -f "$MCP_EXAMPLE" ]]; then
  cp "$MCP_EXAMPLE" "$CURSOR_MCP"
  cp "$MCP_EXAMPLE" "$VSCODE_MCP"
fi

export HERMES_GATEWAY_URL="${HERMES_GATEWAY_URL:-http://127.0.0.1:8642/v1}"
export HERMES_DASHBOARD_URL="${HERMES_DASHBOARD_URL:-http://127.0.0.1:9119}"

for i in $(seq 1 60); do
  if curl -sf "${HERMES_GATEWAY_URL}/models" -H "Authorization: Bearer ${HERMES_API_KEY:-}" >/dev/null 2>&1 \
    || curl -sf "${HERMES_GATEWAY_URL}/models" >/dev/null 2>&1; then
    echo "Hermes gateway ready at ${HERMES_GATEWAY_URL}"
    exit 0
  fi
  sleep 2
done

echo "Hermes gateway not ready yet — sidecar may still be starting" >&2
exit 0