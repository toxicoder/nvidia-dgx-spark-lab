# Purpose: Prebuilt MCP fetch gateway (supergateway + mcp-server-fetch)
# Build: docker build -f mcp/docker/mcp-fetch/Dockerfile -t lab-mcp/mcp-fetch:local .
FROM python:3.12-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends nodejs npm curl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g supergateway \
  && pip install --no-cache-dir uv
EXPOSE 8000
CMD ["supergateway", "--stdio", "uvx mcp-server-fetch", "--port", "8000", \
     "--ssePath", "/sse", "--streamableHttpPath", "/mcp", \
     "--baseUrl", "http://127.0.0.1:8000"]
