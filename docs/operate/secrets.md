---
title: Secrets
description: Example templates vs runtime secrets, dashboard vault sync to Kubernetes, and what must never be committed.
tags: [secrets, security, dashboard, safety]
---

# Secrets

**What's on this page**

- Committed `*.example` files versus live Secrets
- Dashboard vault + sync to `dev` / `ai-inference`
- `manage.sh secrets` and SSO/Open WebUI helpers
- What git must never contain

**What this enables**

- Wiring API keys and Authelia without pasting them into YAML in the repo
- Recovering a missing master key without printing it

--8<-- "docs/includes/cluster-config.md"

!!! danger "Never commit live secrets"

    No kubeconfig with credentials, no `ansible/inventory/hosts.ini`, no `GROK_DEPLOYMENT_KEY`, no Hermes `~/.hermes` / `hermes/data/`, no `.env`. Policy: [SECURITY.md](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/SECURITY.md).

## Templates (committed)

| Template | Runtime destination |
| --- | --- |
| `ansible/inventory/hosts.ini.example` | `ansible/inventory/hosts.ini` |
| `dashboard/.env.example` | dashboard env / Helm values |
| `mcp/config/secrets.example.env` | `mcp/config/secrets.env` |
| `k8s/auth/secrets.example.yaml` | `k8s/auth/secrets.yaml` |
| `hermes/config/env.example`, `config.yaml.example` | `hermes/data/` (gitignored) |
| `k8s/workloads/litellm/secrets.example.yaml` | LiteLLM Secret |
| `k8s/dev/dashboard/secrets-master.yaml.example` | `lab-dashboard-secrets` |

## Dashboard vault

Values are AES-256-GCM in SQLite (`LAB_SECRETS_MASTER_KEY`). The Secrets panel can **sync** a vault entry to a Kubernetes Secret in namespaces **`dev`** or **`ai-inference` only** (`dashboard/lib/services/k8s-secrets.ts`).

=== "Bazel"

    ```bash
    bazelisk run //:manage -- secrets status
    bazelisk run //:manage -- secrets ensure-key
    bazelisk run //:manage -- secrets list
    ```

=== "Classic"

    ```bash
    ./scripts/manage.sh secrets status
    ./scripts/manage.sh secrets ensure-key
    ./scripts/manage.sh secrets list
    ```

`ensure-key` is idempotent and **never prints** the key. `list` is metadata only (`value_hint`, k8s sync names).

There is no `manage.sh sync-to-k8s` verb — sync is a dashboard action after login.

## Other runtime secrets

| Stack | How they appear |
| --- | --- |
| SSO | `bazelisk run //:manage -- sso ensure-secrets` → `authelia-secrets` / `oauth2-proxy-secrets` in `auth` |
| Open WebUI | start path creates `open-webui-secrets` in `dev` from Hermes `API_SERVER_KEY` |
| LiteLLM | apply example Secret with a real key locally; LAN only |

## Verify

```bash
bazelisk run //:manage -- secrets status
kubectl get secret lab-dashboard-secrets -n dev
```

Expected: master key present; no secret **values** in command output or git diff.
