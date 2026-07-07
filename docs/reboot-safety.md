---
title: Safe Reboot Procedure
description: Step-by-step reboot sequence for DGX Spark nodes — stop workloads first, node order, verification, and recovery when SSH is unresponsive.
tags: [safety, reboot, operations, kubernetes]
---

# Safe Reboot Procedure

**What's on this page**

- The golden rule and why heavy workloads are dangerous around power events
- Recommended reboot sequence from workstation (stop first)
- Node order (workers then control-plane)
- Out-of-band and console methods
- Post-reboot verification steps
- Recovery procedures if SSH is already unresponsive

**What this enables**

- Safely restarting DGX Spark nodes without losing work or making hardware hard to recover
- Bringing the full cluster (and inference jobs) back online reliably
- Following the exact process used in this lab to protect expensive physical hardware

**Golden Rule**: Never reboot with heavy workloads still scheduled.

## Recommended Reboot Sequence

1. **From your workstation** (with working kubectl access):
   ```bash
   cd nvidia-dgx-spark-lab
   ./scripts/manage.sh stop
   ```

   Wait until:
   ```bash
   kubectl get pods -n ai-inference
   ```
   shows no running inference pods (or the jobs are Completed/removed).

2. Reboot the nodes.

   Preferred order:

   - Any workers (spark1+ if present)
   - spark0 (control plane)
   # For 1-node: just reboot the single node after stopping workloads.

   You can do this via the node's out-of-band management (IPMI/iDRAC) or from the host console if you still have access:

   ```bash
   # On the node itself (if SSH still responsive)
   sudo reboot
   ```

3. After both nodes are back online:
   ```bash
   # Verify cluster health
   ansible-playbook -i ansible/inventory/hosts.ini ansible/playbooks/verify-cluster.yml

   # Or manually
   export KUBECONFIG=./kubeconfig/config
   kubectl get nodes
   ```

4. (Optional) Re-apply any node labels or configuration:
   ```bash
   ansible-playbook -i ansible/inventory/hosts.ini ansible/playbooks/bootstrap-cluster.yml --tags label
   ```

5. Only then start workloads again:
   ```bash
   ./scripts/manage.sh start-test
   # ... validate ...
   ./scripts/manage.sh start-kimi
   ```

## If SSH is completely unresponsive

- Use the server's remote management console (usually iLO / iDRAC / IPMI).
- In extreme memory pressure cases you may need a hard power reset.
- After hard reset, always run full verification before deploying large jobs.

## Preventing Accidental Auto-Start

This repo deliberately avoids:

- Deployments with `replicas > 0` for heavy models
- `restartPolicy: Always`
- Systemd units or init containers that launch inference on boot

If you add any automation later, make sure it also requires explicit approval for heavy jobs.
