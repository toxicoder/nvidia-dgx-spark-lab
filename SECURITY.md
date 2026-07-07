# Security Policy

## Reporting a vulnerability

If you discover a security issue in this repository or in lab deployments derived from it, report it privately to the repository maintainer. Do not open a public issue for undisclosed vulnerabilities.

## Secrets and credentials

This repository must never contain:

- Live API keys, tokens, or passwords
- Private keys (`.pem`, SSH keys, TLS private material)
- Cluster kubeconfig files with real credentials
- `ansible/inventory/hosts.ini` with production host addresses and keys
- `mcp/config/secrets.env` or `k8s/auth/secrets.yaml` (non-example)

Use the committed templates instead:

- `dashboard/.env.example`
- `mcp/config/secrets.example.env`
- `k8s/auth/secrets.example.yaml`
- `ansible/inventory/hosts.ini.example`

Runtime secrets belong in environment variables, Kubernetes Secrets, or the dashboard secrets vault (`LAB_SECRETS_MASTER_KEY`), never in git.

## Local-only development defaults

Placeholder values such as `dev-only-change-me` and `change-me` appear in example files and dev-only code paths. Rotate all credentials before any production or internet-exposed deployment.

## Sensitive paths (.gitignore)

The root `.gitignore` blocks common leak vectors: `.env*`, `kubeconfig/`, `hermes/data/`, `vault-password.txt`, Ansible inventory secrets, and test artifact directories. Do not remove these patterns without a documented replacement control.

## Dependency and supply chain

- Pin tool versions via `.bazelversion`, `package-lock.json`, and `docs/requirements.txt`
- Run `bazelisk run //:validate -- --all` before merging changes that touch workloads, auth, or secret handling
- Review third-party Helm charts and container images before cluster bootstrap

## History hygiene

When rebuilding local git history, record the pre-rebuild tree hash (`git rev-parse HEAD`) and scan object storage for accidentally committed secret paths before sharing clones outside trusted environments.