# Purpose: Prebuilt gitea-mcp gateway
# Build: docker build -f mcp/docker/mcp-gitea/Dockerfile -t lab-mcp/mcp-gitea:local .
FROM python:3.12-slim
RUN pip install --no-cache-dir uv \
  && uvx --from gitea-mcp gitea-mcp --help >/dev/null 2>&1 || true
# uvx caches tools at runtime on first call; pre-warm when package available
EXPOSE 8000
CMD ["uvx", "gitea-mcp", "serve", "--transport", "http", "--host", "0.0.0.0", "--port", "8000", "--path", "/mcp"]
