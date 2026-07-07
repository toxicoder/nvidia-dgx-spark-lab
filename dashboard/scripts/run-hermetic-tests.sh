#!/usr/bin/env bash
#
# ## Hermetic dashboard test runner (Docker)
#
# Build `dashboard/Dockerfile.test` and run the full isolated dashboard test
# suite (Vitest, Next.js build, lint/typecheck, Playwright visual regression).
# Goldens are bind-mounted so snapshot updates persist on the host.
#
# **Safety**:
# - Read-only test orchestration; does not touch cluster workloads.
# - Requires a running Docker daemon (Docker Desktop on macOS).
#
# Usage:
#   ./dashboard/scripts/run-hermetic-tests.sh
#   UPDATE_SNAPSHOTS=1 ./dashboard/scripts/run-hermetic-tests.sh
#   bazelisk run //dashboard:hermetic-test
#
# Environment:
#   LAB_DASHBOARD_TEST_IMAGE  Docker image tag (default: lab-dashboard-test:local)
#   UPDATE_SNAPSHOTS          Set to 1 to refresh Playwright visual goldens
#
set -euo pipefail

if [[ -n "${BUILD_WORKSPACE_DIRECTORY:-}" ]]; then
  ROOT="${BUILD_WORKSPACE_DIRECTORY}"
else
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi
IMAGE="${LAB_DASHBOARD_TEST_IMAGE:-lab-dashboard-test:local}"

cd "$ROOT"

if ! docker info >/dev/null 2>&1; then
  echo "hermetic-test: Docker daemon unavailable. Start/restart Docker Desktop, then retry." >&2
  exit 1
fi

echo "==> Building hermetic test image: $IMAGE"
if ! docker build -t "$IMAGE" -f dashboard/Dockerfile.test .; then
  echo "hermetic-test: docker build failed. If you see containerd meta.db I/O errors, restart Docker Desktop and retry." >&2
  exit 1
fi

GOLDENS_DIR="$ROOT/dashboard/tests/visual/goldens"
mkdir -p "$GOLDENS_DIR"

MODE="${DASHBOARD_TEST_MODE:-full}"
echo "==> Running hermetic tests in container (DASHBOARD_TEST_MODE=$MODE)"
docker run --rm \
  -e UPDATE_SNAPSHOTS="${UPDATE_SNAPSHOTS:-0}" \
  -e DASHBOARD_TEST_MODE="$MODE" \
  -e CI=1 \
  -v "$GOLDENS_DIR:/app/tests/visual/goldens" \
  "$IMAGE"