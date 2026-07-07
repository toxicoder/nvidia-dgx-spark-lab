#!/usr/bin/env bash
# Smoke-test helm/lab-dashboard chart rendering (hermetic; no cluster required).
set -euo pipefail

ROOT="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$ROOT"

if ! command -v helm >/dev/null 2>&1; then
  echo "chart_test: helm not found in PATH" >&2
  exit 1
fi

CHART="${ROOT}/helm/lab-dashboard"
VALUES="${CHART}/values.yaml"
OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT

helm template lab-dashboard "$CHART" --values "$VALUES" >"$OUT"

for kind in Deployment Service; do
  if ! grep -q "^kind: ${kind}$" "$OUT"; then
    echo "chart_test: expected kind ${kind} in helm template output" >&2
    exit 1
  fi
done

echo "chart_test: helm/lab-dashboard renders Deployment + Service"