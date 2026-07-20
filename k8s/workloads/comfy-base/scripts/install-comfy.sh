#!/usr/bin/env bash
#
# ## install-comfy
#
# Install or refresh ComfyUI + custom nodes into PVC (idempotent).
# Mounted into the comfy-install init container via ConfigMap comfy-base-scripts
# (configMapGenerator files: — not inline ConfigMap YAML).
#
set -euo pipefail

COMFY_HOME="${COMFY_HOME:-/comfy-state/ComfyUI}"
COMFY_USER="${COMFY_USER:-1000}"
MODELS_ROOT="${MODELS_ROOT:-/models}"
STAMP="${COMFY_HOME}/.lab-install-complete"
VENV="${COMFY_HOME}/.venv"

# @function log
# Prefix stdout with [comfy-install].
log() { echo "[comfy-install] $*"; }

# @function warn
# Prefix stderr with [comfy-install] WARN.
warn() { echo "[comfy-install] WARN: $*" >&2; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends \
  git git-lfs python3 python3-pip python3-venv python3-dev \
  build-essential curl ca-certificates libgl1 libglib2.0-0 \
  >/dev/null
git lfs install --system >/dev/null 2>&1 || true

mkdir -p /comfy-state
if [[ ! -d "${COMFY_HOME}/.git" ]]; then
  log "Cloning ComfyUI into ${COMFY_HOME}"
  git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git "${COMFY_HOME}"
else
  log "ComfyUI tree present; pulling latest (best-effort)"
  git -C "${COMFY_HOME}" pull --ff-only || warn "git pull failed; continuing with existing tree"
fi

if [[ ! -d "${VENV}" ]]; then
  log "Creating venv"
  python3 -m venv "${VENV}"
fi
# shellcheck disable=SC1091
source "${VENV}/bin/activate"
pip install -U pip setuptools wheel

# PyTorch CUDA 13 aarch64 (GB10 / Blackwell). Index may evolve; pin best-effort.
log "Installing PyTorch (cu130 aarch64 when available)"
pip install --upgrade torch torchvision torchaudio \
  --index-url https://download.pytorch.org/whl/cu130 ||
  pip install --upgrade torch torchvision torchaudio

log "Installing ComfyUI requirements"
pip install -r "${COMFY_HOME}/requirements.txt"
pip install psutil huggingface_hub safetensors einops

CUSTOM="${COMFY_HOME}/custom_nodes"
mkdir -p "${CUSTOM}"

# @function clone_node
# Clone or update a ComfyUI custom node and install its requirements.
clone_node() {
  local url="$1" name="$2"
  if [[ ! -d "${CUSTOM}/${name}/.git" ]]; then
    log "Installing custom node: ${name}"
    git clone --depth 1 "${url}" "${CUSTOM}/${name}" || warn "clone failed: ${name}"
  else
    git -C "${CUSTOM}/${name}" pull --ff-only || true
  fi
  if [[ -f "${CUSTOM}/${name}/requirements.txt" ]]; then
    pip install -r "${CUSTOM}/${name}/requirements.txt" || warn "requirements failed: ${name}"
  fi
}

clone_node "https://github.com/ltdrdata/ComfyUI-Manager.git" "ComfyUI-Manager"
# rs-nodes / residual sampling helpers (best-effort).
clone_node "https://github.com/FlyingFireCo/rs_tools_nodes.git" "rs_tools_nodes" || true
# Nunchaku Comfy nodes (quant kernels; may need GPU at runtime).
clone_node "https://github.com/mit-han-lab/ComfyUI-nunchaku.git" "ComfyUI-nunchaku" ||
  clone_node "https://github.com/nunchaku-tech/ComfyUI-nunchaku.git" "ComfyUI-nunchaku" ||
  warn "Nunchaku custom node unavailable — flux-fast may need manual install"

log "Attempting SageAttention install (fail-soft)"
pip install sageattention || warn "SageAttention pip install failed (optional on aarch64)"

log "Attempting nunchaku python package (fail-soft)"
pip install nunchaku || warn "nunchaku package install failed (optional)"

# @function link_models
# Ensure host model cache dirs exist for a ComfyUI models subfolder.
link_models() {
  local sub="$1"
  mkdir -p "${MODELS_ROOT}/comfy/${sub}" "${COMFY_HOME}/models/${sub}"
  # Prefer host cache if non-empty symlink target; else keep local dir.
  if [[ -d "${MODELS_ROOT}/comfy/${sub}" ]]; then
    # Use bind-style: copy symlink for common top-level folders.
    true
  fi
}
for sub in checkpoints diffusion_models text_encoders vae loras clip clip_vision \
  unet controlnet embeddings upscale_models audio_encoders; do
  link_models "${sub}"
  host_dir="${MODELS_ROOT}/comfy/${sub}"
  comfy_dir="${COMFY_HOME}/models/${sub}"
  mkdir -p "${host_dir}"
  if [[ -L "${comfy_dir}" ]] || [[ ! -e "${comfy_dir}" ]]; then
    rm -rf "${comfy_dir}"
    ln -sfn "${host_dir}" "${comfy_dir}"
  elif [[ -d "${comfy_dir}" && -z "$(ls -A "${comfy_dir}" 2>/dev/null || true)" ]]; then
    rmdir "${comfy_dir}" 2>/dev/null || true
    ln -sfn "${host_dir}" "${comfy_dir}"
  fi
done

log "Applying Spark unified-memory patches"
python3 /patches/patch_get_free_memory.py "${COMFY_HOME}" || warn "patch script failed"

chown -R "${COMFY_USER}:${COMFY_USER}" /comfy-state
touch "${STAMP}"
chown "${COMFY_USER}:${COMFY_USER}" "${STAMP}"
log "Install complete"
