# Purpose: Prebuilt doc-ingest CronJob image
# Build: docker build -f mcp/docker/doc-ingest/Dockerfile -t lab-mcp/doc-ingest:local .
FROM python:3.12-slim
RUN pip install --no-cache-dir requests
WORKDIR /scripts
COPY mcp/k8s/workloads/doc-ingest/ingest.py /scripts/ingest.py
CMD ["python", "/scripts/ingest.py"]
