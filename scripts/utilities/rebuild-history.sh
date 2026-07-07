#!/usr/bin/env bash
#
# ## rebuild-history — rebuild local main into a logical commit sequence
#
# Creates an orphan branch with 14 commits from a validated WIP snapshot.
# Local only — never pushes to a remote. Does not create archive tags or wip branches.
#
# Usage:
#   REBUILD_WIP_REF=main ./scripts/utilities/rebuild-history.sh
#
# @command rebuild-history
# @description Rebuild local git history into a logical commit sequence from the current tree.

set -euo pipefail

# shellcheck source=../lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/../lib/paths.sh"
# shellcheck source=../lib/rebuild-cleanup.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/../lib/rebuild-cleanup.sh"
ROOT="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(lab_script_dir 1 utilities)/../.." && pwd)}"

# @function rebuild_history_main
# Rebuild local main into the 14-commit logical sequence from the WIP snapshot.
rebuild_history_main() {
cd "$ROOT"

WIP_REF="${REBUILD_WIP_REF:-HEAD}"

if [[ -z "${REBUILD_WIP_REF:-}" ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "rebuild-history: staging all changes..."
    git add -A
  fi

  if ! git rev-parse --verify HEAD >/dev/null 2>&1 || [[ -n "$(git status --porcelain)" ]]; then
    git commit -m "wip: validated integration snapshot" || true
  fi
  WIP_REF="HEAD"
fi

WIP="$(git rev-parse "$WIP_REF")"
echo "rebuild-history: WIP snapshot $WIP"

CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || true)"
if [[ "$CURRENT_BRANCH" == "rebuilt-main" ]]; then
  git checkout -f -B rebuild-temp "$WIP"
  CURRENT_BRANCH="rebuild-temp"
fi
git clean -fdx >/dev/null 2>&1 || true
git branch -D rebuilt-main 2>/dev/null || true
git checkout --orphan rebuilt-main
git rm -rf . >/dev/null 2>&1 || true

# @function strip_paths
# Remove paths from the index and working tree after a broad checkout.
# @param $@  Paths to remove
strip_paths() {
  local path
  for path in "$@"; do
    git rm -rf --cached "$path" 2>/dev/null || true
    rm -rf "$path" 2>/dev/null || true
  done
}

# @function commit_with_body
# Create a commit with a conventional title and PR-style bullet body.
# @param $1  Commit title (first line)
# @param $@  Body bullet lines (each becomes a "- …" line)
commit_with_body() {
  local title="$1"
  shift
  if git diff --cached --quiet; then
    echo "rebuild-history: skip empty commit: $title"
    return 0
  fi
  {
    printf '%s\n\n' "$title"
    local bullet
    for bullet in "$@"; do
      printf -- '- %s\n' "$bullet"
    done
  } | git commit -F -
  echo "rebuild-history: $(git log -1 --oneline)"
}

# @function commit_group
# Create one logical commit from a path group on the rebuilt-main orphan branch.
# @param $1  Commit title
# @param $2+ Body bullet lines, then "--", then paths to include
commit_group() {
  local title="$1"
  shift
  local -a bullets=()
  while [[ $# -gt 0 && "$1" != "--" ]]; do
    bullets+=("$1")
    shift
  done
  shift || true
  [[ $# -gt 0 ]] || return 0
  git checkout "$WIP" -- "$@" 2>/dev/null || true
  git add -A -- "$@" 2>/dev/null || true
  commit_with_body "$title" "${bullets[@]}"
}

commit_group "chore: initialize repository hygiene and licensing" \
  "Add licensing, contributor docs, and shared editor hygiene" \
  "Commit partial .vscode/ allowlist in .gitignore for team workspace settings" \
  "Establish AGENTS.md workflow guidance for AI-assisted development" \
  -- \
  LICENSE .gitignore .pre-commit-config.yaml .dockerignore .bazelignore .bazelversion \
  CONTRIBUTING.md README.md AGENTS.md SECURITY.md .vscode

commit_group "build: add Bazel workspace, lint, and format tooling" \
  "Wire Bazel module, root BUILD targets, and Makefile entry points" \
  "Add lint/format runners for shell, YAML, Python, and Starlark" \
  -- \
  MODULE.bazel MODULE.bazel.lock BUILD.bazel .bazelrc Makefile fix.sh lints config/BUILD.bazel \
  .ansible-lint .yamllint.yml .prettierignore prettier.config.mjs .gitattributes ruff.toml mypy.ini

# Infra base — exclude platform, domains-generated, observability, stacks, models, dashboard helm.
git checkout "$WIP" -- ansible helm \
  config/resource-policy.yaml config/resource-policy.json config/nemotron-catalog.yaml 2>/dev/null || true
git checkout "$WIP" -- k8s 2>/dev/null || true
strip_paths \
  k8s/auth \
  k8s/cert-manager \
  k8s/traefik \
  k8s/base/namespaces-sso.yaml \
  k8s/monitoring \
  k8s/dev/open-webui \
  k8s/dev/templates \
  k8s/dev/images \
  k8s/workloads/qwen3.5-122b-a10b-nvfp4 \
  k8s/workloads/qwen3.5-397b-nvfp4 \
  k8s/workloads/qwen3.5-397b-spark2 \
  ansible/files/authelia-values.yaml \
  ansible/files/traefik-values.yaml \
  ansible/files/prometheus-values.yaml \
  ansible/files/grafana-values.yaml \
  ansible/files/blackbox-exporter-values.yaml \
  ansible/files/kube-state-metrics-values.yaml \
  ansible/files/node-exporter-values.yaml \
  ansible/files/generated \
  ansible/playbooks/install-sso.yml \
  ansible/roles/sso \
  ansible/roles/traefik \
  ansible/roles/monitoring \
  helm/lab-dashboard
git add -A ansible k8s helm config/resource-policy.yaml config/resource-policy.json config/nemotron-catalog.yaml 2>/dev/null || true
commit_with_body "feat(infra): add Ansible, Kubernetes workloads, Helm, and resource policy" \
  "Lay down core cluster workloads, overlays, and resource guard policies" \
  "Add Ansible playbooks/roles for base provisioning (excluding platform and monitoring slices)" \
  "Include Helm chart scaffolding and nemotron catalog configuration"

# Scripts — exclude validate.sh (CI) and domain render helpers (domains commit).
git checkout "$WIP" -- scripts 2>/dev/null || true
strip_paths \
  scripts/validate.sh \
  scripts/lib/domains.sh \
  scripts/lib/render_domains.py \
  scripts/utilities/render-domains.sh
git add -A scripts 2>/dev/null || true
commit_with_body "feat(scripts): add cluster management tooling" \
  "Add manage.sh orchestrator and stack-specific utility scripts" \
  "Include shell libraries for monitoring, SSO, Hermes, and inference workloads" \
  "Ship rebuild-history helper for reproducible local history reconstruction"

# Tests framework — exclude domains.bats and doc coverage gate (later commits).
git checkout "$WIP" -- tests 2>/dev/null || true
strip_paths \
  tests/bats/domains.bats \
  tests/doc_coverage.py \
  tests/doc_coverage.sh
git add -A tests 2>/dev/null || true
commit_with_body "feat(tests): add safety invariants and BATS suite" \
  "Add safety invariant greps for NCCL, restart policy, and resource limits" \
  "Ship BATS coverage for manage.sh, utilities, and manifest/kustomize builds" \
  "Establish manifest coverage tooling and parallel test shard wiring"

commit_group "feat(platform): add SSO, Traefik, cert-manager, and auth manifests" \
  "Deploy Authelia, OAuth2 proxy, and Traefik middleware manifests" \
  "Add cert-manager issuers and wildcard certificate templates" \
  "Include Ansible SSO/Traefik roles and sso-policy configuration" \
  -- \
  k8s/auth k8s/cert-manager k8s/traefik k8s/base/namespaces-sso.yaml config/sso-policy.yaml \
  ansible/files/authelia-values.yaml ansible/files/traefik-values.yaml ansible/playbooks/install-sso.yml \
  ansible/roles/sso ansible/roles/traefik

commit_group "feat(domains): centralize lab hostname configuration and render pipeline" \
  "Centralize lab hostnames in lab-domains.yaml/json" \
  "Add render_domains.py pipeline and shell helpers" \
  "Commit generated auth/cert-manager/ansible route artifacts and domains.bats" \
  -- \
  config/lab-domains.yaml config/lab-domains.json \
  scripts/lib/domains.sh scripts/lib/render_domains.py scripts/utilities/render-domains.sh \
  k8s/auth/generated k8s/cert-manager/generated ansible/files/generated \
  tests/bats/domains.bats

commit_group "feat(observability): add monitoring stack and Grafana dashboards" \
  "Add Prometheus/Grafana Kubernetes monitoring manifests" \
  "Ship generated Grafana dashboards and blackbox probe configuration" \
  "Include Ansible monitoring role and Helm values for exporters" \
  -- \
  k8s/monitoring config/grafana config/monitoring-probes.yaml \
  ansible/files/prometheus-values.yaml ansible/files/grafana-values.yaml \
  ansible/files/blackbox-exporter-values.yaml ansible/files/kube-state-metrics-values.yaml \
  ansible/files/node-exporter-values.yaml ansible/roles/monitoring

commit_group "feat(stacks): add Open WebUI, MCP toolkit, and Hermes agent" \
  "Add Hermes agent stack and MCP toolkit workloads" \
  "Deploy Open WebUI dev workspace manifests and container images" \
  "Include open-webui policy configuration for stack governance" \
  -- \
  mcp hermes k8s/dev/open-webui config/open-webui-policy.yaml config/open-webui-policy.json \
  k8s/dev/templates k8s/dev/images

commit_group "feat(models): add Qwen workloads and model download utilities" \
  "Add Qwen3.5 inference workload manifests for single- and multi-node layouts" \
  "Include NVFP4 and spark2 deployment variants with service endpoints" \
  -- \
  k8s/workloads/qwen3.5-122b-a10b-nvfp4 k8s/workloads/qwen3.5-397b-nvfp4 k8s/workloads/qwen3.5-397b-spark2

commit_group "docs: add MkDocs site, conventions, and generated references" \
  "Publish MkDocs site structure and project conventions" \
  "Add generated shell/dashboard API references and troubleshooting guides" \
  "Include visual render tests for documentation pages" \
  -- \
  docs mkdocs.yml

# Dashboard — exclude PNG goldens and visual-regression specs (test commit).
git checkout "$WIP" -- dashboard helm/lab-dashboard 2>/dev/null || true
strip_paths \
  dashboard/tests/visual/goldens/*.png \
  dashboard/tests/visual/dashboard-main.spec.ts \
  dashboard/tests/visual/dashboard-panels.spec.ts \
  dashboard/tests/visual/dashboard-interactions.spec.ts \
  dashboard/tests/visual/login.spec.ts \
  dashboard/tests/visual/visual-helpers.ts \
  dashboard/tests/visual/expected-goldens.ts \
  dashboard/tests/visual/golden-inventory.test.ts
if [[ -d dashboard/tests/visual/goldens ]]; then
  find dashboard/tests/visual/goldens -maxdepth 1 -name '*.png' -delete 2>/dev/null || true
fi
git add -A dashboard helm/lab-dashboard 2>/dev/null || true
commit_with_body "feat(dashboard): add lab portal with observability and stack panels" \
  "Add Next.js lab portal with stack, observability, and utility panels" \
  "Include Drizzle schema, server actions, and Helm chart for deployment" \
  "Ship dashboard test harness without committed visual goldens"

commit_group "test: add visual regression goldens, doc coverage gate, and parallel test shards" \
  "Add Playwright visual regression specs and committed PNG goldens" \
  "Enable doc coverage gate for shell script header requirements" \
  "Include MkDocs visual goldens alongside dashboard UI snapshots" \
  -- \
  dashboard/tests/visual/goldens docs/tests/visual/goldens \
  dashboard/tests/visual/dashboard-main.spec.ts \
  dashboard/tests/visual/dashboard-panels.spec.ts \
  dashboard/tests/visual/dashboard-interactions.spec.ts \
  dashboard/tests/visual/login.spec.ts \
  dashboard/tests/visual/visual-helpers.ts \
  dashboard/tests/visual/expected-goldens.ts \
  dashboard/tests/visual/golden-inventory.test.ts \
  dashboard/tests/visual/goldens/README.md \
  tests/doc_coverage.py tests/doc_coverage.sh

commit_group "ci: add workflows, validate orchestrator, and devcontainer" \
  "Add GitHub and Gitea CI workflows with Bazel setup action" \
  "Ship validate.sh orchestrator for local and CI validation" \
  "Include devcontainer for reproducible contributor environments" \
  -- \
  .github .gitea .devcontainer scripts/validate.sh

REMAINING=()
while IFS= read -r _path; do
  REMAINING+=("$_path")
done < <(comm -23 \
  <(git ls-tree -r --name-only "$WIP" | sort) \
  <(git ls-tree -r --name-only HEAD | sort))
if [[ ${#REMAINING[@]} -gt 0 ]]; then
  git checkout "$WIP" -- "${REMAINING[@]}" 2>/dev/null || true
  git add -A -- "${REMAINING[@]}" 2>/dev/null || true
  commit_with_body "chore: add remaining integration artifacts" \
    "Sweep any paths not covered by the 14-commit grouping"
fi

if git show-ref --verify --quiet refs/heads/main && git worktree list | grep -q '\[main\]'; then
  git branch -M rebuilt-main
  echo "rebuild-history: complete on rebuilt-main (main is checked out in another worktree)"
else
  git branch -D main 2>/dev/null || true
  git branch -M main
  echo "rebuild-history: complete on main"
fi
cleanup_rebuild_refs
git log --oneline
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  rebuild_history_main
fi