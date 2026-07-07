---
title: Architecture Overview
description: High-level cluster layout, bootstrap flow, workload lifecycle, dashboard data paths, and safety invariants for the DGX Spark lab.
---

# Architecture Overview

**What's on this page**

- High-level cluster diagram (1-4 nodes with control-plane + workers + dual 400G links)
- Bootstrap flow (workstation → Ansible → K3s + GPU Operator)
- Safe workload lifecycle (manage.sh prompts → Job apply → OnFailure + low backoff)
- Dashboard data flow (Next.js → docker.sock / kubectl / ollama / fs)
- Enforced safety invariants (explicit resources, no Always restart for heavy jobs, NCCL only on high-speed)

**What this enables**

- Understanding the "why" behind design choices for host stability and performance
- Safe extension or debugging of the system while preserving core guarantees
- Quick mental model before editing playbooks, manifests, or scripts

## High-Level Cluster

```mermaid
flowchart TD
    subgraph Control Plane
        spark0[spark0<br/>control-plane + worker]
    end
    subgraph Workers
        spark1[spark1<br/>worker]
        sparkN[sparkN<br/>worker]
    end
    spark0 <-->|Dual 400G<br/>highspeed| spark1
    spark0 <-->|Dual 400G| sparkN

    style spark0 fill:#166534,color:#fff
```

## Bootstrap Flow

```mermaid
sequenceDiagram
    participant WS as Workstation
    participant Ansible
    participant Nodes
    participant K3s
    participant GPU-Op

    WS->>Ansible: ansible-playbook bootstrap-cluster.yml
    Ansible->>Nodes: install K3s + labels + highspeed netplan
    Nodes-->>K3s: server + agents ready
    WS->>Ansible: install-gpu-operator.yml
    Ansible->>GPU-Op: helm install
    GPU-Op-->>Nodes: drivers + device plugin + DCGM
```

## Workload Lifecycle (Safe by Design)

```mermaid
flowchart LR
    A[manage.sh start-xxx] -->|free GPU check + prompt| B[kubectl apply Job]
    B --> C[restartPolicy: OnFailure<br/>backoffLimit: 1]
    C --> D[Pod scheduled with<br/>NCCL + affinity]
    D --> E[Inference serving<br/>or Ray cluster]
    F[manage.sh stop] --> G[delete jobs]
    H[Reboot] --> I[You must explicitly<br/>start again]
```

## Dashboard Data Flow

```mermaid
flowchart TD
    UI[Next.js UI] -->|Server Actions| Host[Host exec<br/>via mounted docker.sock + /mnt/models]
    Host --> Docker[Docker ps]
    Host --> Ollama[Ollama list]
    Host --> FS[fs walk /mnt/models]
    Host --> Sys[nvidia-smi + systemctl]
    FS --> Treemap[Interactive Treemap<br/>drill / filter / bulk delete]
    UI -->|read| K8s[K8s via kubectl in doctor/estimate]
```

## Safety Invariants (Enforced)

- Heavy inference = **Job** + `OnFailure` + `backoff:1`
- Explicit requests **and** limits on every container
- No `Always` restart for large models
- NCCL only on high-speed interfaces for multi-node
- All mutations go through `manage.sh` (with prompts for heavy)

See AGENTS.md for the full list.
