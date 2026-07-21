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
  if [[ -z $target_dir ]]; then
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
      "${target_dir}/.env" 2>/dev/null ||
      sed -i '' 's/^HERMES_DASHBOARD_BASIC_AUTH_USERNAME=.*/HERMES_DASHBOARD_BASIC_AUTH_USERNAME=coder/' \
        "${target_dir}/.env"
    rm -f "${target_dir}/.env.bak"
  fi

  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/workspace_hermes_workspace_hermes_seed_data_dir.py" "${target_dir}/.env"

  hermes_render_config "$(workspace_hermes_stack_id)" "${target_dir}/config.yaml" "in_cluster"
  log "Seeded workspace Hermes data at ${target_dir}"
}

# @function workspace_hermes_render_config
workspace_hermes_render_config() {
  local target_dir="${1:-}"
  if [[ -z $target_dir ]]; then
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
  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/workspace_hermes_get_workspace_hermes_status_json.py" "$(hermes_policy_path)" "$(workspace_hermes_profile_dir)"
}
