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
assert j['headroom'].get('memory_min_per_node') == '24Gi', j['headroom']
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
  qwen3.8-27b-nvfp4 qwen3.8-flash-next-nvfp4 medgemma-27b medgemma-4b \
  glm-5.3-flash glm-5.3-flash-worker-1 glm-5.3-flash-worker-2 litellm \
  deepseek-v4.1-flash deepseek-v4.1-flash-worker-1 deepseek-v4.1-flash-worker-2 \
  comfy-base flux-fast flux-quality ltx-balanced ltx-quality flux-to-ltx; do
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
echo "Checking flux/ltx visual overlays exist and register as deployments..."
for d in \
  k8s/workloads/comfy-visual/flux/fast \
  k8s/workloads/comfy-visual/flux/quality \
  k8s/workloads/comfy-visual/ltx/balanced \
  k8s/workloads/comfy-visual/ltx/quality \
  k8s/workloads/comfy-visual/flux-to-ltx; do
  test -f "${d}/kustomization.yaml"
  test -f "${d}/patches/deployment.json"
  grep -q 'configMapGenerator' "${d}/kustomization.yaml"
  # Workflow JSON is a real file (not ConfigMap data: | embed)
  test "$(find "${d}/workflows" -name 'lab-*.json' 2>/dev/null | wc -l | tr -d ' ')" -ge 1
  for wf in "${d}"/workflows/lab-*.json; do
    python3 -m json.tool "$wf" >/dev/null
  done
done
python3 -c "
import json
from pathlib import Path
j = json.loads(Path('config/resource-policy.json').read_text())
for mid in ('flux-fast', 'flux-quality', 'ltx-balanced', 'ltx-quality', 'flux-to-ltx'):
    m = j['models'][mid]
    assert m.get('kind') == 'deployment', mid
    assert m.get('gpus') == 1, mid
assert j['models']['flux-to-ltx']['memory'] == '90Gi'
"
test -f scripts/utilities/download-flux.sh
test -f scripts/utilities/download-ltx.sh

echo "Checking extended Nemotron LLM Jobs have safety fields..."
for job in \
  k8s/workloads/nemotron-3-nano-30b/nemotron-3-nano-30b-job.yaml \
  k8s/workloads/nemotron-3-nano-omni-30b/nemotron-3-nano-omni-30b-job.yaml \
  k8s/workloads/nemotron-3-super-120b/nemotron-3-super-120b-job.yaml \
  k8s/workloads/qwen3.5-122b-a10b-nvfp4/qwen3.5-122b-a10b-nvfp4-job.yaml \
  k8s/workloads/qwen3.5-397b-spark2/qwen3.5-397b-spark2-job.yaml \
  k8s/workloads/qwen3.5-397b-nvfp4/qwen3.5-397b-nvfp4-job.yaml \
  k8s/workloads/qwen3.6-27b-nvfp4/qwen3.6-27b-nvfp4-job.yaml \
  k8s/workloads/qwen3.6-35b-a3b-nvfp4/qwen3.6-35b-a3b-nvfp4-job.yaml \
  k8s/workloads/qwen3.8-27b-nvfp4/qwen3.8-27b-nvfp4-job.yaml; do
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

echo "Checking 3-node LiteLLM rounded stack policy registration..."
for m in qwen3.8-flash-next-nvfp4 medgemma-27b medgemma-4b \
  glm-5.3-flash glm-5.3-flash-worker-1 glm-5.3-flash-worker-2 litellm \
  deepseek-v4.1-flash deepseek-v4.1-flash-worker-1 deepseek-v4.1-flash-worker-2; do
  python3 -c "
import json, sys
from pathlib import Path
j = json.loads(Path('config/resource-policy.json').read_text())
sys.exit(0 if '$m' in j.get('models', {}) else 1)
"
done
python3 -c "
import json
from pathlib import Path
j = json.loads(Path('config/resource-policy.json').read_text())
for sid in ('rounded-spark-3', 'rounded-spark-3-quality', 'glm53-flash-spark-3', 'dsv41-flash-spark-3'):
    assert sid in j.get('stacks', {}), sid
rounded = j['stacks']['rounded-spark-3']
assert 'qwen3.6-35b-a3b-nvfp4' in rounded.get('stack_with', [])
assert 'qwen3.8-flash-next-nvfp4' in rounded.get('stack_with', [])
assert 'medgemma-27b' in rounded.get('stack_with', [])
assert 'litellm' in rounded.get('stack_with', [])
quality = j['stacks']['rounded-spark-3-quality']
assert 'qwen3.6-27b-nvfp4' in quality.get('stack_with', [])
assert 'medgemma-27b' not in quality.get('stack_with', [])
glm = j['stacks']['glm53-flash-spark-3']
assert glm.get('min_nodes') == 3
assert 'glm-5.3-flash' in glm.get('stack_with', [])
dsv = j['stacks']['dsv41-flash-spark-3']
assert dsv.get('min_nodes') == 3
assert dsv.get('max_nodes') == 3
assert 'deepseek-v4.1-flash' in dsv.get('stack_with', [])
assert 'deepseek-v4.1-flash-worker-1' in dsv.get('stack_with', [])
assert 'deepseek-v4.1-flash-worker-2' in dsv.get('stack_with', [])
litellm = j['models']['litellm']
assert litellm.get('kind') == 'deployment'
assert litellm.get('gpus') == 0
assert litellm.get('heavy') is False
svc = j.get('tiers', {}).get('management', {}).get('services', {}).get('litellm', {})
assert svc.get('namespace') == 'ai-inference'
"

echo "Checking rounded-stack Mode A Jobs have safety fields..."
for job in \
  k8s/workloads/qwen3.8-27b-nvfp4/qwen3.8-27b-nvfp4-job.yaml \
  k8s/workloads/qwen3.8-flash-next-nvfp4/qwen3.8-flash-next-nvfp4-job.yaml \
  k8s/workloads/medgemma-27b/medgemma-27b-job.yaml \
  k8s/workloads/medgemma-4b/medgemma-4b-job.yaml; do
  test -f "$job"
  grep -q 'restartPolicy: OnFailure' "$job"
  grep -q 'resources:' "$job"
  grep -q 'backoffLimit:' "$job"
  grep -q 'nvidia.com/gpu' "$job"
  # Mode A is TP=1: must not bake the 3-node ring NCCL block.
  if grep -q 'NCCL_IB_SUBNET_AWARE_ROUTING' "$job"; then
    echo "Mode A job must not set 3-node ring NCCL_IB_SUBNET_AWARE_ROUTING: $job" >&2
    exit 1
  fi
done

echo "Checking GLM-5.3-Flash Mode B Jobs use ring NCCL (not 2-node pair vars)..."
for job in \
  k8s/workloads/glm-5.3-flash/glm-5.3-flash-job.yaml \
  k8s/workloads/glm-5.3-flash/glm-5.3-flash-worker-1-job.yaml \
  k8s/workloads/glm-5.3-flash/glm-5.3-flash-worker-2-job.yaml; do
  test -f "$job"
  grep -q 'restartPolicy: OnFailure' "$job"
  grep -q 'resources:' "$job"
  grep -q 'backoffLimit:' "$job"
  grep -q 'hostNetwork: true' "$job"
  grep -q 'hostIPC: true' "$job"
  grep -q 'NCCL_IB_SUBNET_AWARE_ROUTING' "$job"
  grep -q 'NCCL_NET_PLUGIN' "$job"
  grep -q 'NCCL_IB_MERGE_NICS' "$job"
  if grep -q 'enp1s0f0np0,enp1s0f1np1' "$job"; then
    echo "Mode B must not copy 2-node pair NCCL_SOCKET_IFNAME: $job" >&2
    exit 1
  fi
  if grep -q 'mlx5_0,mlx5_1' "$job"; then
    echo "Mode B must not copy 2-node mlx5 NCCL_IB_HCA: $job" >&2
    exit 1
  fi
done
grep -q 'NCCL_NET_PLUGIN' k8s/workloads/glm-5.3-flash/glm-5.3-flash-job.yaml
grep -q 'none' k8s/workloads/glm-5.3-flash/glm-5.3-flash-job.yaml

echo "Checking Mode A Jobs keep gpu-memory-utilization <= 0.82..."
python3 -c "
import re, sys
from pathlib import Path
jobs = [
    Path('k8s/workloads/qwen3.8-27b-nvfp4/qwen3.8-27b-nvfp4-job.yaml'),
    Path('k8s/workloads/qwen3.8-flash-next-nvfp4/qwen3.8-flash-next-nvfp4-job.yaml'),
    Path('k8s/workloads/medgemma-27b/medgemma-27b-job.yaml'),
    Path('k8s/workloads/medgemma-4b/medgemma-4b-job.yaml'),
]
pat = re.compile(r'gpu-memory-utilization[\"\\s=]+([0-9.]+)')
for p in jobs:
    text = p.read_text()
    vals = [float(x) for x in pat.findall(text)]
    env = re.findall(r'LAB_.*GPU_UTIL\\s*\\n\\s*value:\\s*\"([0-9.]+)\"', text)
    vals.extend(float(x) for x in env)
    if not vals:
        print(f'missing gpu-memory-utilization in {p}', file=sys.stderr)
        sys.exit(1)
    if any(v > 0.82 + 1e-9 for v in vals):
        print(f'Mode A gpu-mem-util > 0.82 in {p}: {vals}', file=sys.stderr)
        sys.exit(1)
    if any(v >= 0.88 - 1e-9 for v in vals):
        print(f'vLLM util 0.88/0.90 not shipped in {p}: {vals}', file=sys.stderr)
        sys.exit(1)
"

echo "Checking Mode B Jobs keep gpu-memory-utilization <= 0.85..."
python3 -c "
import re, sys
from pathlib import Path
jobs = [
    Path('k8s/workloads/glm-5.3-flash/glm-5.3-flash-job.yaml'),
    Path('k8s/workloads/glm-5.3-flash/glm-5.3-flash-worker-1-job.yaml'),
    Path('k8s/workloads/glm-5.3-flash/glm-5.3-flash-worker-2-job.yaml'),
]
pat = re.compile(r'gpu-memory-utilization[\"\\s=]+([0-9.]+)')
for p in jobs:
    text = p.read_text()
    vals = [float(x) for x in pat.findall(text)]
    if not vals:
        print(f'missing gpu-memory-utilization in {p}', file=sys.stderr)
        sys.exit(1)
    if any(v > 0.85 + 1e-9 for v in vals):
        print(f'Mode B gpu-mem-util > 0.85 in {p}: {vals}', file=sys.stderr)
        sys.exit(1)
    if any(v >= 0.88 - 1e-9 for v in vals):
        print(f'vLLM util 0.88/0.90 not shipped in {p}: {vals}', file=sys.stderr)
        sys.exit(1)
"

echo "Checking DeepSeek-V4.1-Flash Mode C Jobs (SGLang, ring NCCL, NVMe Engram)..."
DSV41_JOBS="
k8s/workloads/deepseek-v4.1-flash/deepseek-v4.1-flash-job.yaml
k8s/workloads/deepseek-v4.1-flash/deepseek-v4.1-flash-worker-1-job.yaml
k8s/workloads/deepseek-v4.1-flash/deepseek-v4.1-flash-worker-2-job.yaml
"
for job in $DSV41_JOBS; do
  test -f "$job"
  grep -q 'restartPolicy: OnFailure' "$job"
  grep -q 'resources:' "$job"
  grep -q 'backoffLimit:' "$job"
  grep -q 'hostNetwork: true' "$job"
  grep -q 'hostIPC: true' "$job"
  grep -q 'NCCL_IB_SUBNET_AWARE_ROUTING' "$job"
  grep -q 'NCCL_NET_PLUGIN' "$job"
  grep -q 'none' "$job"
  grep -q 'imagePullPolicy: IfNotPresent' "$job"
  grep -q 'expandable_segments:False' "$job"
  grep -q 'OFFLOAD_MODE' "$job"
  grep -q 'nvme' "$job"
  grep -q 'deepseek-ai/DeepSeek-V4.1-Flash' "$job"
  if grep -q 'enp1s0f0np0,enp1s0f1np1' "$job"; then
    echo "Mode C must not copy 2-node pair NCCL_SOCKET_IFNAME: $job" >&2
    exit 1
  fi
  if grep -q 'mlx5_0,mlx5_1' "$job"; then
    echo "Mode C must not copy 2-node mlx5 NCCL_IB_HCA: $job" >&2
    exit 1
  fi
  if grep -q 'enp1s0f0np0' "$job"; then
    echo "Mode C must not reference enp1s0f0np0: $job" >&2
    exit 1
  fi
  if grep -q 'mlx5_0' "$job"; then
    echo "Mode C must not reference mlx5_0: $job" >&2
    exit 1
  fi
  if grep -qi 'LibertAIDAI' "$job"; then
    echo "Mode C must not use LibertAIDAI requant: $job" >&2
    exit 1
  fi
  if grep -q 'nvidia/DeepSeek-V4-Flash-NVFP4' "$job"; then
    echo "Mode C must not use nvidia/DeepSeek-V4-Flash-NVFP4 (old 284B): $job" >&2
    exit 1
  fi
  if grep -q 'OFFLOAD_MODE' "$job" && grep -E 'OFFLOAD_MODE' -A2 "$job" | grep -q 'ram'; then
    echo "Mode C must not set OFFLOAD_MODE=ram: $job" >&2
    exit 1
  fi
  if grep -q 'expandable_segments:True' "$job"; then
    echo "Mode C must not copy Comfy expandable_segments:True: $job" >&2
    exit 1
  fi
done
python3 -c "
import re, sys
from pathlib import Path
jobs = [
    Path('k8s/workloads/deepseek-v4.1-flash/deepseek-v4.1-flash-job.yaml'),
    Path('k8s/workloads/deepseek-v4.1-flash/deepseek-v4.1-flash-worker-1-job.yaml'),
    Path('k8s/workloads/deepseek-v4.1-flash/deepseek-v4.1-flash-worker-2-job.yaml'),
]
pat = re.compile(r'mem-fraction-static[\"\\s=]+([0-9.]+)')
for p in jobs:
    text = p.read_text()
    vals = [float(x) for x in pat.findall(text)]
    if not vals:
        print(f'missing mem-fraction-static in {p}', file=sys.stderr)
        sys.exit(1)
    if any(v > 0.95 + 1e-9 for v in vals):
        print(f'Mode C mem-fraction-static > 0.95 in {p}: {vals}', file=sys.stderr)
        sys.exit(1)
    if re.search(r'gpu-memory-utilization', text):
        print(f'Mode C must use SGLang mem-fraction-static, not vLLM gpu-memory-utilization: {p}', file=sys.stderr)
        sys.exit(1)
"

echo "Checking rounded Mode A/B/C job lists are disjoint..."
python3 -c "
import re, sys
from pathlib import Path
text = Path('scripts/lib/stack-rounded.sh').read_text()

def jobs_from(fn):
    m = re.search(rf'{fn}\\(\\) \\{{(.*?)\\n\\}}', text, re.S)
    if not m:
        print(f'missing {fn}', file=sys.stderr)
        sys.exit(1)
    return set(re.findall(r'^[ \\t]+([a-z0-9][a-z0-9.-]*-[a-z0-9][a-z0-9.-]*)\\s*\\\\?\\s*$', m.group(1), re.M))

a, b, c = jobs_from('rounded_mode_a_jobs'), jobs_from('rounded_mode_b_jobs'), jobs_from('rounded_mode_c_jobs')
if not a or not b or not c:
    print(f'empty mode lists a={a} b={b} c={c}', file=sys.stderr)
    sys.exit(1)
if a & b or a & c or b & c:
    print(f'mode job lists overlap a={a} b={b} c={c}', file=sys.stderr)
    sys.exit(1)
"

echo "Checking LiteLLM has no DeepSeek API key and lab-med stays on-cluster..."
if grep -RInE 'sk-[a-zA-Z0-9]{20,}|DEEPSEEK_API_KEY\\s*:\\s*[\"'\''][^\"'\'']+' k8s/workloads/litellm config --include='*.yaml' --include='*.txt' --include='*.example.yaml' 2>/dev/null | grep -v 'sk-change-me' | grep -v 'sk-lab-local' | grep -q .; then
  echo "LiteLLM tree must not contain a live DeepSeek API key" >&2
  exit 1
fi
if grep -E 'model_name:\\s*lab-med' -A20 k8s/workloads/litellm/files/litellm_config.yaml | grep -qiE 'deepseek-flash|api.deepseek.com'; then
  echo "lab-med must not point at the DeepSeek cloud API" >&2
  exit 1
fi

echo "Checking LiteLLM management Deployment and ConfigMap files..."
LITELLM_DEP="k8s/workloads/litellm/litellm-deployment.yaml"
LITELLM_KUST="k8s/workloads/litellm/kustomization.yaml"
test -f "$LITELLM_DEP"
test -f "$LITELLM_KUST"
test -f k8s/workloads/litellm/service.yaml
test -f k8s/workloads/litellm/files/litellm_config.yaml
test -f k8s/workloads/litellm/files/lab-med-system.txt
test -f k8s/workloads/litellm/files/lab-med-frontier-fallback.txt
grep -qE 'kind:\s*Deployment' "$LITELLM_DEP"
grep -q 'resources:' "$LITELLM_DEP"
grep -q 'priorityClassName: lab-management' "$LITELLM_DEP"
if grep -q 'nvidia.com/gpu' "$LITELLM_DEP"; then
  echo "LiteLLM must not request a GPU" >&2
  exit 1
fi
if grep -q 'hostNetwork: true' "$LITELLM_DEP"; then
  echo "LiteLLM must bind to the LAN ClusterIP, not hostNetwork/QSFP" >&2
  exit 1
fi
grep -q 'configMapGenerator' "$LITELLM_KUST"
grep -q 'files:' "$LITELLM_KUST"
grep -q 'litellm_config.yaml' "$LITELLM_KUST"
if grep -E 'data:' "$LITELLM_KUST" | grep -q '|'; then
  echo "LiteLLM ConfigMap must not inline blobs" >&2
  exit 1
fi
grep -qi 'not a medical device' k8s/workloads/litellm/files/lab-med-system.txt
grep -qi 'MedGemma is offline' k8s/workloads/litellm/files/lab-med-frontier-fallback.txt
grep -q 'lab-fast' k8s/workloads/litellm/files/litellm_config.yaml
grep -q 'lab-med' k8s/workloads/litellm/files/litellm_config.yaml
grep -q 'lab-frontier' k8s/workloads/litellm/files/litellm_config.yaml
grep -q 'lab-frontier-ds' k8s/workloads/litellm/files/litellm_config.yaml

echo "Checking per-backend LiteLLM profiles and overlays..."
python3 - <<'PY'
from pathlib import Path
import sys

profiles = {
    'k8s/workloads/litellm/files/profiles/qwen3.8-27b.yaml': 'qwen3.8-27b-nvfp4.ai-inference.svc.cluster.local',
    'k8s/workloads/litellm/files/profiles/qwen3.8-flash-next.yaml': 'qwen3.8-flash-next-nvfp4.ai-inference.svc.cluster.local',
    'k8s/workloads/litellm/files/profiles/glm-5.3-flash.yaml': 'glm-5.3-flash.ai-inference.svc.cluster.local',
    'k8s/workloads/litellm/files/profiles/deepseek-v4.1-flash.yaml': 'deepseek-v4.1-flash.ai-inference.svc.cluster.local',
}
overlays = [
    'k8s/overlays/litellm-qwen38-27b/kustomization.yaml',
    'k8s/overlays/litellm-qwen38-flash-next/kustomization.yaml',
    'k8s/overlays/litellm-glm53-flash/kustomization.yaml',
    'k8s/overlays/litellm-dsv41-flash/kustomization.yaml',
]
for path, svc in profiles.items():
    p = Path(path)
    if not p.is_file():
        print(f'missing LiteLLM profile: {path}', file=sys.stderr)
        sys.exit(1)
    text = p.read_text()
    if 'lab-auto' not in text:
        print(f'{path} must define lab-auto', file=sys.stderr)
        sys.exit(1)
    if svc not in text:
        print(f'{path} must point lab-auto at {svc}', file=sys.stderr)
        sys.exit(1)
    if 'api.deepseek.com' in text.lower() or 'deepseek-flash' in text and 'lab-med' in text:
        print(f'{path} must not route lab-med to the DeepSeek cloud API', file=sys.stderr)
        sys.exit(1)
for ov in overlays:
    p = Path(ov)
    if not p.is_file():
        print(f'missing LiteLLM overlay: {ov}', file=sys.stderr)
        sys.exit(1)
    text = p.read_text()
    if 'configMapGenerator' not in text or 'files:' not in text:
        print(f'{ov} must use configMapGenerator files:', file=sys.stderr)
        sys.exit(1)
    if 'behavior: replace' not in text:
        print(f'{ov} must replace litellm-config', file=sys.stderr)
        sys.exit(1)
    if '|' in text.split('configMapGenerator', 1)[-1] and 'data:' in text:
        print(f'{ov} must not inline ConfigMap blobs', file=sys.stderr)
        sys.exit(1)
job = Path('k8s/workloads/qwen3.8-27b-nvfp4/qwen3.8-27b-nvfp4-job.yaml')
if not job.is_file():
    print('missing qwen3.8-27b-nvfp4 Job', file=sys.stderr)
    sys.exit(1)
jtxt = job.read_text()
if 'restartPolicy: OnFailure' not in jtxt or 'backoffLimit:' not in jtxt:
    print('qwen3.8-27b-nvfp4 must be fail-stop', file=sys.stderr)
    sys.exit(1)
if 'gpu-memory-utilization 0.72' not in jtxt:
    print('qwen3.8-27b-nvfp4 exclusive util must be 0.72', file=sys.stderr)
    sys.exit(1)
if '0.88' in jtxt or '0.90' in jtxt:
    print('qwen3.8-27b-nvfp4 must not ship vLLM util 0.88/0.90', file=sys.stderr)
    sys.exit(1)
values = Path('ansible/files/open-webui-values.yaml').read_text()
if 'DEFAULT_MODELS' not in values or 'lab-auto' not in values:
    print('Open WebUI DEFAULT_MODELS must be lab-auto', file=sys.stderr)
    sys.exit(1)
if 'hermes-gateway' in values and 'value: "hermes-gateway"' in values:
    print('Open WebUI default model must not stay hermes-gateway', file=sys.stderr)
    sys.exit(1)
PY

echo "Checking highspeed identifier is not dual-400g..."
python3 -c "
from pathlib import Path
roots = [Path('k8s'), Path('ansible/roles/labels'), Path('ansible/inventory/hosts.ini.example')]
offenders = []
for root in roots:
    paths = [root] if root.is_file() else list(root.rglob('*'))
    for path in paths:
        if not path.is_file():
            continue
        text = path.read_text(encoding='utf-8', errors='replace')
        if 'dual-400g' in text or 'dual 400G' in text:
            offenders.append(str(path))
if offenders:
    print('dual-400g leftover in: ' + ', '.join(offenders), file=__import__('sys').stderr)
    raise SystemExit(1)
"

echo "Checking highspeed affinity uses Exists (not a speed-specific value)..."
python3 -c "
from pathlib import Path
import re
pat = re.compile(
    r'key:\\s*nvidia-dgx-spark/highspeed\\s*\\n\\s*operator:\\s*(\\S+)',
    re.MULTILINE,
)
offenders = []
for path in Path('k8s').rglob('*.yaml'):
    text = path.read_text(encoding='utf-8')
    for op in pat.findall(text):
        if op != 'Exists':
            offenders.append(f'{path}:{op}')
if offenders:
    print('highspeed affinity must use Exists: ' + ', '.join(offenders), file=__import__('sys').stderr)
    raise SystemExit(1)
"
grep -q 'nvidia-dgx-spark/highspeed=true' ansible/roles/labels/tasks/main.yml
grep -q 'groups\['\''k3s_cluster'\''\]' ansible/roles/labels/tasks/main.yml

echo "Checking Qwen 397B NVFP4 Jobs use switch NCCL (not 2-node pair vars)..."
QWEN397_JOBS="
k8s/workloads/qwen3.5-397b-nvfp4/qwen3.5-397b-nvfp4-job.yaml
k8s/workloads/qwen3.5-397b-nvfp4/qwen3.5-397b-nvfp4-worker-1-job.yaml
k8s/workloads/qwen3.5-397b-nvfp4/qwen3.5-397b-nvfp4-worker-2-job.yaml
k8s/workloads/qwen3.5-397b-nvfp4/qwen3.5-397b-nvfp4-worker-3-job.yaml
"
for job in $QWEN397_JOBS; do
  test -f "$job"
  grep -q 'hostNetwork: true' "$job"
  grep -q 'NCCL_SOCKET_IFNAME' "$job"
  grep -q 'enP7s7' "$job"
  grep -q 'value: "mlx5_0"' "$job"
  if grep -q 'enp1s0f0np0,enp1s0f1np1' "$job"; then
    echo "397B NVFP4 must not copy 2-node pair NCCL_SOCKET_IFNAME: $job" >&2
    exit 1
  fi
  if grep -q 'mlx5_0,mlx5_1' "$job"; then
    echo "397B NVFP4 must not copy 2-node pair NCCL_IB_HCA: $job" >&2
    exit 1
  fi
done

echo "Checking Grafana high-speed panel title is not 400G..."
grep -q 'High-Speed Network (QSFP)' config/grafana/dashboards/07-storage-network.json
if grep -q 'High-Speed Network (400G)' config/grafana/dashboards/07-storage-network.json; then
  echo "Grafana high-speed panel must not be titled 400G" >&2
  exit 1
fi

echo "Checking generated inventory loads fabric group vars..."
grep -q "groups\['k3s_server'\]\[0\]" ansible/playbooks/bootstrap-cluster.yml

echo "Checking highspeed_network fails closed without generated netplan on 3+ nodes..."
grep -q 'pair fallback is 2-node only' ansible/roles/highspeed_network/tasks/main.yml

echo "Checking rounded-stack overlays pin Mode A Jobs..."
test -f k8s/overlays/rounded-stack/kustomization.yaml
test -f k8s/overlays/rounded-stack-quality/kustomization.yaml
grep -q 'kubernetes.io/hostname' k8s/overlays/rounded-stack/patches/pin-spark0.yaml
grep -q 'spark0' k8s/overlays/rounded-stack/patches/pin-spark0.yaml
grep -q 'spark2' k8s/overlays/rounded-stack-quality/patches/pin-spark2.yaml

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

echo "Checking disk-wizard safety..."
WIZARD="scripts/utilities/disk-wizard.sh"
test -f "$WIZARD"
test -f config/disk-catalog.yaml
test -f scripts/lib/disk_scan.sh
test -f scripts/lib/py/disk_catalog.py
grep -q 'Never runs docker system prune -a --volumes' "$WIZARD"
if grep -nE 'docker[[:space:]]+system[[:space:]]+prune[[:space:]]+-a[[:space:]]+--volumes' \
  "$WIZARD" scripts/lib/disk_scan.sh scripts/lib/py/disk_catalog.py |
  grep -vE 'Never|never|# |echo |log |err '; then
  echo "disk-wizard must not invoke docker system prune -a --volumes"
  exit 1
fi
grep -q -- '--apply requires --yes' "$WIZARD"
grep -q 'run never deletes' "$WIZARD"
! grep -q 'rm -rf /' "$WIZARD"
grep -q 'keep-set-weight:' config/disk-catalog.yaml
grep -q 'dsv41-engram:' config/disk-catalog.yaml
python3 -c '
from pathlib import Path
text = Path("config/disk-catalog.yaml").read_text()
assert "risk: dangerous" in text
assert "reclaim: none" in text
assert "docker system prune -a --volumes" in text
'

echo "Checking lab identities safety..."
test -f config/lab-identities.yaml
test -f scripts/utilities/identities.sh
test -f scripts/lib/py/lab_identities.py
test -f ansible/playbooks/configure-identities.yml
grep -q 'apply requires --yes' scripts/utilities/identities.sh
grep -q 'run never mutates' scripts/utilities/identities.sh
grep -q 'Never prints private keys' scripts/utilities/identities.sh
grep -q 'ansible_user: lab-ansible' config/lab-identities.yaml
grep -q 'bootstrap_user_default: ubuntu' config/lab-identities.yaml
if grep -nE 'userdel|user:[[:space:]]*state:[[:space:]]*absent' \
  scripts/utilities/identities.sh ansible/roles/lab_identities/tasks/main.yml \
  ansible/playbooks/configure-identities.yml |
  grep -vE 'Never|never|# |echo |log |err '; then
  echo "identities must never delete users"
  exit 1
fi
if grep -nE 'docker[[:space:]]+system[[:space:]]+prune[[:space:]]+-a[[:space:]]+--volumes' \
  scripts/utilities/identities.sh ansible/roles/lab_identities/tasks/main.yml |
  grep -vE 'Never|never|# |echo |log |err '; then
  echo "identities must not invoke docker system prune -a --volumes"
  exit 1
fi
python3 -c '
from pathlib import Path
text = Path("config/lab-identities.yaml").read_text()
assert "lab-ansible:" in text
assert "lab-admin:" in text
assert "lab-svc:" in text
assert "BEGIN OPENSSH" not in text
assert "ssh-ed25519 AAAA" not in text
'
for ident_file in \
  config/lab-identities.yaml \
  ansible/cloud-init/example-user-data-1node.yaml \
  ansible/cloud-init/example-user-data-2node.yaml \
  ansible/files/generated/cloud-init/user-data-spark0.yaml; do
  test -f "${ident_file}"
  if grep -q "ssh-ed25519 AAAA" "${ident_file}"; then
    echo "${ident_file} must not embed authorized keys"
    exit 1
  fi
  if grep -qE '^[[:space:]]*- name: ubuntu[[:space:]]*$' "${ident_file}"; then
    echo "${ident_file} must not create the factory ubuntu user"
    exit 1
  fi
done
for ident_file in \
  ansible/cloud-init/example-user-data-1node.yaml \
  ansible/cloud-init/example-user-data-2node.yaml \
  ansible/files/generated/cloud-init/user-data-spark0.yaml; do
  if ! grep -qE '^[[:space:]]*- default$' "${ident_file}"; then
    echo "${ident_file} must keep the distro default user for first-contact SSH"
    exit 1
  fi
done

echo "All critical safety checks passed"
