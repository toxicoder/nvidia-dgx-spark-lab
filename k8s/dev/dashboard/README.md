Custom lab dashboard (Next.js 16).

The active implementation lives in the repository root `dashboard/` directory:

- Next.js 16 App Router + React Server Components + Server Actions
- Panels: Tasks (docker/ollama), Storage (interactive Treemap), Machine State, Utilities
- Auth: better-auth (email/password) + Drizzle SQLite persistence
- Docker image: build from **repo root**:

```bash
docker build -t lab-dashboard:local -f dashboard/Dockerfile .
```

- Deployed via `deployment.yaml` (NodePort 32082, `/data` SQLite volume, scoped host mounts for `/mnt/models` + docker.sock)
- Auth Secret: see `auth-secret.yaml.example`
- RBAC: read-only access to pods/jobs/nodes/events (see `rbac.yaml`)

The old static nginx + ConfigMap HTML/Python backend was removed during 2026 legacy cleanup.

See `dashboard/AGENTS.md`, `docs/dev-workspaces.md`, and `scripts/manage.sh start-monitoring`.