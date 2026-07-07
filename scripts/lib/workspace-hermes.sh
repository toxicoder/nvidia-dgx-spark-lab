#!/usr/bin/env bash
#
# ## Hermes workspace dev assistant
#
# Seed and render helpers for Coder and Kasm workspace Hermes profiles.

# @function workspace_hermes_profile_dir
workspace_hermes_profile_dir() {
  echo "$(_hermes_repo_root)/hermes/profiles/workspace-dev"
}

# @function workspace_hermes_stack_id
workspace_hermes_stack_id() {
  echo "hermes-workspace-dev"
}

# @function workspace_hermes_seed_data_dir
# Copy profile distribution into target Hermes data directory.
workspace_hermes_seed_data_dir() {
  local target_dir="${1:-}"
  local profile_dir root
  if [[ -z "$target_dir" ]]; then
    err "workspace_hermes_seed_data_dir: target directory required"
    return 1
  fi
  profile_dir=$(workspace_hermes_profile_dir)
  root="$(_hermes_repo_root)"
  mkdir -p "${target_dir}"

  for f in config.yaml SOUL.md mcp.json distribution.yaml; do
    if [[ -f "${profile_dir}/${f}" ]]; then
      cp "${profile_dir}/${f}" "${target_dir}/${f}"
    fi
  done

  if [[ ! -f "${target_dir}/.env" ]]; then
    cp "${root}/hermes/config/env.example" "${target_dir}/.env"
    sed -i.bak 's/^HERMES_DASHBOARD_BASIC_AUTH_USERNAME=.*/HERMES_DASHBOARD_BASIC_AUTH_USERNAME=coder/' \
      "${target_dir}/.env" 2>/dev/null || \
      sed -i '' 's/^HERMES_DASHBOARD_BASIC_AUTH_USERNAME=.*/HERMES_DASHBOARD_BASIC_AUTH_USERNAME=coder/' \
      "${target_dir}/.env"
    rm -f "${target_dir}/.env.bak"
  fi

  python3 - "${target_dir}/.env" <<'PY'
import re, subprocess, sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()
changed = False

def ensure_key(name):
    global changed, text
    m = re.search(rf'^{re.escape(name)}=(.*)$', text, re.M)
    if not m or not m.group(1).strip():
        val = subprocess.check_output(["openssl", "rand", "-hex", "32"], text=True).strip()
        if m:
            text = re.sub(rf'^{re.escape(name)}=.*$', f'{name}={val}', text, count=1, flags=re.M)
        else:
            text = text.rstrip() + f'\n{name}={val}\n'
        changed = True
    return text

for key in (
    "API_SERVER_KEY",
    "HERMES_DASHBOARD_BASIC_AUTH_SECRET",
    "HERMES_DASHBOARD_BASIC_AUTH_PASSWORD",
):
    text = ensure_key(key)

if changed:
    path.write_text(text)
PY

  hermes_render_config "$(workspace_hermes_stack_id)" "${target_dir}/config.yaml" "in_cluster"
  log "Seeded workspace Hermes data at ${target_dir}"
}

# @function workspace_hermes_render_config
workspace_hermes_render_config() {
  local target_dir="${1:-}"
  if [[ -z "$target_dir" ]]; then
    err "workspace_hermes_render_config: target directory required"
    return 1
  fi
  mkdir -p "${target_dir}"
  if [[ ! -f "${target_dir}/config.yaml" ]]; then
    cp "$(workspace_hermes_profile_dir)/config.yaml" "${target_dir}/config.yaml"
  fi
  hermes_render_config "$(workspace_hermes_stack_id)" "${target_dir}/config.yaml" "in_cluster"
}

# @function workspace_hermes_verify_prerequisites
workspace_hermes_verify_prerequisites() {
  hermes_check_prerequisites "$(workspace_hermes_stack_id)"
}

# @function get_workspace_hermes_status_json
get_workspace_hermes_status_json() {
  python3 - "$(hermes_policy_path)" "$(workspace_hermes_profile_dir)" <<'PY'
import json, sys
from pathlib import Path

def load_yaml(path):
    try:
        import yaml
        return yaml.safe_load(Path(path).read_text()) or {}
    except Exception:
        return {}

policy = load_yaml(sys.argv[1])
profile_dir = Path(sys.argv[2])
stack_id = "hermes-workspace-dev"
stack = policy.get("stacks", {}).get(stack_id, {})
mode = policy.get("url_modes", {}).get(stack.get("mcp_url_mode", "in_cluster"), {})

print(json.dumps({
    "stack": stack_id,
    "profile_dir": str(profile_dir),
    "profile_files": sorted(p.name for p in profile_dir.iterdir() if p.is_file()),
    "url_mode": stack.get("mcp_url_mode"),
    "inference_template": mode.get("inference_base_url_template"),
    "mcp_servers": list(stack.get("mcp_servers", [])),
}))
PY
}