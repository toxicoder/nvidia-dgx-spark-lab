#!/usr/bin/env bash
# Hermetic manifest exercise registry — every k8s/helm/ansible/config file
# must map to a validation target (kubeconform, safety_invariants, ansible, helm).
set -euo pipefail

ROOT="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$ROOT"
exec python3 "$ROOT/tests/manifest_coverage.py"