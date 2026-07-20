# MCP Agent Toolkit

Privacy-first Model Context Protocol services for agentic coding on the DGX Spark lab.

## Quick start

```bash
# Create secrets (optional but recommended)
kubectl create namespace agent-tools --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic mcp-secrets -n agent-tools \
  --from-literal=SEARXNG_SECRET="$(openssl rand -hex 32)" \
  --from-literal=CONTEXT7_API_KEY="your-key" \
  --dry-run=client -o yaml | kubectl apply -f -

# Deploy default stack
bazelisk run //scripts:run-utility -- mcp-stack start mcp-agent-toolkit --confirm yes

# Or via manage.sh
./scripts/manage.sh start-mcp
```

## Stacks

| Stack ID | Resources | Components |
|----------|-----------|------------|
| `mcp-agent-toolkit` | ~650m CPU / 768Mi | Redis, SearXNG, searxng-deepdive, fetch, memory, Context7 proxy |
| `mcp-agent-toolkit-full` | ~4 CPU / 12Gi | Default + Qdrant, Firecrawl, doc-ingest CronJob |
| `mcp-agent-toolkit-gitea` | +100m CPU | Default + gitea-mcp |

## NodePorts (workstation clients)

| Service | Port |
|---------|------|
| searxng-deepdive MCP | 32100 |
| fetch MCP | 32101 |
| qdrant MCP | 32102 |
| Context7 cache proxy | 32103 |
| gitea MCP | 32104 |
| memory MCP | 32105 |
| firecrawl MCP | 32106 |

Copy client templates from `mcp/config/clients/` and replace `<node-ip>`.

## Privacy tiers

1. **Fully private (default on):** SearXNG, fetch, filesystem/git (workstation), Qdrant, gitea-mcp
2. **Optional cloud (default on, disableable):** Context7 via `CONTEXT7_ENABLED=false` on context7-proxy
3. **Avoid for privacy:** Remote GitHub MCP, Firecrawl/Mem0 cloud APIs

Context7 responses are cached in Redis (7-day TTL) to minimize outbound queries.

## Disable Context7

```bash
kubectl set env deployment/context7-proxy -n agent-tools CONTEXT7_ENABLED=false
```

Agents then fall back to the `library-docs` Qdrant collection (populate via doc-ingest or full stack).

## Full RAG doc pipeline

Requires `nemotron-retriever-embed` running in `ai-inference`:

```bash
# Nemotron orchestrator (1 node)
bazelisk run //scripts:run-utility -- nemotron-stack start nemotron-agentic-spark-1 --confirm yes

# Qwen tier substitute (2 nodes — 397B int4-AutoRound when NVFP4 397B won't fit)
bazelisk run //scripts:run-utility -- nemotron-stack start qwen-agentic-spark-2 --confirm yes

bazelisk run //scripts:run-utility -- mcp-stack start mcp-agent-toolkit-full --confirm yes
```

Edit `mcp/k8s/workloads/doc-ingest/doc-sources.json` to add documentation URLs to crawl.

## Container images

MCP gateways use **pre-baked** local images (`lab-mcp/<name>:local`) so pods do not
`apt`/`npm`/`pip` install at startup. Build before first deploy:

```bash
bazelisk run //scripts:run-utility -- build-mcp-images run
# or a single component:
bazelisk run //scripts:run-utility -- build-mcp-images run -- component=mcp-fetch
```

Dockerfiles live under `mcp/docker/<name>/`. Deployments set `imagePullPolicy: IfNotPresent`
so a local tag is enough on single-node labs (import into the cluster runtime if needed).

## GitHub vs Gitea

- **Gitea/Forgejo:** runs on-cluster (`mcp-gitea`, NodePort 32104)
- **GitHub:** run `github-mcp-server` locally on your workstation (OAuth needs loopback) — see `mcp/config/clients/cursor.mcp.json.example`

## Security

- Treat search snippets and fetched pages as untrusted (prompt injection risk)
- Create `mcp-secrets` before production; never commit real tokens
- NetworkPolicies restrict SSRF from fetch pods

## Layout

```
mcp/
├── config/          # policy, SearXNG settings, client templates
├── k8s/             # agent-tools namespace workloads
├── docker/          # Dockerfiles only (COPY from k8s/workloads/)
└── README.md
```