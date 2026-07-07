# Nemotron Retriever Rerank

CPU-only NIM reranking service for RAG retrieval.

**What's on this page**

- NIM Deployment for Nemotron Retriever Rerank (CPU-only) with explicit resources, replicas 1
- Requirements, usage via kubectl/kustomize, safety notes

**What this enables**

- Running Nemotron Retriever Rerank as a long-lived NIM service in `ai-inference`

## Requirements

- NIM image: `nvcr.io/nim/nvidia/llama-nemotron-rerank-v1:1.0.0`
- Model cache at `/mnt/models/nim-cache`
- Port 8000 exposed via ClusterIP service

## Usage

```bash
kubectl apply -k k8s/workloads/nemotron-retriever-rerank/
```

## Safety

- Explicit `resources.requests` + `limits`
- Deployment `replicas: 1` (no Job backoff; managed by Deployment controller)
- Always run `stop` before reboot (see reboot-safety.md)
