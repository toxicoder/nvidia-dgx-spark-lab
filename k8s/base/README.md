# k8s/base

Base Kubernetes manifests shared across environments.

## Contents

- namespace.yaml : the ai-inference namespace (and any other common ns setup)

## Usage

Included by workloads and overlays via kustomize or direct apply.

See k8s/overlays/ and the workload directories.

Safety: Namespace is lightweight. Workloads inside it must still declare proper resources and OnFailure restart policies.