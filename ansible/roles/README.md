# Ansible Roles

Reusable Ansible roles for the lab.

## Roles

- **k3s_common**: OS prerequisites, swapoff, sysctls, containerd prep for all nodes.
- **gpu_operator**: Deploys NVIDIA GPU Operator via Helm (drivers, device plugin, DCGM, etc.).
- **highspeed_network**: Configures dual 400G links using netplan + ibdev2netdev detection.
- **coder**, **kasm**, **monitoring**: Helm-based dev/observability stacks.
- **cloud_init**: Early OS + highspeed prep templates (used optionally before full bootstrap).
- **labels**: Applies node labels (highspeed, role, etc.).

## When to use roles vs playbooks

Most top-level orchestration lives in `playbooks/`. Roles encapsulate reusable logic.

See individual role tasks/main.yml and templates for details.

Run via the playbooks (bootstrap-cluster.yml, install-gpu-operator.yml, full-lab-setup.yml, etc.).

## Documentation

See docs/getting-started.md and the auto-generated Shell reference for the `setup` flow that drives these playbooks.

For cloud-init early prep, see ansible/cloud-init/ and apply-cloud-init-prep.yml.
