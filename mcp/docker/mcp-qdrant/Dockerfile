# Purpose: Prebuilt mcp-server-qdrant gateway
# Build: docker build -f mcp/docker/mcp-qdrant/Dockerfile -t lab-mcp/mcp-qdrant:local .
FROM python:3.12-slim
RUN pip install --no-cache-dir uv
ENV FASTMCP_SERVER_HOST=0.0.0.0
ENV FASTMCP_SERVER_PORT=8000
EXPOSE 8000
CMD ["uvx", "mcp-server-qdrant", "--transport", "sse"]
