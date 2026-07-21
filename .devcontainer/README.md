# Dev container

Consistent contributor environment for **nvidia-dgx-spark-lab**.

## Supported hosts

The image is **Linux multi-arch** (`linux/amd64` + `linux/arm64`). Open the same
definition from any of:

| Host | Architecture | Notes |
| --- | --- | --- |
| **macOS Apple Silicon** | arm64 | Docker Desktop; container is arm64 Linux |
| **macOS Intel** | x86_64 | Docker Desktop; container is amd64 Linux |
| **Windows** | x86_64 | Docker Desktop + WSL2; container is amd64 Linux |
| **Linux workstation** | amd64 or arm64 | Docker Engine or Podman |
| **NVIDIA DGX Spark** | arm64 (Grace) | Docker/Podman on the Spark; same arm64 image |

You do **not** need NVIDIA drivers or a GPU for code contribution (shell, k8s
YAML, dashboard unit tests, docs). Cluster ops remain separate
([getting-started](../docs/getting-started.md)).

## Quick start

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (macOS/Windows)
   or Docker Engine (Linux/Spark).
2. Open this repo in VS Code or Cursor with the **Dev Containers** extension
   (or GitHub Codespaces).
3. **Dev Containers: Reopen in Container**.
4. Wait for `post-create` (npm + docs deps + doctor).
5. Run:

```bash
bash .devcontainer/doctor.sh
bazelisk run //:fix
bazelisk run //:validate
```

Full guide: [docs/dev-environment.md](../docs/dev-environment.md).

## Layout

| File | Role |
| --- | --- |
| `tool-versions.env` | **SSOT** tool pins (CI + image + doctor) |
| `Dockerfile` | Pinned CLIs, multi-arch binaries |
| `devcontainer.json` | Features (Node 22, Python 3.11, docker-outside-of-docker), caches, lifecycle |
| `devcontainer-lock.json` | **Committed** feature digests (reproducible Feature installs; like a lockfile) |
| `post-create.sh` | Workspace deps (`npm ci`, docs, Playwright) |
| `install-agent-clis.sh` | Optional Grok + Hermes CLIs (fixes `~/.grok` / `~/.hermes` volume ownership) |
| `doctor.sh` | Verify required tools |

### Feature lockfile

`devcontainer-lock.json` pins each Dev Container Feature to a content digest. **Commit it**
(same idea as `package-lock.json` / `MODULE.bazel.lock`). The Dev Containers CLI / VS Code
regenerates it on build; update the file when you intentionally change features or versions
in `devcontainer.json`, then commit the new lock.

## Agent CLIs (Grok Build + Hermes)

Post-create installs official CLIs on PATH only (optional if network is blocked).
Hermes is installed with `--skip-setup --non-interactive` — no Blank Slate wizard
during create. Auth/setup runs only when **you** use the tools:

| CLI | Upstream | Auth (never commit; user-initiated) |
| --- | --- | --- |
| `grok` | [xai-org/grok-build](https://github.com/xai-org/grok-build) | `grok login` → volume `~/.grok` |
| `hermes` | [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | `hermes setup` when needed → volume `~/.hermes` |

```bash
bash .devcontainer/install-agent-clis.sh   # re-run if needed
DEVCONTAINER_SKIP_AGENT_CLIS=1 …           # skip during post-create
```

Named volumes for agent homes are often **root-owned** when first created empty. The
installer script runs `ensure_agent_homes` (sudo chown when needed). Manual recovery:

```bash
sudo chown -R "$(id -u):$(id -g)" ~/.grok ~/.hermes
bash .devcontainer/install-agent-clis.sh
# host: docker volume rm dgx-lab-grok-home dgx-lab-hermes-home  # then rebuild
```

**Privacy:** no API keys or `GROK_DEPLOYMENT_KEY` in image env metadata. Do not
export secrets into committed `devcontainer.json`. See [SECURITY.md](../SECURITY.md).

Lab **host Docker** Hermes stacks (`hermes/`, `start-hermes`) are separate from
this CLI install — see [docs/hermes-agent.md](../docs/hermes-agent.md).

## Design choices

- **docker-outside-of-docker** — uses the host Docker socket (fast on macOS; works with Desktop/WSL2). Needed for `//dashboard:hermetic-test`.
- **No full-suite gate on create** — optional `DEVCONTAINER_SMOKE=1` only.
- **Named volumes** for Bazel disk/repo, npm, pip, Playwright caches and agent homes (`~/.grok`, `~/.hermes`) across rebuilds.
- **`REQUIRE_LINT_TOOLS=1`** — missing linters fail like CI (no silent skips).
