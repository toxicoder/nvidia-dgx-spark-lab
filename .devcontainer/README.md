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
| `post-create.sh` | Workspace deps (`npm ci`, docs, Playwright) |
| `doctor.sh` | Verify required tools |

## Design choices

- **docker-outside-of-docker** — uses the host Docker socket (fast on macOS; works with Desktop/WSL2). Needed for `//dashboard:hermetic-test`.
- **No full-suite gate on create** — optional `DEVCONTAINER_SMOKE=1` only.
- **Named volumes** for Bazel disk/repo, npm, pip, Playwright caches across rebuilds.
- **`REQUIRE_LINT_TOOLS=1`** — missing linters fail like CI (no silent skips).
