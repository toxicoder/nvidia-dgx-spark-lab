# Security Policy

## Reporting a vulnerability

If you discover a security issue in this repository or in lab deployments derived from it, report it privately to the repository maintainer. Do not open a public issue for undisclosed vulnerabilities.

## Secrets and credentials

This repository must never contain:

- Live API keys, tokens, or passwords
- Private keys (`.pem`, SSH keys, TLS private material)
- Host automation key pairs under `secrets/identities/` (except the committed README)
- Cluster kubeconfig files with real credentials
- `ansible/inventory/hosts.ini` with production host addresses and keys
- `mcp/config/secrets.env` or `k8s/auth/secrets.yaml` (non-example)
- Agent auth material: `GROK_DEPLOYMENT_KEY`, `~/.grok/auth.json`, Hermes `~/.hermes` credentials, or cloud LLM provider keys
- Private backend LLM endpoints or credentials beyond public example placeholders (`api_key: "none"`, lab `svc` DNS)

Use the committed templates instead:

- `dashboard/.env.example`
- `mcp/config/secrets.example.env`
- `k8s/auth/secrets.example.yaml`
- `ansible/inventory/hosts.ini.example`
- `hermes/config/env.example` and `hermes/config/config.yaml.example`

Runtime secrets belong in environment variables, Kubernetes Secrets, or the dashboard secrets vault (`LAB_SECRETS_MASTER_KEY`), never in git.

### Agent CLIs in the devcontainer

The contributor image includes [Grok Build](https://github.com/xai-org/grok-build) at `/usr/local/bin/grok` and may install [Hermes Agent](https://github.com/NousResearch/hermes-agent) at post-create. Rules:

- **Do not** put API keys or `GROK_DEPLOYMENT_KEY` in `.devcontainer/devcontainer.json` (`containerEnv` / `remoteEnv` / `localEnv`).
- Authenticate interactively (`grok login --device-auth`, `hermes setup`) or export keys only in an ephemeral shell session.
- Auth state lives on Docker volumes (`~/.grok`, `~/.hermes`) or the host home directory — not in the git workspace. The Grok **binary** is not on that volume.
- Default `GROK_SANDBOX=lab` kernel-denies the host Docker socket and typical secret globs. This is not a substitute for keeping secrets out of git.
- Lab Hermes **Docker stacks** on Spark nodes use gitignored `hermes/data/`; never commit that tree.

## Local-only development defaults

Placeholder values such as `dev-only-change-me` and `change-me` appear in example files and dev-only code paths. Rotate all credentials before any production or internet-exposed deployment.

## Sensitive paths (.gitignore)

The root `.gitignore` blocks common leak vectors: `.env*`, `kubeconfig/`, `hermes/data/`, `.grok/`, agent auth dumps, `vault-password.txt`, `secrets/identities/**`, Ansible inventory secrets, and test artifact directories. Do not remove these patterns without a documented replacement control.

Official host principals are `lab-admin`, `lab-ansible`, and `lab-svc` (`config/lab-identities.yaml`). Do not use the factory `ubuntu` account as the day-2 Ansible user. Apply with `bazelisk run //:manage -- identities apply --yes`. See [Lab identities](docs/operate/identities.mdx).

## Dependency and supply chain

- Pin tool versions via `.bazelversion`, `package-lock.json`, and `docs/requirements.txt`
- Run `bazelisk run //:validate -- --all` before merging changes that touch workloads, auth, or secret handling
- Review third-party Helm charts and container images before cluster bootstrap

## History hygiene

Before sharing clones outside trusted environments, scan the tree and git history for accidentally committed secret paths (for example with `git log --all --full-history -- '**/.env*' '**/secrets*'` and a review of large binary blobs).