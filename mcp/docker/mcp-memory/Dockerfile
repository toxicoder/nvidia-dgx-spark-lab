# Purpose: Prebuilt MCP memory gateway (supergateway + server-memory)
# Build: docker build -f mcp/docker/mcp-memory/Dockerfile -t lab-mcp/mcp-memory:local .
FROM node:22-bookworm-slim
RUN npm install -g supergateway @modelcontextprotocol/server-memory
EXPOSE 8000
CMD ["supergateway", "--stdio", "npx -y @modelcontextprotocol/server-memory /data/memory.json", \
     "--port", "8000", "--ssePath", "/sse", "--streamableHttpPath", "/mcp", \
     "--baseUrl", "http://127.0.0.1:8000"]
