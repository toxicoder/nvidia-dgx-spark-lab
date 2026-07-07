# nvidia-dgx-spark-lab

<img width="7008" height="4704" alt="nvidia-dgx-spark-lab-banner-0" src="https://github.com/user-attachments/assets/821e9c79-a103-444f-98e2-bef92ff42ca5" />


**What's on this page**

- Project goals and core safety principles
- Node role table (1-node vs 2-4 node configurations)
- Core components (K3s, GPU Operator, Ansible + cloud-init, Helm vs raw manifests)
- High-speed interconnect and NCCL configuration
- High-level repository layout
- Links to getting started and other sections

**What this enables**

- Quickly understanding the lab's scope (small 1-4 node DGX Spark clusters for large inference)
- Seeing the emphasis on stability, explicit resources, and no auto-start of heavy jobs
- Deciding where to go next (Getting Started guide is the primary entry point)

## Goals

- Run very large models (e.g. Kimi-K2.6 and similar) reliably without freezing the host or making SSH unresponsive.
- Utilize the dual 400G high-speed interconnect between nodes.
- Provide both a heavy production configuration and a lighter/safer test mode.
- Never auto-start heavy containers on reboot.
- Everything managed through simple, auditable scripts and manifests.

<img width="1280" height="858" alt="dashboard-main copy" src="https://github.com/user-attachments/assets/057fd2c0-27d4-47a5-ae02-1157dcd6dca1" />

## Node Roles (Scalable 1-4 nodes)

| Nodes     | Role Configuration                          | Notes |
|-----------|---------------------------------------------|-------|
| 1 node    | spark0: control-plane + worker             | All-in-one; single-node NCCL for local GPUs |
| 2-4 nodes | spark0: control-plane + worker; spark1..N: workers | High-speed interconnects (dual 400G) for multi-node NCCL / tensor-parallel |

## Core Components

- **K3s** as the lightweight Kubernetes distribution
- **NVIDIA GPU Operator** for driver, device plugin, and MIG management
- Kubernetes manifests (no Docker Compose for workloads)
- Ansible + cloud-init (early OS/highspeed prep) for idempotent cluster bootstrap
- Helm charts (Coder, Kasm, GPU Operator, monitoring, custom dashboard) for K8s apps; raw manifests + kustomize for safety-critical inference workloads
- Strict resource requests/limits on all heavy workloads
- `restartPolicy: OnFailure` with low backoff for big models

## High-Speed Interconnect (for 2+ nodes)

For multi-node setups (2-4), nodes are connected with dual 400G links. NCCL is configured to use them (ignored for 1 node):

- `NCCL_SOCKET_IFNAME=enp1s0f0np0,enp1s0f1np1`
- `NCCL_IB_HCA=mlx5_0,mlx5_1` (or equivalent)
- Appropriate `NCCL_P2P_DISABLE`, `NCCL_SHM_DISABLE`, etc. tuned for stability

For 1 node: standard local multi-GPU NCCL (SHM/P2P) is used.

See workload manifests for exact settings and scalability notes.

## Repository Layout

```
nvidia-dgx-spark-lab/
├── ansible/          # Cluster bootstrap (playbooks, roles, cloud-init examples)
├── config/           # Resource Guard policy, lab-domains, Nemotron catalog
├── dashboard/        # Next.js lab portal (panels, secrets vault, visual goldens)
├── docs/             # MkDocs site, project-conventions.md, generators
├── helm/             # lab-dashboard Helm chart
├── hermes/           # Host Docker agent (profiles, docker-compose)
├── k8s/
│   ├── base/         # Namespaces, Resource Guard
│   ├── dev/          # Dashboard dev manifests, Coder templates
│   ├── overlays/     # test, prod, single-node
│   └── workloads/    # kimi, nemotron-*, qwen3.5-*, glm-5.2, ray-*, agentic stack
├── lints/            # Bazel-wrapped linters
├── mcp/              # MCP Agent Toolkit (policy, k8s workloads, docker)
├── scripts/          # manage.sh, lib/*.sh, utilities/
├── tests/            # BATS + safety invariants
├── BUILD.bazel       # Primary entry: bazelisk run //:validate
├── CONTRIBUTING.md   # Short contribution hub
└── AGENTS.md         # AI agent workflow
```

## Quick Start

1. **Inventory Setup**
   ```bash
   cp ansible/inventory/hosts.ini.example ansible/inventory/hosts.ini
   # Edit with real IPs. Supports 1 node (only spark0) or 2-4 (spark0 + agents).
   # See hosts.ini.example for examples and high-speed config.
   ```

2. **Bootstrap the Cluster** (works for 1 or 2-4 nodes)
   ```bash
   # Preferred when working Bazel-first:
   bazelisk run //ansible:bootstrap -- -i inventory/hosts.ini

   # Classic direct:
   cd ansible
   ansible-playbook -i inventory/hosts.ini playbooks/bootstrap-cluster.yml
   ```

3. **Install GPU Operator**
   ```bash
   bazelisk run //ansible:gpu-operator -- -i inventory/hosts.ini
   # or
   ansible-playbook -i inventory/hosts.ini playbooks/install-gpu-operator.yml
   ```

4. **Verify cluster**
   ```bash
   bazelisk run //ansible:verify -- -i inventory/hosts.ini
   ```

5. **Deploy Workloads (via script)**
   ```bash
   ./scripts/manage.sh status
   ./scripts/manage.sh start-test
   ./scripts/manage.sh start-kimi   # heavy production (example)
   ./scripts/manage.sh start-ray
   ./scripts/manage.sh start-nemotron   # alias: start-nemotron-3-ultra
   ./scripts/manage.sh start-glm        # alias: start-glm-5.2
   ./scripts/manage.sh stop
   ```

See [docs/getting-started.md](docs/getting-started.md) for the **hyper-detailed, step-by-step** guide (with variants for 1/2/4 nodes, verification after every step, safety callouts, and heavy use of the live interactive panel).

The auto-generated command reference (from structured comments in the scripts) is at [docs/generated/shell/reference.md](docs/generated/shell/reference.md) and is integrated throughout the main docs.

For model config defaults (reference only — authoritative values live in workload manifests), see `ansible/inventory/group_vars/all.yml` (`llm_*` vars).

See [docs/getting-started.md](docs/getting-started.md) for full instructions.

## Safety First

- Heavy workloads use `restartPolicy: OnFailure` with low `backoffLimit` (1 or 2).
- No Deployments with `replicas` that auto-restart on large models.
- The `manage.sh` script includes pre-flight resource checks and confirmation for heavy mode.
- After reboot, workloads do **not** come back automatically. You must explicitly start them.
- Always stop workloads before rebooting (see docs/reboot-safety.md).

## Modes

| Mode       | Purpose                     | Resource Profile     | Safety Level     |
|------------|-----------------------------|----------------------|------------------|
| kimi-test  | Quick validation & testing  | Lower (1-2 GPUs)     | High             |
| kimi       | Full production inference   | Full multi-GPU       | Guarded          |

## Managing the Cluster

All day-to-day operations go through the management script:

```bash
./scripts/manage.sh help
./scripts/manage.sh doctor
./scripts/manage.sh estimate kimi-test
```

Common operations:

- `start-test` — deploy lighter test workload
- `start-kimi` — deploy full heavy workload (with confirmation)
- `estimate <model>` — resource estimator with editable placeholders
- `stop` — delete active workloads
- `status` — show pods, nodes, GPU resources
- `cleanup` — remove all managed resources

**Pro tip**: The documentation site now features **live editable variables** in command examples (see Getting Started). Edit SPARK0_IP etc. and the copy buttons use your values.

## Agent Chat (Open WebUI + Hermes)

For browser-based agent chat with MCP tool orchestration, deploy the backing stacks then Open WebUI:

```bash
./scripts/manage.sh start-nemotron   # or nemotron-stack preset
./scripts/manage.sh start-mcp
./scripts/manage.sh start-hermes
./scripts/manage.sh start-open-webui
```

See [docs/open-webui.md](docs/open-webui.md) and [docs/hermes-agent.md](docs/hermes-agent.md).

## Remote Development: Coder Workspaces + Kasm + Dashboard

See [docs/dev-workspaces.md](docs/dev-workspaces.md) for:

- Setup with Ansible + Helm (Coder, Kasm, Headlamp + Grafana for metrics, custom lab portal).
- `scripts/manage.sh` commands: `start-coder`, `start-kasm`, `start-monitoring`, `stop-dev` etc.
- NodePort access (e.g. 32080 for Coder) or VPN notes (traefik disabled by design for stability).
- Example Coder templates, Grafana dashboards for GPUs (via GPU Operator DCGM), safety/resource notes.
- How the custom dashboard provides quick status, copyable commands, and links (Headlamp for K8s, Grafana graphs, workspace launch).

**Safety note**: Dev tools use Deployments with explicit (conservative) resources/limits. Heavy inference Jobs remain OnFailure + low backoff, no auto-start.

## Rebooting Safely

1. Stop workloads first:
   ```bash
   ./scripts/manage.sh stop
   ```
2. Reboot nodes (order doesn't strictly matter but prefer spark1 then spark0).
3. After nodes are up, re-apply cluster config if needed:
   ```bash
   ansible-playbook -i inventory/hosts.ini playbooks/bootstrap-cluster.yml
   ```
4. Manually start the workload you need.

## Development & Testing (Bazel is the primary entry point)

**Bazel** is the main build system and entry point for the entire codebase (tests, lint, docs, validation).

```bash
bazelisk test //:test                     # recommended: hermetic BATS + safety checks
bazelisk test //:lint --test_tag_filters=manual   # all linters (shell/yaml/k8s/ansible)
bazelisk run //:manage -- status          # the cluster management tool
bazelisk run //docs:serve                 # local documentation site (live reload)
bazelisk run //ansible:bootstrap          # (uses example inventory; pass -i for real)
bazelisk run //dashboard:dev
bazelisk build //...
```

Makefile (thin compatibility shim — most targets delegate to Bazel):

```bash
make help
make lint
make test
make test-all
```

Direct tools (still fully supported for day-to-day cluster ops, especially runtime ops):

```bash
./scripts/manage.sh help
./scripts/manage.sh status
```

See `docs/BUILDING_WITH_BAZEL.md`, `docs/getting-started.md`, and `docs/CONTRIBUTING.md`.

### What the tests cover
- Shell script correctness and safety logic (`scripts/manage.sh`)
- All Kubernetes manifests are valid against Kubernetes schemas
- Critical production invariants (correct `restartPolicy`, `backoffLimit`, NCCL vars, resource limits)
- Ansible playbook syntax and basic linting

The core BATS tests now also run fully hermetically under Bazel (vendored bats-core + runfiles).

See [tests/README.md](tests/README.md) and the BUILD.bazel files.

### Documentation

Professional documentation site powered by **Material for MkDocs** (official theme).

- Serve locally: `./docs/manage-docs.sh serve` (auto-opens browser; `bazel run //docs:serve`)
- Build (strict by default): `./docs/manage-docs.sh build`
- Preview final static site: `./docs/manage-docs.sh preview`
- Options: `--port`, `--no-browser`, `--no-strict`
- Full guide: see `docs/BUILDING_WITH_BAZEL.md`, `docs/CONTRIBUTING.md`, and `docs/setup-docs.sh`
- Doc generation is incremental (shell reference skips writes when unchanged) and driven from source comments.

The site includes navigation tabs/sections, breadcrumbs (`navigation.path`), instant loading, Mermaid, admonitions, etc.

CI deploys docs via `.github/workflows/deploy-docs.yml` on changes to `docs/**` or `mkdocs.yml`.

See `docs/CONTRIBUTING.md` (if present) or `AGENTS.md` for contribution guidelines.

CI runs the full suite on every push and pull request (`.github/workflows/ci.yml`). Note that Bazel jobs can be added alongside.

### Local tool installation (example)

```bash
# Ubuntu/Debian
sudo apt install shellcheck yamllint bats
pip install ansible ansible-lint
# kubeconform + bats (if not packaged)
curl -sL https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz | tar xz && sudo mv kubeconform /usr/local/bin/
```

Never rely on Kubernetes to auto-restart heavy inference pods.

## Known Limitations & DGX Spark Notes

- Large models can easily OOM or starve the control plane if resource limits are too loose.
- Avoid `imagePullPolicy: Always` on huge images.
- SSH can become unresponsive if the node is under extreme memory pressure — always set conservative limits.
- Dual 400G links require correct interface naming and NCCL env vars; misconfiguration falls back to slower paths.
- Watch for thermal/power limits on sustained inference.

See [docs/dgx-spark-notes.md](docs/dgx-spark-notes.md) and [docs/reboot-safety.md](docs/reboot-safety.md) for more.

## Contributing / Modifying

Keep changes practical. Prioritize:
1. Stability
2. Resource control
3. Simplicity of operations

When adding new workloads, duplicate the kimi-test pattern and adjust resources upward only after validation.

## Support My Projects

If you find this repository helpful and would like to support its development, consider making a donation:

### GitHub Sponsors
[![Sponsor](https://img.shields.io/badge/Sponsor-%23EA4AAA?style=for-the-badge&logo=github)](https://github.com/sponsors/toxicoder)

### Buy Me a Coffee
<a href="https://www.buymeacoffee.com/toxicoder" target="_blank">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="41" width="174">
</a>

### PayPal
[![PayPal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/donate/?hosted_button_id=LSHNL8YLSU3W6)

### Ko-fi
<a href="https://ko-fi.com/toxicoder" target="_blank">
    <img src="https://storage.ko-fi.com/cdn/kofi3.png" alt="Ko-fi" height="41" width="174">
</a>

Your support helps maintain and improve this collection of development tools and templates. Thank you for contributing to open source!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

This repository contains infrastructure code, Kubernetes manifests, and scripts for a specialized AI lab cluster. It is not intended for production use outside controlled research / lab environments. Always follow the safety guidelines in [docs/reboot-safety.md](docs/reboot-safety.md) and [AGENTS.md](AGENTS.md).
