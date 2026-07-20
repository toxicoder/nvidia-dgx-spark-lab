#!/usr/bin/env bash
#
# ## SSO stack helpers
#
# Traefik v3 + cert-manager + Authelia + oauth2-proxy deploy helpers.
# Policy: config/sso-policy.yaml

if ! declare -F lab_repo_root >/dev/null 2>&1; then
  # shellcheck source=paths.sh disable=SC1091
  source "$(dirname "${BASH_SOURCE[0]:-${0}}")/paths.sh"
fi

# @function sso_policy_path
sso_policy_path() {
  echo "$(lab_repo_root)/config/sso-policy.yaml"
}

# @function sso_domain
# Deprecated alias — returns local apex domain (lab.local by default).
sso_domain() {
  if type lab_local_domain &>/dev/null; then
    lab_local_domain
  else
    echo "${LAB_SSO_DOMAIN:-lab.local}"
  fi
}

# @function sso_enabled
sso_enabled() {
  [[ "${SSO_ENABLED:-1}" == "1" ]]
}

# @function ensure_sso_namespaces
ensure_sso_namespaces() {
  kubectl apply -f "${REPO_ROOT}/k8s/base/namespaces-sso.yaml"
}

# @function require_helm
require_helm() {
  if ! command -v helm &>/dev/null; then
    err "helm not found in PATH"
    exit 1
  fi
}

# @function _sso_policy_value
_sso_policy_value() {
  local key="$1"
  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/sso_sso_policy_value.py" "$(sso_policy_path)" "$key"
}

# @function ensure_sso_secrets
# Generates Authelia + oauth2-proxy secrets if missing.
ensure_sso_secrets() {
  require_kubectl
  ensure_sso_namespaces

  if kubectl get secret authelia-secrets -n auth &>/dev/null; then
    log "authelia-secrets already exists in auth namespace"
  else
    local storage_key oidc_hmac cookie_secret coder_secret headlamp_secret oauth_secret
    storage_key=$(openssl rand -hex 32)
    oidc_hmac=$(openssl rand -hex 32)
    cookie_secret=$(openssl rand -base64 32 | tr -d '\n')
    coder_secret=$(openssl rand -hex 16)
    headlamp_secret=$(openssl rand -hex 16)
    oauth_secret=$(openssl rand -hex 16)

    # Default admin password: changeme-on-first-login (argon2 hash generated at deploy time via authelia cli or preset)
    kubectl create secret generic authelia-secrets -n auth \
      --from-literal=users_database.yml="$(cat <<EOF
users:
  admin:
    displayname: Lab Admin
    password: "\$argon2id\$v=19\$m=65536,t=3,p=4\$dGVzdHNhbHQ\$8K1p/a0dL1kCz0Wj8V5h8u0Y0Y0Y0Y0Y0Y0Y0Y0Y0Y0"
    email: admin@$(lab_email_domain 2>/dev/null || echo "lab.local")
    groups:
      - admins
      - devs
EOF
)" \
      --from-literal=storage_encryption_key="${storage_key}" \
      --from-literal=oidc_hmac_secret="${oidc_hmac}" \
      --dry-run=client -o yaml | kubectl apply -f -
    warn "Default admin password is preset — run: ./scripts/manage.sh sso set-password <user> after Authelia is up"
    log "Created authelia-secrets"
  fi

  if kubectl get secret oauth2-proxy-secrets -n auth &>/dev/null; then
    log "oauth2-proxy-secrets already exists"
  else
    local cookie_secret oauth_secret
    cookie_secret=$(python3 -c "import os,base64; print(base64.urlsafe_b64encode(os.urandom(32)).decode())")
    oauth_secret=$(openssl rand -hex 16)
    kubectl create secret generic oauth2-proxy-secrets -n auth \
      --from-literal=client-secret="${oauth_secret}" \
      --from-literal=cookie-secret="${cookie_secret}" \
      --dry-run=client -o yaml | kubectl apply -f -
    log "Created oauth2-proxy-secrets"
  fi

  if kubectl get secret sso-oidc-clients -n auth &>/dev/null; then
    log "sso-oidc-clients already exists"
  else
    kubectl create secret generic sso-oidc-clients -n auth \
      --from-literal=coder-client-id=coder \
      --from-literal=coder-client-secret="$(openssl rand -hex 16)" \
      --from-literal=headlamp-client-id=headlamp \
      --from-literal=headlamp-client-secret="$(openssl rand -hex 16)" \
      --from-literal=oauth2-proxy-client-id=oauth2-proxy \
      --from-literal=oauth2-proxy-client-secret="$(openssl rand -hex 16)" \
      --dry-run=client -o yaml | kubectl apply -f -
    log "Created sso-oidc-clients"
  fi

  _ensure_authelia_oidc_config
  _replicate_oidc_client_secrets
}

# @function _replicate_oidc_client_secrets
# Copy sso-oidc-clients to app namespaces (secrets are namespace-scoped).
_replicate_oidc_client_secrets() {
  for ns in coder monitoring dev; do
    kubectl get namespace "$ns" &>/dev/null || continue
    kubectl get secret sso-oidc-clients -n auth -o yaml 2>/dev/null \
      | sed "s/namespace: auth/namespace: ${ns}/" \
      | kubectl apply -f - 2>/dev/null || true
  done
}

# @function _ensure_authelia_oidc_config
# Generates OIDC JWKS + client overlay for Authelia and oauth2-proxy.
_ensure_authelia_oidc_config() {
  if kubectl get secret authelia-oidc-config -n auth &>/dev/null; then
    log "authelia-oidc-config already exists"
    return 0
  fi

  local tmpdir oidc_hmac coder_secret headlamp_secret oauth_secret
  tmpdir=$(mktemp -d)
  trap 'rm -rf "${tmpdir}"' RETURN

  openssl genrsa -out "${tmpdir}/oidc.key" 2048 2>/dev/null
  local cert_cn
  cert_cn="$(lab_active_domain 2>/dev/null || sso_domain)"
  openssl req -new -x509 -key "${tmpdir}/oidc.key" -out "${tmpdir}/oidc.crt" -days 3650 \
    -subj "/CN=${cert_cn}/O=Spark Lab" 2>/dev/null

  oidc_hmac=$(kubectl get secret authelia-secrets -n auth -o jsonpath='{.data.oidc_hmac_secret}' 2>/dev/null | base64 -d 2>/dev/null || openssl rand -hex 32)
  coder_secret=$(kubectl get secret sso-oidc-clients -n auth -o jsonpath='{.data.coder-client-secret}' 2>/dev/null | base64 -d 2>/dev/null || openssl rand -hex 16)
  headlamp_secret=$(kubectl get secret sso-oidc-clients -n auth -o jsonpath='{.data.headlamp-client-secret}' 2>/dev/null | base64 -d 2>/dev/null || openssl rand -hex 16)
  oauth_secret=$(kubectl get secret sso-oidc-clients -n auth -o jsonpath='{.data.oauth2-proxy-client-secret}' 2>/dev/null | base64 -d 2>/dev/null || openssl rand -hex 16)

  local coder_redirects headlamp_redirects oauth_redirects
  coder_redirects=$(_sso_oidc_redirect_uris "coder" "/api/v2/users/oidc/callback")
  headlamp_redirects=$(_sso_oidc_redirect_uris "headlamp" "/oidc-callback")
  oauth_redirects=$(_sso_oidc_redirect_uris "oauth" "/oauth2/callback")

  cat > "${tmpdir}/oidc_overlay.yml" <<EOF
identity_providers:
  oidc:
    hmac_secret: ${oidc_hmac}
    jwks:
      - key_id: lab
        algorithm: RS256
        use: sig
        certificate_chain: |
$(sed 's/^/          /' "${tmpdir}/oidc.crt")
        private_key: |
$(sed 's/^/          /' "${tmpdir}/oidc.key")
    clients:
      - id: coder
        description: Coder workspaces
        secret: ${coder_secret}
        public: false
        authorization_policy: one_factor
        redirect_uris:
${coder_redirects}
        scopes: [openid, profile, email, offline_access]
      - id: headlamp
        description: Headlamp K8s UI
        secret: ${headlamp_secret}
        public: false
        authorization_policy: one_factor
        redirect_uris:
${headlamp_redirects}
        scopes: [openid, profile, email]
      - id: oauth2-proxy
        description: oauth2-proxy bridge
        secret: ${oauth_secret}
        public: false
        authorization_policy: one_factor
        redirect_uris:
${oauth_redirects}
        scopes: [openid, profile, email]
EOF

  kubectl create secret generic authelia-oidc-config -n auth \
    --from-file=oidc_overlay.yml="${tmpdir}/oidc_overlay.yml" \
    --dry-run=client -o yaml | kubectl apply -f -
  log "Created authelia-oidc-config (OIDC JWKS + clients)"
}

# @function _sso_oidc_redirect_uris
# Emit YAML list entries for OIDC redirect URIs across local + public domains.
_sso_oidc_redirect_uris() {
  local host="$1"
  local path="$2"
  local local_d public_d port
  local_d="$(lab_local_domain 2>/dev/null || echo "lab.local")"
  public_d="$(lab_public_domain 2>/dev/null || true)"
  port="$(lab_sso_https_port 2>/dev/null || echo "32443")"
  echo "          - https://${host}.${local_d}:${port}${path}"
  if [[ -n "$public_d" ]]; then
    echo "          - https://${host}.${public_d}${path}"
  fi
}

# @function apply_oauth2_proxy
apply_oauth2_proxy() {
  local deploy="${REPO_ROOT}/k8s/auth/generated/oauth2-proxy-deployment.yaml"
  if [[ ! -f "$deploy" ]]; then
    type domains_render &>/dev/null && domains_render
  fi
  kubectl apply -f "$deploy"
  kubectl apply -f "${REPO_ROOT}/k8s/auth/oauth2-proxy-service.yaml"
}

# @function ensure_cert_manager
ensure_cert_manager() {
  require_helm
  ensure_sso_namespaces
  local ns version
  ns=$(_sso_policy_value "cert_manager.namespace")
  ns=${ns:-cert-manager}
  version=$(_sso_policy_value "cert_manager.chart_version")
  version=${version:-v1.17.2}

  helm repo add jetstack https://charts.jetstack.io 2>/dev/null || true
  helm repo update jetstack

  helm upgrade --install cert-manager jetstack/cert-manager \
    --namespace "${ns}" \
    --create-namespace \
    --version "${version}" \
    --set crds.enabled=true \
    --wait --timeout 5m

  log "Waiting for cert-manager webhook..."
  kubectl wait --for=condition=Available deployment/cert-manager-webhook -n "${ns}" --timeout=120s || true
}

# @function ensure_sso_tls
ensure_sso_tls() {
  require_kubectl
  ensure_cert_manager
  kubectl apply -k "${REPO_ROOT}/k8s/cert-manager/"
  log "TLS ClusterIssuer + wildcard cert submitted (cert-manager will populate traefik/lab-wildcard-tls)"
}

# @function ensure_traefik
ensure_traefik() {
  require_helm
  ensure_sso_namespaces
  local ns version
  ns=$(_sso_policy_value "traefik.namespace")
  ns=${ns:-traefik}
  version=$(_sso_policy_value "traefik.chart_version")
  version=${version:-36.0.0}

  helm repo add traefik https://traefik.github.io/charts 2>/dev/null || true
  helm repo update traefik

  local values_file="${REPO_ROOT}/ansible/files/traefik-values.yaml"
  if [[ -f "$values_file" ]]; then
    helm upgrade --install traefik traefik/traefik \
      --namespace "${ns}" \
      --version "${version}" \
      -f "${values_file}" \
      --wait --timeout 8m
  else
    helm upgrade --install traefik traefik/traefik \
      --namespace "${ns}" \
      --version "${version}" \
      --wait --timeout 8m
  fi
  log "Traefik deployed in namespace ${ns}"
}

# @function apply_sso_middlewares
apply_sso_middlewares() {
  kubectl apply -k "${REPO_ROOT}/k8s/traefik/middlewares/"
}

# @function apply_sso_auth_stack
apply_sso_auth_stack() {
  ensure_sso_secrets
  kubectl apply -k "${REPO_ROOT}/k8s/auth/"
  apply_oauth2_proxy
}

# @function start_sso
# @command start-sso
start_sso() {
  require_kubectl
  check_cluster_access
  require_helm
  log "Starting SSO stack (cert-manager → Traefik → Authelia → routes)..."
  ensure_sso_tls
  ensure_traefik
  apply_sso_middlewares
  apply_sso_auth_stack
  log "SSO stack submitted. Primary entry: $(lab_service_url dashboard "/" 2>/dev/null || echo "https://dashboard.$(sso_domain):32443")"
  print_sso_access_info
}

# @function stop_sso
# @command stop-sso
stop_sso() {
  require_kubectl
  log "Stopping SSO stack..."
  kubectl delete -f "${REPO_ROOT}/k8s/auth/generated/oauth2-proxy-deployment.yaml" --ignore-not-found=true --wait=false || true
  kubectl delete -f "${REPO_ROOT}/k8s/auth/oauth2-proxy-service.yaml" --ignore-not-found=true --wait=false || true
  kubectl delete -k "${REPO_ROOT}/k8s/auth/" --ignore-not-found=true --wait=false || true
  kubectl delete -k "${REPO_ROOT}/k8s/traefik/middlewares/" --ignore-not-found=true --wait=false || true
  helm uninstall traefik -n traefik --ignore-not-found 2>/dev/null || true
  helm uninstall cert-manager -n cert-manager --ignore-not-found 2>/dev/null || true
  log "SSO stack stopped (namespaces retained)."
}

# @function get_sso_status_json
get_sso_status_json() {
  local traefik_ok=false authelia_ok=false domain
  domain=$(sso_domain)
  if helm list -n traefik -q 2>/dev/null | grep -qx traefik; then
    traefik_ok=true
  fi
  if kubectl get deploy authelia -n auth &>/dev/null; then
    local ready
    ready=$(kubectl get deploy authelia -n auth -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)
    [[ "${ready:-0}" -ge 1 ]] && authelia_ok=true
  fi
  printf '{"enabled":%s,"domain":"%s","traefik":%s,"authelia":%s}\n' \
    "$(sso_enabled && echo true || echo false)" \
    "$domain" \
    "$traefik_ok" \
    "$authelia_ok"
}

# @function print_sso_access_info
print_sso_access_info() {
  local local_d public_d host https_port http_port
  local_d="$(lab_local_domain 2>/dev/null || sso_domain)"
  public_d="$(lab_public_domain 2>/dev/null || true)"
  host="${LAB_SSO_HOST:-${DASHBOARD_HOST:-<spark0-ip>}}"
  https_port="$(lab_sso_https_port 2>/dev/null || echo "32443")"
  http_port="$(lab_sso_http_port 2>/dev/null || echo "32080")"
  echo
  log "=== SSO Access (Traefik + Authelia) ==="
  echo "  Local domain:  ${local_d}  (add to /etc/hosts pointing at ${host})"
  if [[ -n "$public_d" ]]; then
    echo "  Public domain: ${public_d}  (DNS → cluster; ACME TLS)"
  fi
  echo "  HTTPS entry: $(lab_service_url dashboard "/" local 2>/dev/null || echo "https://dashboard.${local_d}:${https_port}")"
  for svc in auth coder grafana headlamp chat kasm traefik oauth; do
    echo "  ${svc}: $(lab_service_url "$svc" "/" local 2>/dev/null || echo "https://${svc}.${local_d}:${https_port}")"
    if [[ -n "$public_d" ]]; then
      echo "         $(lab_service_url "$svc" "/" public 2>/dev/null || echo "https://${svc}.${public_d}")"
    fi
  done
  echo "  HTTP redirect: http://${host}:${http_port} → HTTPS :${https_port}"
  echo
  echo "  /etc/hosts template:"
  echo "    $(lab_hosts_file_line "${host}" 2>/dev/null || echo "${host} auth.${local_d} dashboard.${local_d}")"
  if [[ "${bypass_direct_nodeports:-true}" == "true" ]] || [[ "$(_sso_policy_value bypass_direct_nodeports)" == "True" ]]; then
    echo
    warn "Legacy direct NodePorts still available (bypass SSO): :32080-:32084"
  fi
}

# @function sso_cmd
sso_cmd() {
  local sub="${1:-status}"
  shift || true
  case "$sub" in
    status)
      get_sso_status_json | jq '.' 2>/dev/null || get_sso_status_json
      ;;
    ensure-secrets)
      ensure_sso_secrets
      ;;
    ensure-tls)
      ensure_sso_tls
      ;;
    urls)
      print_sso_access_info
      ;;
    *)
      err "Unknown sso subcommand: $sub (try status, ensure-secrets, ensure-tls, urls)"
      return 1
      ;;
  esac
}