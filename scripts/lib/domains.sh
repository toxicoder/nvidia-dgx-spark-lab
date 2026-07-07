#!/usr/bin/env bash
#
# ## Lab domain helpers
#
# Reads config/lab-domains.yaml with env overrides for SSO, monitoring,
# Open WebUI, and the domain render pipeline.

if ! declare -F lab_repo_root >/dev/null 2>&1; then
  # shellcheck source=paths.sh disable=SC1091
  source "$(dirname "${BASH_SOURCE[0]:-${0}}")/paths.sh"
fi

# @function lab_domains_path
lab_domains_path() {
  echo "$(lab_repo_root)/config/lab-domains.yaml"
}

# @function _lab_domains_load
# Emit key=value lines for domain config (env overrides file).
_lab_domains_load() {
  python3 - "$(lab_domains_path)" <<'PY'
import json, os, sys
from pathlib import Path

def load_yaml(path: Path) -> dict:
    try:
        import yaml  # type: ignore
        return yaml.safe_load(path.read_text()) or {}
    except Exception:
        return json.loads(path.with_suffix(".json").read_text())

cfg = load_yaml(Path(sys.argv[1]))
sso = cfg.get("sso") or {}
tls = cfg.get("tls") or {}

def env(key: str, default: str) -> str:
    return os.environ.get(key, default) or default

local_d = env("LAB_LOCAL_DOMAIN", env("LAB_SSO_DOMAIN", str(cfg.get("local_domain", "lab.local"))))
public_d = env("LAB_PUBLIC_DOMAIN", str(cfg.get("public_domain", "") or ""))
primary = env("LAB_DOMAIN_PROFILE", env("LAB_PRIMARY_DOMAIN", str(cfg.get("primary", "local"))))
email_d = env("LAB_EMAIL_DOMAIN", str(cfg.get("email_domain", local_d)))
https_port = env("LAB_SSO_HTTPS_PORT", str(sso.get("https_port", 32443)))
http_port = env("LAB_SSO_HTTP_PORT", str(sso.get("http_port", 32080)))
acme_email = env("LAB_ACME_EMAIL", str(tls.get("acme_email", "") or ""))

if primary not in ("local", "public"):
    primary = "local"
if primary == "public" and not public_d:
    primary = "local"

fields = {
    "local_domain": local_d,
    "public_domain": public_d,
    "primary": primary,
    "email_domain": email_d,
    "https_port": https_port,
    "http_port": http_port,
    "acme_email": acme_email,
    "local_issuer": str(tls.get("local_issuer", "lab-ca-issuer")),
    "public_issuer": str(tls.get("public_issuer", "letsencrypt-prod")),
    "acme_solver": str(tls.get("acme_solver", "http01")),
}
for k, v in fields.items():
    print(f"{k}={v}")
PY
}

# @function _lab_domains_get
_lab_domains_get() {
  local key="$1"
  _lab_domains_load | while IFS='=' read -r k v; do
    if [[ "$k" == "$key" ]]; then
      echo "$v"
      return 0
    fi
  done
}

# @function lab_local_domain
lab_local_domain() { _lab_domains_get local_domain; }

# @function lab_public_domain
lab_public_domain() { _lab_domains_get public_domain; }

# @function lab_primary_domain
lab_primary_domain() { _lab_domains_get primary; }

# @function lab_email_domain
lab_email_domain() { _lab_domains_get email_domain; }

# @function lab_sso_https_port
lab_sso_https_port() { _lab_domains_get https_port; }

# @function lab_sso_http_port
lab_sso_http_port() { _lab_domains_get http_port; }

# @function lab_active_domain
# Returns the domain used for primary SSO links (local or public apex).
lab_active_domain() {
  local primary public local_d
  primary="$(_lab_domains_get primary)"
  public="$(_lab_domains_get public_domain)"
  local_d="$(_lab_domains_get local_domain)"
  if [[ "$primary" == "public" && -n "$public" ]]; then
    echo "$public"
  else
    echo "$local_d"
  fi
}

# @function lab_fqdn
# Usage: lab_fqdn dashboard [local|public]
lab_fqdn() {
  local host="${1:-}"
  local profile="${2:-}"
  local local_d public_d
  local_d="$(_lab_domains_get local_domain)"
  public_d="$(_lab_domains_get public_domain)"
  [[ -n "$host" ]] || { echo ""; return 0; }
  if [[ -z "$profile" ]]; then
    profile="$(_lab_domains_get primary)"
    if [[ "$profile" == "public" && -z "$public_d" ]]; then
      profile="local"
    fi
  fi
  if [[ "$profile" == "public" && -n "$public_d" ]]; then
    echo "${host}.${public_d}"
  else
    echo "${host}.${local_d}"
  fi
}

# @function lab_host_match
# Traefik Host() rule for one subdomain across configured domains.
lab_host_match() {
  local host="${1:-}"
  local local_d public_d parts=()
  local_d="$(_lab_domains_get local_domain)"
  public_d="$(_lab_domains_get public_domain)"
  parts+=("Host(\`${host}.${local_d}\`)")
  if [[ -n "$public_d" ]]; then
    parts+=("Host(\`${host}.${public_d}\`)")
  fi
  local IFS=' || '
  echo "${parts[*]}"
}

# @function lab_service_url
# Usage: lab_service_url dashboard [/path] [local|public]
lab_service_url() {
  local host="${1:-}"
  local path="${2:-/}"
  local profile="${3:-}"
  local fqdn port public_d
  public_d="$(_lab_domains_get public_domain)"
  fqdn="$(lab_fqdn "$host" "${profile:-local}")"
  port="$(_lab_domains_get https_port)"
  if [[ -z "$profile" ]]; then
    profile="local"
  fi
  if [[ "$profile" == "public" && -n "$public_d" ]]; then
    echo "https://${fqdn}${path}"
  else
    echo "https://${fqdn}:${port}${path}"
  fi
}

# @function lab_hosts_file_line
lab_hosts_file_line() {
  local ip="${1:-<node-ip>}"
  python3 - "$ip" "$(lab_domains_path)" <<'PY'
import json, sys
from pathlib import Path

def load_yaml(path: Path) -> dict:
    try:
        import yaml  # type: ignore
        return yaml.safe_load(path.read_text()) or {}
    except Exception:
        return json.loads(path.with_suffix(".json").read_text())

cfg = load_yaml(Path(sys.argv[2]))
ip = sys.argv[1]
local_d = cfg.get("local_domain", "lab.local")
hosts = ["auth", "dashboard", "chat", "coder", "grafana", "headlamp", "kasm", "traefik", "oauth"]
print(f"{ip} " + " ".join(f"{h}.{local_d}" for h in hosts))
PY
}

# @function lab_domain_urls_json
# Emit JSON with local/public URL maps for a service host.
lab_domain_urls_json() {
  local host="${1:-}"
  python3 - "$host" <<'PY'
import json, os, subprocess, sys

host = sys.argv[1]
root = os.environ.get("REPO_ROOT", ".")
loader = subprocess.check_output(
    ["bash", "-c", f"source {root}/scripts/lib/domains.sh && _lab_domains_load"],
    text=True,
)
cfg = dict(line.split("=", 1) for line in loader.splitlines() if "=" in line)
local_d = cfg["local_domain"]
public_d = cfg.get("public_domain", "")
port = cfg.get("https_port", "32443")

def url(profile: str) -> str:
    apex = public_d if profile == "public" and public_d else local_d
    fqdn = f"{host}.{apex}"
    if profile == "public" and public_d:
        return f"https://{fqdn}/"
    return f"https://{fqdn}:{port}/"

out = {"local": url("local")}
if public_d:
    out["public"] = url("public")
print(json.dumps(out))
PY
}

# @function lab_ansible_values_file
# Prefer ansible/files/generated/<name> when render-domains has run.
lab_ansible_values_file() {
  local name="$1"
  local gen="${REPO_ROOT}/ansible/files/generated/${name}"
  local base="${REPO_ROOT}/ansible/files/${name}"
  if [[ -f "$gen" ]]; then
    echo "$gen"
  elif [[ -f "$base" ]]; then
    echo "$base"
  fi
}

# @function domains_render
domains_render() {
  local script="${REPO_ROOT}/scripts/utilities/render-domains.sh"
  if [[ ! -f "$script" ]]; then
    err "render-domains.sh not found"
    return 1
  fi
  bash "$script"
}

# @function domains_show
domains_show() {
  local local_d public_d primary email https_port
  local_d="$(lab_local_domain)"
  public_d="$(lab_public_domain)"
  primary="$(lab_primary_domain)"
  email="$(lab_email_domain)"
  https_port="$(lab_sso_https_port)"
  if [[ -n "${LAB_SSO_DOMAIN:-}" && "${LAB_SSO_DOMAIN}" != "$local_d" ]]; then
    warn "LAB_SSO_DOMAIN is deprecated — use LAB_LOCAL_DOMAIN or config/lab-domains.yaml"
  fi
  echo "Lab domains (config: $(lab_domains_path))"
  echo "  local_domain:  ${local_d}"
  echo "  public_domain: ${public_d:-<disabled>}"
  echo "  primary:       ${primary}"
  echo "  email_domain:  ${email}"
  echo "  sso_https:     :${https_port}"
  echo
  echo "Service URLs (primary=${primary}):"
  for svc in auth dashboard chat coder grafana headlamp kasm traefik oauth; do
    local u_local u_public
    u_local="$(lab_service_url "$svc" "/" local)"
    echo "  ${svc}: ${u_local}"
    if [[ -n "$public_d" ]]; then
      u_public="$(lab_service_url "$svc" "/" public)"
      echo "           ${u_public}"
    fi
  done
  echo
  echo "/etc/hosts (local):"
  echo "  $(lab_hosts_file_line '<node-ip>')"
  if [[ -n "$public_d" ]]; then
    echo
    echo "Public DNS: point *.${public_d} at your cluster ingress IP (ACME HTTP-01 on :$(lab_sso_http_port))"
  fi
}

# @function domains_set
domains_set() {
  local local_d="" public_d="" primary="" email="" acme_email=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --local) local_d="$2"; shift 2 ;;
      --public) public_d="$2"; shift 2 ;;
      --primary) primary="$2"; shift 2 ;;
      --email) email="$2"; shift 2 ;;
      --acme-email) acme_email="$2"; shift 2 ;;
      *) err "Unknown domains set option: $1"; return 1 ;;
    esac
  done
  python3 - "$(lab_domains_path)" "$local_d" "$public_d" "$primary" "$email" "$acme_email" <<'PY'
import json, sys
from pathlib import Path

path = Path(sys.argv[1])
args = sys.argv[2:]
local_d, public_d, primary, email, acme_email = (args + [""] * 5)[:5]

try:
    import yaml  # type: ignore
except ImportError:
    sys.stderr.write("PyYAML required for domains set\n")
    sys.exit(1)

cfg = yaml.safe_load(path.read_text()) or {}
if local_d:
    cfg["local_domain"] = local_d
if public_d or public_d == "":
    cfg["public_domain"] = public_d
if primary:
    cfg["primary"] = primary
if email:
    cfg["email_domain"] = email
tls = cfg.setdefault("tls", {})
if acme_email:
    tls["acme_email"] = acme_email
path.write_text(yaml.dump(cfg, default_flow_style=False, sort_keys=False))
json_path = path.with_suffix(".json")
json_path.write_text(json.dumps(cfg, indent=2) + "\n")
print(f"Updated {path}")
PY
  domains_render
}

# @function domains_apply
domains_apply() {
  domains_render
  if type start_sso &>/dev/null; then
    start_sso
  else
    log "Rendered domain manifests (start_sso unavailable in this shell)"
  fi
}

# @function domains_cmd
# CLI dispatcher for domain config (show, set, render, apply).
# @param $1  Subcommand name.
# @command domains
domains_cmd() {
  local sub="${1:-show}"
  shift || true
  case "$sub" in
    show) domains_show ;;
    set) domains_set "$@" ;;
    render) domains_render ;;
    apply) domains_apply ;;
    *)
      err "Unknown domains subcommand: $sub (try show, set, render, apply)"
      return 1
      ;;
  esac
}
