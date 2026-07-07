---
title: SSO with Traefik and Authelia
description: Production-grade Traefik v3 reverse proxy with Authelia forward-auth for single sign-on across lab web UIs.
tags: [sso, traefik, authelia, oauth2-proxy, security]
---

# SSO with Traefik and Authelia

**What's on this page**

- Traefik, Authelia, and oauth2-proxy architecture for lab HTTPS entry
- Bootstrap commands, domain URLs, and policy configuration
- Integration with monitoring and dashboard routes

**What this enables**

- Single sign-on across lab web UIs without per-app credentials
- Consistent TLS termination and forward-auth middleware on Traefik

The lab uses **production-grade Traefik v3** (official Helm chart) as the unified HTTPS entry point, with **Authelia** for user management and forward-auth SSO. K3s bundled Traefik stays disabled; the standalone Helm install supports CRD middleware chains, TLS, and metrics.

## Architecture

- **Traefik** (`traefik` namespace) — reverse proxy on NodePorts `:32080` (HTTP redirect) and `:32443` (HTTPS)
- **cert-manager** — self-signed CA for `*.lab.local` (swap to ACME for production)
- **Authelia** (`auth` namespace) — login portal at `https://auth.lab.local`, session cookies for SSO
- **oauth2-proxy** — OIDC bridge for token-forwarding integrations
- **MCP agent toolkit** — **not** behind SSO; API keys + NetworkPolicies only

## Quick start

```bash
./scripts/manage.sh sso ensure-secrets
./scripts/manage.sh start-sso
./scripts/manage.sh start-monitoring   # also starts SSO when SSO_ENABLED=1 (default)
./scripts/manage.sh sso urls
```

Or via Ansible:

```bash
ansible-playbook -i inventory/hosts.ini playbooks/install-sso.yml
```

## DNS / hosts file

Add to `/etc/hosts` on your workstation (replace `<node-ip>`):

```
<node-ip> auth.lab.local dashboard.lab.local chat.lab.local coder.lab.local grafana.lab.local headlamp.lab.local kasm.lab.local traefik.lab.local oauth.lab.local
```

Configure domains (local + public): edit [`config/lab-domains.yaml`](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/config/lab-domains.yaml) or:

```bash
./scripts/manage.sh domains set --local lab.local --public mydomain.com --acme-email ops@mydomain.com
./scripts/manage.sh domains apply
./scripts/manage.sh domains show
```

Legacy override: `export LAB_SSO_DOMAIN=my.lab` (alias for `LAB_LOCAL_DOMAIN`)

## TLS trust

cert-manager issues a self-signed CA. Export and trust it:

```bash
kubectl get secret lab-selfsigned-ca -n cert-manager -o jsonpath='{.data.tls\.crt}' | base64 -d > lab-ca.crt
# macOS: sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain lab-ca.crt
```

## User management

Default admin user is created by `sso ensure-secrets`. Change password via Authelia UI at `https://auth.lab.local` or edit the `authelia-secrets` Secret `users_database.yml` key.

Access groups:

- `admins` — full access
- `devs` — standard dev tooling

## Service URLs (SSO)

| Service | URL |
|---------|-----|
| Dashboard | `https://dashboard.lab.local:32443` |
| Coder | `https://coder.lab.local:32443` |
| Grafana | `https://grafana.lab.local:32443` |
| Headlamp | `https://headlamp.lab.local:32443` |
| Auth portal | `https://auth.lab.local:32443` |
| Traefik UI | `https://traefik.lab.local:32443` |

Legacy direct NodePorts (`:32082`, etc.) remain available when `SSO_BYPASS_NODEPORTS=1` (default) but bypass SSO.

## MCP exclusion

MCP servers on ports `32100`–`32106` are machine-to-machine endpoints. They use `mcp-secrets` API keys and are not routed through Traefik. See [MCP Agent Toolkit](mcp-agent-toolkit.md).

## Configuration

- Domains: [`config/lab-domains.yaml`](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/config/lab-domains.yaml) — local/public hostnames, ACME, ports
- Policy: [`config/sso-policy.yaml`](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/config/sso-policy.yaml) — routes and SSO component versions
- Traefik values: [`ansible/files/traefik-values.yaml`](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/ansible/files/traefik-values.yaml)
- Middlewares: [`k8s/traefik/middlewares/`](https://github.com/toxicoder/nvidia-dgx-spark-lab/tree/main/k8s/traefik/middlewares)
- Routes: [`k8s/auth/generated/routes.yaml`](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/k8s/auth/generated/routes.yaml) (rendered from lab-domains + sso-policy)

## Disable SSO

```bash
export SSO_ENABLED=0
./scripts/manage.sh start-monitoring   # direct NodePorts only
./scripts/manage.sh stop-sso
```