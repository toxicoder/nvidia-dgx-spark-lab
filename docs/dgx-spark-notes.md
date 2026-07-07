---
title: DGX Spark Specific Notes
description: Platform-specific guidance for DGX Spark — resource limits, NCCL dual-400G config, GPU Operator on K3s, stability tips, and recommended workflow.
tags: [dgx, nvidia, nccl, safety, kubernetes]
---

# DGX Spark Specific Notes

**What's on this page**

- Resource management rules critical for large models on DGX Spark hardware
- Reboot safety procedures and prevention of auto-restarts
- High-speed interconnect (dual 400G) and required NCCL settings
- GPU Operator and K3s specifics for this platform
- Stability tips and common failure modes
- Recommended overall workflow

**What this enables**

- Keeping nodes responsive and SSH usable when running 70B+ and MoE models
- Applying the exact practices used by this lab for production inference
- Avoiding situations that make the host unusable or require long recovery

## Resource Management is Critical

Large models (70B+, MoE like Kimi-K2.6) can quickly exhaust host memory and make the node unresponsive over SSH.

**Rules:**

- Always set `resources.requests` and `resources.limits` for both CPU and memory, not just GPU.
- Use `restartPolicy: OnFailure` with `backoffLimit: 1` for heavy jobs.
- Prefer Jobs over Deployments for one-shot or long-running inference servers that you control explicitly.
- Never use `imagePullPolicy: Always` on multi-hundred-GB images.

## Preventing Auto-Restart on Reboot

- We do **not** use Deployments with high replica counts for heavy models.
- We do **not** use `restartPolicy: Always` for the main inference container.
- Workloads are started manually via `scripts/manage.sh`.
- After reboot you must explicitly re-deploy.

## High-Speed Interconnect (Dual 400G)

For multi-node setups (2-4), nodes have dedicated 400G links (likely ConnectX-7 or similar). Single-node (1) uses local GPU interconnects (no inter-node NCCL).

The setup is designed for 1-4 nodes total (scalable within that; high-speed for multi-node parallelism).

Correct NCCL environment variables are essential:

```yaml
env:
  - name: NCCL_SOCKET_IFNAME
    value: "enp1s0f0np0,enp1s0f1np1"
  - name: NCCL_IB_HCA
    value: "mlx5_0,mlx5_1"
  - name: NCCL_DEBUG
    value: "INFO"
```

If NCCL falls back to the management network, performance will be terrible.

Verify interfaces on the nodes:

```bash
ip -br link show | grep enp
```

## GPU Operator on K3s

The NVIDIA GPU Operator works well on K3s but:

- Use a recent version (v24.x+ recommended).
- The driver container may take several minutes to load after first boot.
- On reboot, wait for `nvidia-smi` to succeed on both nodes before deploying heavy workloads.
- MIG is supported but requires explicit configuration in the ClusterPolicy.

## Stability Tips

1. Reserve headroom: leave at least 10-20% of host RAM and CPU free for the system + K3s.
2. Use node affinity so that heavy inference prefers specific nodes if needed.
3. Monitor with:
   ```bash
   kubectl top nodes
   kubectl top pods -A --containers
   ```
4. If SSH becomes laggy, the node is likely OOMing. Hard power cycle may be required in extreme cases.
5. Consider using `limit` equal to `request` for memory to get OOMKilled instead of silent swapping.

## Recommended Workflow

1. Start with `kimi-test` workload.
2. Monitor for 30-60 minutes.
3. Gradually increase resources in a copy of the manifest.
4. Only then promote to the full `kimi` version.
5. Always stop workloads before maintenance/reboots.

## Common Failure Modes

- Host freezes → insufficient memory limits or too many parallel requests.
- NCCL timeouts → wrong interface names or firewall rules on high-speed links.
- Pods stuck in ContainerCreating → GPU Operator not fully ready.
- SSH unresponsive after 10+ minutes of load → reduce concurrency or model size.

Report exact symptoms and logs when asking for help.
