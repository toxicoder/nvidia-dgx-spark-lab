#!/usr/bin/env bats
#
# Hermetic tests for lab domain configuration and render pipeline.

load 'test_helper'

setup() {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  # shellcheck disable=SC1090
  source "${REPO_ROOT}/scripts/lib/paths.sh"
  source "${REPO_ROOT}/scripts/lib/common.sh"
  source "${REPO_ROOT}/scripts/lib/domains.sh"
}

# @function _restore_domain_artifacts
# Restore tracked generated domain artifacts after render pipeline tests.
_restore_domain_artifacts() {
  if ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi
  git -C "$REPO_ROOT" checkout -- \
    config/lab-domains.json \
    k8s/auth/generated \
    k8s/cert-manager/generated \
    ansible/files/generated 2>/dev/null || true
}

teardown() {
  _restore_domain_artifacts
}

@test "lab_local_domain defaults to lab.local" {
  run lab_local_domain
  [ "$status" -eq 0 ]
  [ "$output" = "lab.local" ]
}

@test "lab_fqdn builds dashboard host" {
  run lab_fqdn dashboard local
  [ "$status" -eq 0 ]
  [ "$output" = "dashboard.lab.local" ]
}

@test "lab_service_url includes https port for local domain" {
  run lab_service_url dashboard "/" local
  [ "$status" -eq 0 ]
  [[ "$output" == https://dashboard.lab.local:32443/ ]]
}

@test "render-domains generates auth routes manifest" {
  run bash "${REPO_ROOT}/scripts/utilities/render-domains.sh"
  [ "$status" -eq 0 ]
  [ -f "${REPO_ROOT}/k8s/auth/generated/routes.yaml" ]
  grep -q 'Host(`dashboard.lab.local`)' "${REPO_ROOT}/k8s/auth/generated/routes.yaml"
  grep -q '# Purpose:' "${REPO_ROOT}/k8s/cert-manager/kustomization.yaml"
}

@test "domains show prints local domain" {
  run bash "${REPO_ROOT}/scripts/manage.sh" domains show
  [ "$status" -eq 0 ]
  [[ "$output" == *"local_domain:  lab.local"* ]]
}

@test "render with public domain emits ACME issuer" {
  local tmp="$BATS_TMPDIR/lab-domains-test.yaml"
  cp "${REPO_ROOT}/config/lab-domains.yaml" "$tmp"
  python3 - "$tmp" <<'PY'
import yaml
from pathlib import Path
p = Path(__import__("sys").argv[1])
cfg = yaml.safe_load(p.read_text())
cfg["public_domain"] = "mydomain.com"
cfg.setdefault("tls", {})["acme_email"] = "ops@mydomain.com"
p.write_text(yaml.dump(cfg, default_flow_style=False, sort_keys=False))
PY
  LAB_DOMAINS_CONFIG="$tmp" run env LAB_PUBLIC_DOMAIN=mydomain.com LAB_ACME_EMAIL=ops@mydomain.com \
    python3 -c "
import os, sys
sys.path.insert(0, '${REPO_ROOT}/scripts/lib')
os.environ['REPO_ROOT'] = '${REPO_ROOT}'
from render_domains import apply_env, load_yaml, render_certificates
from pathlib import Path
root = Path('${REPO_ROOT}')
cfg = apply_env(load_yaml(root / 'config' / 'lab-domains.yaml'))
cfg['public_domain'] = 'mydomain.com'
cfg.setdefault('tls', {})['acme_email'] = 'ops@mydomain.com'
render_certificates(cfg, root)
"
  [ "$status" -eq 0 ]
  [ -f "${REPO_ROOT}/k8s/cert-manager/generated/cluster-issuer-acme.yaml" ]
  grep -q 'letsencrypt-prod' "${REPO_ROOT}/k8s/cert-manager/generated/cluster-issuer-acme.yaml"
  bash "${REPO_ROOT}/scripts/utilities/render-domains.sh" >/dev/null
}