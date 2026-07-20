# Purpose: Prebuilt firecrawl MCP gateway
# Build: docker build -f mcp/docker/mcp-firecrawl/Dockerfile -t lab-mcp/mcp-firecrawl:local .
FROM node:22-bookworm-slim
RUN npm install -g supergateway firecrawl-mcp
EXPOSE 8000
CMD ["supergateway", "--stdio", "npx -y firecrawl-mcp", \
     "--port", "8000", "--ssePath", "/sse", "--streamableHttpPath", "/mcp", \
     "--baseUrl", "http://127.0.0.1:8000"]
