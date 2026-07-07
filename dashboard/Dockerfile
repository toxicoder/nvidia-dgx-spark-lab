# Multi-stage self-hosted Next.js standalone image.
#
# Build from the repository root (includes scripts/utilities for the Utilities panel):
#   docker build -t lab-dashboard:local -f dashboard/Dockerfile .
#
# Run locally:
#   docker run --rm -p 3000:3000 \
#     -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
#     -e LAB_DASHBOARD_ADMIN_EMAIL=admin@lab.local \
#     -e LAB_DASHBOARD_ADMIN_PASSWORD=change-me \
#     lab-dashboard:local

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat bash curl \
  && KVER="$(curl -L -s https://dl.k8s.io/release/stable.txt)" \
  && curl -fsSL "https://dl.k8s.io/release/${KVER}/bin/linux/amd64/kubectl" -o /usr/local/bin/kubectl \
  && chmod +x /usr/local/bin/kubectl \
  && curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | HELM_INSTALL_DIR=/usr/local/bin USE_SUDO=false bash

FROM base AS deps
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY dashboard/ ./
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/lab-dashboard.db
ENV MIGRATIONS_DIR=/app/lib/db/migrations
RUN mkdir -p /data

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/lib/db/migrations ./lib/db/migrations
COPY --from=builder /app/scripts/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=builder /app/scripts/migrate.cjs ./scripts/migrate.cjs
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY scripts/utilities /app/scripts/utilities
COPY scripts/lib /app/scripts/lib
COPY config/resource-policy.json /app/config/resource-policy.json
COPY k8s/workloads /app/k8s/workloads
COPY k8s/base /app/k8s/base
COPY ansible/files/coder-values.yaml /app/ansible/files/coder-values.yaml

RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]