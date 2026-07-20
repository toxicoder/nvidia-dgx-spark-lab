# Purpose: Prebuilt MCP searxng deepdive gateway
# Build: docker build -f mcp/docker/mcp-searxng/Dockerfile -t lab-mcp/mcp-searxng:local .
FROM node:22-bookworm-slim
RUN npm install -g supergateway
EXPOSE 8000
CMD ["supergateway", "--stdio", "npx -y searxng-deepdive", \
     "--port", "8000", "--ssePath", "/sse", "--streamableHttpPath", "/mcp", \
     "--baseUrl", "http://127.0.0.1:8000"]
