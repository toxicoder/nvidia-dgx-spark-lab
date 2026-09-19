---
title: Learn the lab
description: Short operator track — K3s on DGX Spark, Resource Guard, NCCL fabrics, and why heavy jobs never auto-start.
tags: [learn, safety, k3s, nccl, resources]
---

# Learn the lab

**What's on this page**

- Why this lab is K3s Jobs, not Compose demos
- Resource Guard headroom in one paragraph
- NCCL pair vs ring
- Why reboot does not bring inference back

**What this enables**

- Reading later operate pages without tripping on jargon
- Not treating ez-comfy-stack occupancy rules as this cluster's capacity gate

This is **not** a ComfyUI beginner course. Still images and video on one Spark with Docker Compose: [ez-comfy-stack](https://github.com/toxicoder/ez-comfy-stack).

## K3s on Spark

Each GB10 node is one GPU, 20 Arm cores, 128 GB unified memory. Kubelet reservations and Resource Guard keep SSH and K3s alive while Jobs request most of the rest.

- spark0 runs the K3s **server** and a **worker**
- spark1+ are agents
- GPU Operator installs drivers, device plugin, DCGM

Bootstrap is Ansible. Day-2 mutations go through `manage.sh` (`bazelisk run //:manage -- …`) so confirmations and capacity checks stay in one place.

## Resource Guard (not Compose occupancy)

ez-comfy-stack talks about **occupancy** of a Compose project. This lab uses **Resource Guard**:

- Policy: `config/resource-policy.yaml` (edit YAML first, JSON twin second)
- Runtime: `scripts/lib/resources.sh` on `start-*`
- Kubernetes: PriorityClass, ResourceQuota, LimitRange
- Floor: **max(24Gi, 15% of allocatable) per node** — not a second 64Gi tax after kubelet

Mode A vLLM `--gpu-memory-utilization` ≤ **0.82**. Mode B exclusive ≤ **0.85**. Mode C SGLang `--mem-fraction-static` ≤ **0.95**. Never ship vLLM 0.88/0.90.

[Resource Guard](../resource-guard.md) · [Capacity planning](../operate/capacity-planning.md)

## NCCL

Multi-GPU **inside one node** uses SHM/P2P. Multi-node uses the QSFP fabric:

| Topology | What to set |
| --- | --- |
| 2-node pair | `group_vars` `highspeed_*` / `nccl_env` (one 200 Gb/s QSFP cable) |
| 3-node ring | Overlay Jobs only — OOB 10GbE + four RoCE HCAs. **Not** the pair env |
| 4/5-node switch | Generated per-node netplan (one RoCE /24 per node, CRS804). **Not** the pair env |

[Interconnect & NCCL](../concepts/interconnect-nccl.md)

## Why no auto-start

Heavy Jobs use `restartPolicy: OnFailure` (or `Never`) and a low `backoffLimit`. After reboot the cluster is empty until you run `start-*` again. That is deliberate: an 90Gi+ Job coming back unattended can pin unified memory and kill SSH.

[Reboot safety](../reboot-safety.md)

## Next

[Getting Started](../getting-started.md) · [Architecture](../architecture.md) · [Glossary](../glossary.md)
