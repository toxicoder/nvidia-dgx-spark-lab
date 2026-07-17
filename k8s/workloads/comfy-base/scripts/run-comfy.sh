#!/usr/bin/env bash
#
# ## run-comfy
#
# Launch ComfyUI from PVC install (non-root).
# Mounted into the comfyui container via ConfigMap comfy-base-scripts
# (configMapGenerator files: — not inline ConfigMap YAML).
#
set -euo pipefail

COMFY_HOME="${COMFY_HOME:-/comfy-state/ComfyUI}"
VENV="${COMFY_HOME}/.venv"
if [[ ! -x "${VENV}/bin/python" ]]; then
  echo "[comfy-run] ERROR: venv missing at ${VENV}; init container failed?" >&2
  exit 1
fi
# shellcheck disable=SC1091
source "${VENV}/bin/activate"
# Re-apply patch in case ComfyUI was upgraded in PVC without re-init stamp.
if [[ -f /patches/patch_get_free_memory.py ]]; then
  python3 /patches/patch_get_free_memory.py "${COMFY_HOME}" || true
fi
cd "${COMFY_HOME}"
export PYTORCH_CUDA_ALLOC_CONF="${PYTORCH_CUDA_ALLOC_CONF:-expandable_segments:True}"
exec python main.py --listen 0.0.0.0 --port 8188
