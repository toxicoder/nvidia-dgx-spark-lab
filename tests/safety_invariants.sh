#!/usr/bin/env bash
# Hermetic safety invariant checks for production Kubernetes manifests.
# Hermetic counterpart to Makefile test-k8s; included in //:test-fast.
set -euo pipefail

ROOT="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$ROOT"

KIMI="k8s/workloads/kimi/kimi-job.yaml"
KIMI_TEST="k8s/workloads/kimi-test/kimi-test-job.yaml"
NEMOTRON="k8s/workloads/nemotron-3-ultra/nemotron-3-ultra-job.yaml"
GLM="k8s/workloads/glm-5.2/glm-5.2-job.yaml"
GLM_RPC="k8s/workloads/glm-5.2/glm-5.2-rpc-job.yaml"
RAY_HEAD="k8s/workloads/ray-head/ray-head-job.yaml"
RAY_WORKER="k8s/workloads/ray-worker/ray-worker-job.yaml"

echo "Checking restart policies in production manifests..."
grep -E 'restartPolicy: (OnFailure|Never)' \
  "$KIMI" "$KIMI_TEST" "$NEMOTRON" "$GLM" "$GLM_RPC" "$RAY_HEAD" "$RAY_WORKER"

echo "Checking backoff limits on heavy workloads..."
grep -E 'backoffLimit: [0-9]+' "$KIMI" "$RAY_HEAD" "$RAY_WORKER"

echo "Checking NCCL high-speed interconnect configuration..."
grep -q 'NCCL_SOCKET_IFNAME' "$KIMI" "$KIMI_TEST" "$NEMOTRON" "$GLM" "$GLM_RPC"

echo "Checking resource limits in inference workloads..."
grep -q 'resources:' "$KIMI" "$KIMI_TEST" "$NEMOTRON" "$GLM" "$GLM_RPC"

echo "Checking ray GPU resources..."
grep -q 'nvidia.com/gpu' "$RAY_HEAD" "$RAY_WORKER"

echo "Checking securityContext and health probes on kimi..."
grep -q 'securityContext:' "$KIMI"
grep -q 'readinessProbe:' "$KIMI"
grep -q 'livenessProbe:' "$KIMI"

# Additional belt-and-suspenders checks from Makefile test-k8s
grep -q 'restartPolicy: OnFailure' "$KIMI" || {
  echo "Wrong restartPolicy in kimi-job"
  exit 1
}
grep -q 'backoffLimit: 1' "$KIMI" || {
  echo "Heavy workload should have low backoffLimit"
  exit 1
}
grep -q 'resources:' "$RAY_HEAD" || {
  echo "Missing resources in ray-head"
  exit 1
}
grep -q 'resources:' "$RAY_WORKER" || {
  echo "Missing resources in ray-worker"
  exit 1
}

echo "Checking lab domain config and generated SSO manifests..."
test -f config/lab-domains.yaml
test -f config/lab-domains.json
test -f k8s/auth/generated/routes.yaml
test -f k8s/cert-manager/generated/wildcard-certificate.yaml
python3 -c "
import json
from pathlib import Path
j = json.loads(Path('config/lab-domains.json').read_text())
assert j.get('local_domain'), 'lab-domains.json missing local_domain'
"

echo "Checking Resource Guard policy and manifests..."
test -f config/resource-policy.yaml
test -f config/resource-policy.json
python3 -c "
import json
from pathlib import Path
j = json.loads(Path('config/resource-policy.json').read_text())
assert 'models' in j and 'kimi-test' in j['models']
assert 'stacks' in j and 'nemotron-agentic-spark-1' in j['stacks']
assert 'headroom' in j
"

grep -q 'lab-management' k8s/base/resource-guard/priority-classes.yaml
grep -q 'lab-inference-quota' k8s/base/resource-guard/resource-quotas.yaml
grep -q 'priorityClassName: lab-management' k8s/dev/dashboard/deployment.yaml

echo "Checking model registry matches policy..."
for m in kimi-test kimi ray-head ray-worker nemotron-3-ultra \
  nemotron-3-nano-30b nemotron-3-nano-omni-30b nemotron-3-super-120b \
  nemotron-retriever-embed nemotron-retriever-rerank nemotron-parse \
  nemotron-safety-guard nemotron-speech-asr nemotron-speech-tts \
  glm-5.2 glm-5.2-rpc \
  qwen3.5-122b-a10b-nvfp4 qwen3.5-397b-spark2 qwen3.5-397b-nvfp4 \
  qwen3.5-397b-nvfp4-worker-1 qwen3.5-397b-nvfp4-worker-2 qwen3.5-397b-nvfp4-worker-3 \
  qwen3.6-27b-nvfp4 qwen3.6-35b-a3b-nvfp4 \
  comfy-base flux-fast flux-quality; do
  python3 -c "
import json, sys
from pathlib import Path
j = json.loads(Path('config/resource-policy.json').read_text())
sys.exit(0 if '$m' in j.get('models', {}) else 1)
"
done

echo "Checking Nemotron agentic Deployment workloads have resources..."
for dep in \
  k8s/workloads/nemotron-parse/nemotron-parse-deployment.yaml \
  k8s/workloads/nemotron-retriever-embed/nemotron-retriever-embed-deployment.yaml \
  k8s/workloads/nemotron-retriever-rerank/nemotron-retriever-rerank-deployment.yaml \
  k8s/workloads/nemotron-safety-guard/nemotron-safety-guard-deployment.yaml \
  k8s/workloads/nemotron-speech-asr/nemotron-speech-asr-deployment.yaml \
  k8s/workloads/nemotron-speech-tts/nemotron-speech-tts-deployment.yaml; do
  test -f "$dep"
  grep -q 'resources:' "$dep"
  grep -qE 'kind:\s*Deployment' "$dep"
done

echo "Checking visual ComfyUI base Deployment safety fields..."
COMFY_BASE="k8s/workloads/comfy-base/comfy-base-deployment.yaml"
test -f "$COMFY_BASE"
grep -qE 'kind:\s*Deployment' "$COMFY_BASE"
grep -q 'resources:' "$COMFY_BASE"
grep -q 'nvidia.com/gpu' "$COMFY_BASE"
grep -q 'securityContext:' "$COMFY_BASE"
grep -q 'workload: visual' "$COMFY_BASE"
grep -q 'PYTORCH_CUDA_ALLOC_CONF' "$COMFY_BASE"
grep -q 'expandable_segments:True' "$COMFY_BASE"
test -f k8s/workloads/comfy-base/pvc.yaml
test -f k8s/workloads/comfy-base/scripts/install-comfy.sh
test -f k8s/workloads/comfy-base/scripts/run-comfy.sh
test -f k8s/workloads/comfy-base/scripts/patch_get_free_memory.py
grep -q 'LAB_SPARK_UNIFIED_MEMORY_PATCH\|virtual_memory\|get_free_memory' \
  k8s/workloads/comfy-base/scripts/patch_get_free_memory.py
grep -q 'configMapGenerator' k8s/workloads/comfy-base/kustomization.yaml
grep -q 'disableNameSuffixHash' k8s/workloads/comfy-base/kustomization.yaml
python3 -c "
import json
from pathlib import Path
j = json.loads(Path('config/resource-policy.json').read_text())
m = j['models']['comfy-base']
assert m.get('kind') == 'deployment'
assert m.get('gpus') == 1
"
echo "Checking flux visual overlays exist and register as deployments..."
for d in \
  k8s/workloads/comfy-visual/flux/fast \
  k8s/workloads/comfy-visual/flux/quality; do
  test -f "${d}/kustomization.yaml"
  test -f "${d}/patches/deployment.json"
done
python3 -c "
import json
from pathlib import Path
j = json.loads(Path('config/resource-policy.json').read_text())
for mid in ('flux-fast', 'flux-quality'):
    m = j['models'][mid]
    assert m.get('kind') == 'deployment', mid
    assert m.get('gpus') == 1, mid
"
test -f scripts/utilities/download-flux.sh

echo "Checking extended Nemotron LLM Jobs have safety fields..."
for job in \
  k8s/workloads/nemotron-3-nano-30b/nemotron-3-nano-30b-job.yaml \
  k8s/workloads/nemotron-3-nano-omni-30b/nemotron-3-nano-omni-30b-job.yaml \
  k8s/workloads/nemotron-3-super-120b/nemotron-3-super-120b-job.yaml \
  k8s/workloads/qwen3.5-122b-a10b-nvfp4/qwen3.5-122b-a10b-nvfp4-job.yaml \
  k8s/workloads/qwen3.5-397b-spark2/qwen3.5-397b-spark2-job.yaml \
  k8s/workloads/qwen3.5-397b-nvfp4/qwen3.5-397b-nvfp4-job.yaml \
  k8s/workloads/qwen3.6-27b-nvfp4/qwen3.6-27b-nvfp4-job.yaml \
  k8s/workloads/qwen3.6-35b-a3b-nvfp4/qwen3.6-35b-a3b-nvfp4-job.yaml; do
  test -f "$job"
  grep -q 'restartPolicy: OnFailure' "$job"
  grep -q 'resources:' "$job"
  grep -q 'backoffLimit:' "$job"
done

echo "Checking Qwen3.6 dual stack policy registration..."
python3 -c "
import json
from pathlib import Path
j = json.loads(Path('config/resource-policy.json').read_text())
assert 'qwen36-dual-spark-1' in j.get('stacks', {}), 'missing qwen36-dual-spark-1 stack'
stack = j['stacks']['qwen36-dual-spark-1']
assert 'qwen3.6-27b-nvfp4' in stack.get('stack_with', [])
assert 'qwen3.6-35b-a3b-nvfp4' in stack.get('stack_with', [])
"

echo "Checking Open WebUI policy and resource registration..."
test -f config/open-webui-policy.yaml
test -f config/open-webui-policy.json
test -f ansible/files/open-webui-values.yaml
test -f k8s/dev/open-webui/hermes-gateway.yaml
grep -q 'open-webui-lab' config/open-webui-policy.yaml
grep -q 'open-webui:' config/resource-policy.yaml
python3 -c "
import json
from pathlib import Path
j = json.loads(Path('config/resource-policy.json').read_text())
svc = j.get('tiers', {}).get('optional_dev', {}).get('services', {}).get('open-webui', {})
assert svc.get('namespace') == 'dev'
assert 'helm_release' in svc
assert 'open-webui-lab' in j.get('stacks', {})
"

echo "Checking monitoring stack config..."
test -f config/monitoring-probes.yaml
test -f scripts/lib/monitoring.sh
test -f scripts/utilities/monitoring-stack.sh
test -f ansible/files/prometheus-values.yaml
test -f ansible/files/grafana-values.yaml
test -f config/grafana/dashboards/00-lab-overview.json
grep -q 'prometheus:' config/resource-policy.yaml
grep -q 'lab-monitoring-quota' k8s/base/resource-guard/resource-quotas.yaml
grep -q 'requests.cpu: "4"' k8s/base/resource-guard/resource-quotas.yaml
grep -q 'prometheus.io/scrape' k8s/workloads/kimi/kimi-job.yaml

echo "Checking Hermes workspace-dev profile and policy..."
test -f hermes/profiles/workspace-dev/distribution.yaml
test -f hermes/profiles/workspace-dev/config.yaml
test -f hermes/profiles/workspace-dev/SOUL.md
grep -q 'hermes-workspace-dev' hermes/config/hermes-policy.yaml
grep -q 'in_cluster' hermes/config/hermes-policy.yaml
grep -q 'svc.cluster.local' hermes/profiles/workspace-dev/config.yaml
grep -q '127.0.0.1:32100' hermes/config/hermes-policy.yaml

python3 - <<'PY'
import sys
from pathlib import Path

policy_text = Path("hermes/config/hermes-policy.yaml").read_text()
if "hermes-lab:" not in policy_text or "mcp_url_mode: host_localhost" not in policy_text:
    print("hermes-lab must keep host_localhost URL mode", file=sys.stderr)
    sys.exit(1)

ws_cfg = Path("hermes/profiles/workspace-dev/config.yaml").read_text()
if "127.0.0.1" in ws_cfg:
    print("workspace-dev config must not use host localhost URLs", file=sys.stderr)
    sys.exit(1)
PY

test -f k8s/dev/templates/coder-spark-lab/main.tf
test -f k8s/dev/images/coder-workspace/Dockerfile
test -f k8s/dev/images/kasm-spark-desktop/Dockerfile
grep -q 'coder-workspaces' k8s/base/namespaces-dev.yaml

echo "Checking MCP agent toolkit policy and manifests..."
test -f mcp/config/mcp-policy.yaml
test -f mcp/k8s/base/namespace.yaml
test -f mcp/k8s/base/network-policy.yaml
grep -q 'agent-tools' mcp/k8s/base/namespace.yaml
grep -q 'priorityClassName: lab-optional' mcp/k8s/workloads/context7-proxy/deployment.yaml
grep -q 'resources:' mcp/k8s/workloads/qdrant/statefulset.yaml

echo "Checking SSO policy..."
test -f config/sso-policy.yaml
grep -q 'authelia' config/sso-policy.yaml

echo "All critical safety checks passed"