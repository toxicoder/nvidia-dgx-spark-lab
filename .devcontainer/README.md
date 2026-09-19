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

The **container is always Linux**. We do not ship Windows containers (Bazel,
kcov, and kubeconform are Linux-native). On Windows, clone on the WSL2
filesystem (`\\wsl$\…`), not `/mnt/c`.

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
| `tool-versions.env` | **SSOT** tool pins + checksums (CI + image + doctor) |
| `Dockerfile` | Independent fetch stages (one pin ≠ rebuild everything) |
| `.dockerignore` | Tiny build context (README/lockfile edits do not bust COPY) |
| `devcontainer.json` | DooD Feature, caches, `host.docker.internal`, Grok sandbox env |
| `devcontainer-lock.json` | **Committed** Feature digest (docker-outside-of-docker only) |
| `grok-managed.toml` / `sandbox.toml` | Baked Grok auto-update off + `lab` sandbox profile |
| `host-llm.example.toml` | Example `http://host.docker.internal:4000/v1` model |
| `post-create.sh` | Workspace deps (`npm ci`, docs, Playwright) — not image layers |
| `install-agent-clis.sh` | Skips grok when `/usr/local/bin/grok` matches the pin; Hermes optional |
| `doctor.sh` | Verify required tools (`grok` required inside the container) |
| `docker-bake.hcl` | Local `docker buildx bake` for linux/amd64+arm64 |

### Feature lockfile

`devcontainer-lock.json` pins each Dev Container Feature to a content digest. **Commit it**
(same idea as `package-lock.json` / `MODULE.bazel.lock`). The Dev Containers CLI / VS Code
regenerates it on build; update the file when you intentionally change features or versions
in `devcontainer.json`, then commit the new lock.

## Agent CLIs (Grok Build + Hermes)

**Grok Build** is baked into the image at `/usr/local/bin/grok` (pinned in
`tool-versions.env`). The named volume on `~/.grok` holds auth/sessions only —
it does **not** overlay the binary. Default sandbox is `GROK_SANDBOX=lab`
(workspace writes, kernel-deny of the host Docker socket and typical secret
files). Auto-update is off so the pin sticks.

The container uses the default bridge network plus
`--add-host=host.docker.internal:host-gateway` (portable on Docker Desktop and
Linux Engine). Point Grok at a host LiteLLM/vLLM with
`http://host.docker.internal:4000/v1` (see `host-llm.example.toml`). Do **not**
use `--network=host` (Linux-only, breaks macOS/Windows).

**Hermes** is still optional post-create (`--skip-setup --non-interactive`).

| CLI | Upstream | Auth (never commit; user-initiated) |
| --- | --- | --- |
| `grok` | [xai-org/grok-build](https://github.com/xai-org/grok-build) | `grok login --device-auth` → volume `~/.grok` |
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

- **Independent fetch stages** — kubectl, helm, bazelisk, Node, Grok, … each have
  their own BuildKit cache. CI publishes
  `ghcr.io/toxicoder/nvidia-dgx-spark-lab/devcontainer` for `build.cacheFrom`.
- **Node 22 + Python 3.11 baked** — not Dev Container Features (those re-run
  whenever the image id changes). Only **docker-outside-of-docker** remains a
  Feature (it needs the live host socket).
- **docker-outside-of-docker** — host Docker socket for `//dashboard:hermetic-test`.
  Grok's `lab` profile cannot use that socket; humans still can.
- **No full-suite gate on create** — optional `DEVCONTAINER_SMOKE=1` only.
- **Named volumes** for Bazel disk/repo, npm, pip, Playwright caches and agent homes (`~/.grok`, `~/.hermes`) across rebuilds.
- **`REQUIRE_LINT_TOOLS=1`** — missing linters fail like CI (no silent skips).
