---
title: MCP Agent Toolkit
description: Self-hosted MCP servers for private web search, documentation, codebase exploration, and agent memory on K3s.
tags: [mcp, agents, privacy, searxng, qdrant]
---

# MCP Agent Toolkit

**What's on this page**

- Deploy commands and stack catalog for MCP workloads on K3s
- Integration with Nemotron, Qwen, and Hermes agent flows
- Security model (API keys, NetworkPolicies — not SSO)

**What this enables**

- Self-hosted MCP tools (search, memory, fetch, docs) without external SaaS dependencies
- Agentic stacks that combine private retrieval with lab inference tiers

Deploy privacy-preserving MCP services alongside the Nemotron agentic stack.

## Deploy

```bash
bazelisk run //scripts:run-utility -- mcp-stack catalog
bazelisk run //scripts:run-utility -- mcp-stack start mcp-agent-toolkit --confirm yes
```

See [mcp/README.md](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/mcp/README.md) for secrets, NodePorts, and client configuration.

## Integration with Nemotron / Qwen

The full stack (`mcp-agent-toolkit-full`) uses `nemotron-retriever-embed` for document chunk embeddings and Qdrant for retrieval — the same RAG pillar as Nemotron and Qwen agentic presets.

Pair with a Qwen tier stack when the frontier 397B NVFP4 model does not fit your cluster:

```bash
bazelisk run //scripts:run-utility -- nemotron-stack start qwen-agentic-spark-2 --confirm yes
bazelisk run //scripts:run-utility -- mcp-stack start mcp-agent-toolkit-full --confirm yes
```

## Related

- [nemotron-agentic-stack.md](nemotron-agentic-stack.md)
- [hermes-agent.md](hermes-agent.md)
- [dev-workspaces.md](dev-workspaces.md)