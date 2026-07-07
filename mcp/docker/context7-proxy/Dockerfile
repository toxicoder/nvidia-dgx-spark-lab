FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir \
  fastapi==0.115.6 \
  uvicorn[standard]==0.34.0 \
  httpx==0.28.1 \
  redis==5.2.1 \
  pyyaml==6.0.2

COPY ../../k8s/workloads/context7-proxy/server.py /app/server.py
COPY ../../k8s/workloads/context7-proxy/config.yaml /app/config.yaml

EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]