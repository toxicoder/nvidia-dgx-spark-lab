<!--
  Project-wide glossary abbreviations (Material tooltips).
  Auto-appended to every page via pymdownx.snippets in mkdocs.yml.
  Keep definitions short (tooltip-sized). Longer prose lives in docs/glossary.md.
-->

*[K3s]: Lightweight certified Kubernetes distribution used as the lab control plane.
*[NCCL]: NVIDIA Collective Communications Library for multi-GPU / multi-node training and inference.
*[MIG]: Multi-Instance GPU — partitions a GPU into isolated instances.
*[PVC]: PersistentVolumeClaim — Kubernetes request for durable storage.
*[hostPath]: Volume that mounts a file or directory from the host node filesystem.
*[kustomize]: Kubernetes native configuration management (overlays, patches, generators).
*[Bazel]: Hermetic build and test system; this lab uses Bazelisk as the launcher.
*[Bazelisk]: Version-aware wrapper that runs the Bazel version pinned in .bazelversion.
*[Resource Guard]: Lab capacity gate that blocks heavy starts when free GPU/CPU/memory headroom is too low.
*[restartPolicy]: Kubernetes Job pod restart behavior (lab heavy jobs use OnFailure or Never).
*[backoffLimit]: Max retries for a failed Job before it is considered failed.
*[tensor parallel]: Model parallelism that shards layers across GPUs for large models.
*[unified memory]: CPU and GPU share one physical memory pool (Grace/Blackwell on DGX Spark).
*[Authelia]: Open-source authentication and authorization server used for lab SSO.
*[Traefik]: Cloud-native reverse proxy / ingress used with Authelia for SSO routes.
*[ComfyUI]: Node-based UI for diffusion / visual generative AI workflows.
*[Open WebUI]: Chat frontend used with Hermes / OpenAI-compatible gateways.
*[Hermes]: Lab agent runtime (Docker) with gateway, tools, and MCP integration.
*[MCP]: Model Context Protocol — tool/server interface for agent capabilities.
*[Job]: Kubernetes workload that runs pods to completion (typical for heavy inference).
*[Deployment]: Kubernetes workload that keeps a desired replica set running continuously.
*[GPU Operator]: NVIDIA operator that installs drivers, device plugin, and related GPU components.
*[headroom]: Reserved free capacity Resource Guard keeps free so SSH and control plane stay responsive.
*[cloud-init]: Early OS bootstrap configuration applied on first boot (network, packages, users).
*[Ansible]: Idempotent automation for cluster bootstrap and app install playbooks.
*[MkDocs]: Static site generator used for this documentation.
*[Material]: Material for MkDocs theme powering search, tabs, and tooltips on this site.
