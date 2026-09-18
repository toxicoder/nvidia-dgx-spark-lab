<!--
  Project-wide glossary abbreviations (hover tooltips).
  Auto-appended to every page by the docs-site remark plugin (lib/remark-glossary.ts).
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
*[Fumadocs]: Documentation site framework (Next.js App Router) that renders this documentation.
*[Mode A]: Daily 3-node mixed fleet (35B + Flash-Next + MedGemma) behind LiteLLM; vLLM util ≤ 0.82.
*[Mode B]: Exclusive GLM-5.3-Flash TP=3 on the 3-node QSFP ring; vLLM util ≤ 0.85.
*[Mode C]: Exclusive DeepSeek-V4.1-Flash TP=3 on the QSFP ring; SGLang mem-fraction-static ≤ 0.95.
*[QSFP ring]: 3-node triangle of 200 Gb/s QSFP links — not the 2-node dual-400G pair.
*[PLE mmap]: Memory-map of Qwen3.8-Flash-Next PLE weights; required on Mode A spark1.
*[hostNetwork]: Pod uses the node's network namespace (fabric-visible NICs).
*[hostIPC]: Pod uses the node's IPC namespace (needed for some TP/RPC Jobs).
*[rounded stack]: Mode A overlay: 35B + Flash-Next + MedGemma + LiteLLM on three Sparks.
*[occupancy]: Compose "is the studio up" in ez-comfy-stack — not this lab's Resource Guard.
