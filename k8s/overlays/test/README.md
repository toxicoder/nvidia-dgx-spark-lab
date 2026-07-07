# overlays/test

Light / test overlay.

Uses reduced resources (see patches/test-resources.yaml) for safe first runs.

## Purpose

Validate the full stack (K3s, GPU operator, scheduling, NCCL on multi-node, monitoring) without risking host stability.

Start with `manage.sh start-test` which targets the lighter manifests.