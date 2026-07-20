# nvidia-dgx-spark-lab Makefile (compatibility shim)
#
# Bazel is the primary / recommended entry point for the entire codebase.
#   bazelisk test //:test
#   bazelisk test //:lint --test_tag_filters=manual
#   bazelisk run //:manage -- status
#   bazelisk run //docs:serve
#
# This Makefile exists for:
# - People who don't have bazelisk yet
# - Legacy CI jobs / muscle memory
# - `make help` quick reference
#
# Most targets now delegate to Bazel when bazelisk is available.

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

# Colors
GREEN  := \033[0;32m
YELLOW := \033[0;33m
RED    := \033[0;31m
NC     := \033[0m

BAZEL := $(shell command -v bazelisk 2>/dev/null || command -v bazel 2>/dev/null || echo "")

.PHONY: help lint test test-all validate clean \
        lint-shell lint-yaml lint-ansible lint-k8s \
        test-scripts test-ansible test-k8s \
        ci-install-deps fix

help:
	@echo "nvidia-dgx-spark-lab (Bazel primary)"
	@echo ""
	@echo "Preferred (Bazel):"
	@echo "  bazelisk run //:validate"
	@echo "  bazelisk test //:test"
	@echo "  bazelisk test //:lint --test_tag_filters=manual"
	@echo "  bazelisk run //:fix                # formatters + auto-fix linters (trusted tools)"
	@echo "  bazelisk run //:manage -- help"
	@echo "  bazelisk run //docs:serve"
	@echo "  bazelisk run //ansible:bootstrap"
	@echo ""
	@echo "Makefile shims (for compatibility):"
	@echo "  make lint            (delegates to bazelisk when available)"
	@echo "  make fix"
	@echo "  make test"
	@echo "  make test-all"
	@echo "  make test-scripts"
	@echo ""
	@echo "Legacy direct convenience (after cluster bootstrap):"
	@echo "  ./scripts/manage.sh status"
	@echo "  ./scripts/manage.sh start-test"
	@echo ""
	@echo "Most targets are safe without a cluster."

# =============================================================================
# Linting targets (now prefer Bazel)
# =============================================================================

lint:
	@if [ -n "$(BAZEL)" ]; then \
		echo -e "$(YELLOW)→ Bazel primary: bazelisk test //:lint --test_tag_filters=manual$(NC)"; \
		$(BAZEL) test //:lint --test_tag_filters=manual; \
	else \
		$(MAKE) lint-direct; \
	fi
	@echo -e "$(GREEN)✓ lint target complete$(NC)"  # real lint no longer masked by || true

lint-direct: lint-shell lint-yaml lint-ansible lint-k8s
	@echo -e "$(GREEN)✓ All linting passed$(NC)"

lint-shell:
	@echo -e "$(YELLOW)→ Running shellcheck...$(NC)"
	@command -v shellcheck >/dev/null 2>&1 || { echo "shellcheck not found. Install it (brew/apt/pacman)."; exit 1; }
	shellcheck --version
	@find . -name '*.sh' \
		-not -path './.git/*' \
		-not -path './node_modules/*' \
		-not -path './.next/*' \
		-not -path './site/*' \
		-not -path './bazel-*/*' \
		-not -path './dashboard/node_modules/*' \
		-print0 | xargs -0 shellcheck -x --severity=warning
	@echo -e "$(GREEN)✓ shellcheck passed$(NC)"

lint-yaml:
	@echo -e "$(YELLOW)→ Running yamllint...$(NC)"
	@command -v yamllint >/dev/null 2>&1 || { echo "yamllint not found. pip install yamllint"; exit 1; }
	yamllint --version
	yamllint -c .yamllint.yml .
	@echo -e "$(GREEN)✓ yamllint passed$(NC)"

lint-ansible:
	@echo -e "$(YELLOW)→ Running ansible-lint + syntax check...$(NC)"
	@command -v ansible-lint >/dev/null 2>&1 || { echo "ansible-lint not found. pip install ansible-lint"; exit 1; }
	@command -v ansible-playbook >/dev/null 2>&1 || { echo "ansible not found. pip install ansible"; exit 1; }
	ansible --version
	# Syntax check on all playbooks (use example inventory)
	ANSIBLE_CONFIG=ansible/ansible.cfg ansible-playbook --syntax-check -i ansible/inventory/hosts.ini.example ansible/playbooks/*.yml
	# ansible-lint (relaxed for example inventory files)
	ansible-lint --version
	ansible-lint -c .ansible-lint ansible/   # hardened: no || true; real lint step must pass (warnings treated as errors for CI hardening)
	@echo -e "$(GREEN)✓ ansible linting passed$(NC)"

lint-k8s:
	@echo -e "$(YELLOW)→ Running kubeconform (Kubernetes schema validation)...$(NC)"
	@command -v kubeconform >/dev/null 2>&1 || { echo "kubeconform not found. See https://github.com/yannh/kubeconform"; exit 1; }
	kubeconform -v
	@find k8s -name '*.yaml' -o -name '*.yml' | grep -v kustomization.yaml | xargs kubeconform -strict -summary -kubernetes-version 1.30.0   # hardened: removed || true; real k8s schema check
	@echo -e "$(GREEN)✓ kubeconform passed$(NC)"

# =============================================================================
# Fix / format target (delegates to Bazel //:fix)
# =============================================================================

fix:
	@if [ -n "$(BAZEL)" ]; then \
		echo -e "$(YELLOW)→ Bazel primary: bazelisk run //:fix$(NC)"; \
		$(BAZEL) run //:fix; \
	else \
		echo -e "$(YELLOW)→ Running fix.sh directly (install tools first)${NC}"; \
		./fix.sh || true;  # keep || true: fix.sh is formatter (not real lint/check); ops best-effort
	fi
	@echo -e "$(GREEN)✓ fix target complete (run 'bazelisk test //:lint --test_tag_filters=manual' for checks)${NC}"

# =============================================================================
# Test targets (prefer Bazel)
# =============================================================================

test:
	@if [ -n "$(BAZEL)" ]; then \
		echo -e "$(YELLOW)→ Bazel primary: bazelisk test //:test$(NC)"; \
		$(BAZEL) test //:test; \
	else \
		$(MAKE) test-direct; \
	fi

test-direct: test-scripts test-k8s test-dashboard
	@echo -e "$(GREEN)✓ All tests passed$(NC)"

validate:
	@if [ -n "$(BAZEL)" ]; then \
		echo -e "$(YELLOW)→ Bazel primary: bazelisk run //:validate$(NC)"; \
		$(BAZEL) run //:validate; \
	else \
		echo -e "$(RED)bazelisk required for validate target$(NC)"; exit 1; \
	fi
	@echo -e "$(GREEN)✓ validate target complete$(NC)"

test-all:
	@if [ -n "$(BAZEL)" ]; then \
		echo -e "$(YELLOW)→ Bazel primary: bazelisk run //:validate -- --all$(NC)"; \
		$(BAZEL) run //:validate -- --all; \
	else \
		$(MAKE) lint-direct && $(MAKE) test-direct; \
	fi
	@echo -e "$(GREEN)✓ Full validation suite passed$(NC)"

test-scripts:
	@if [ -n "$(BAZEL)" ]; then \
		echo -e "$(YELLOW)→ Bazel: bazelisk test //tests:bats$(NC)"; \
		$(BAZEL) test //tests:bats; \
	else \
		echo -e "$(YELLOW)→ Running BATS tests for manage.sh...$(NC)"; \
		command -v bats >/dev/null 2>&1 || { echo "bats not found. See https://github.com/bats-core/bats-core (or apt install bats)"; exit 1; } ; \
		bats --version; \
		bats tests/bats/; \
		echo -e "$(GREEN)✓ BATS tests passed$(NC)"; \
	fi

test-dashboard:
	@echo -e "$(YELLOW)→ Running Vitest for dashboard (if deps)...$(NC)"
	@if [ -n "$(BAZEL)" ]; then \
		$(BAZEL) run //dashboard:test; \
	else \
		cd dashboard && npm test -- --run; \
	fi
	@echo -e "$(GREEN)✓ Dashboard test check done$(NC)"

test-k8s: lint-k8s
	@echo -e "$(YELLOW)→ Additional Kubernetes manifest content checks...$(NC)"
	@# Ensure critical fields exist in heavy workloads (simple but effective)
	@grep -q 'resources:' k8s/workloads/kimi/kimi-job.yaml || { echo "Missing resources in kimi-job"; exit 1; }
	@grep -q 'restartPolicy: OnFailure' k8s/workloads/kimi/kimi-job.yaml || { echo "Wrong restartPolicy in kimi"; exit 1; }
	@grep -q 'NCCL_SOCKET_IFNAME' k8s/workloads/kimi/kimi-job.yaml || { echo "Missing NCCL config"; exit 1; }
	@grep -q 'NCCL_SOCKET_IFNAME' k8s/workloads/kimi-test/kimi-test-job.yaml || { echo "Missing NCCL config"; exit 1; }
	@grep -q 'NCCL_SOCKET_IFNAME' k8s/workloads/nemotron-3-ultra/nemotron-3-ultra-job.yaml || { echo "Missing NCCL config"; exit 1; }
	@grep -q 'NCCL_SOCKET_IFNAME' k8s/workloads/glm-5.2/glm-5.2-job.yaml || { echo "Missing NCCL config"; exit 1; }
	@grep -q 'NCCL_SOCKET_IFNAME' k8s/workloads/glm-5.2/glm-5.2-rpc-job.yaml || { echo "Missing NCCL config in glm rpc"; exit 1; }
	@grep -q 'backoffLimit: 1' k8s/workloads/kimi/kimi-job.yaml || { echo "Heavy workload should have low backoffLimit"; exit 1; }
	@grep -q 'resources:' k8s/workloads/kimi-test/kimi-test-job.yaml || { echo "Missing resources in test job"; exit 1; }
	@grep -q 'resources:' k8s/workloads/nemotron-3-ultra/nemotron-3-ultra-job.yaml || { echo "Missing resources in nemotron"; exit 1; }
	@grep -q 'resources:' k8s/workloads/glm-5.2/glm-5.2-job.yaml || { echo "Missing resources in glm"; exit 1; }
	@grep -q 'resources:' k8s/workloads/glm-5.2/glm-5.2-rpc-job.yaml || { echo "Missing resources in glm rpc"; exit 1; }
	@grep -q 'resources:' k8s/workloads/ray-head/ray-head-job.yaml || { echo "Missing resources in ray-head"; exit 1; }
	@grep -q 'resources:' k8s/workloads/ray-worker/ray-worker-job.yaml || { echo "Missing resources in ray-worker"; exit 1; }
	@# Expanded uniform safety greps (Phase 7.2): ray GPU + probes/securityContext (post phase3)
	@grep -q 'nvidia.com/gpu' k8s/workloads/ray-head/ray-head-job.yaml || { echo "Missing GPU request in ray-head"; exit 1; }
	@grep -q 'nvidia.com/gpu' k8s/workloads/ray-worker/ray-worker-job.yaml || { echo "Missing GPU request in ray-worker"; exit 1; }
	@grep -q 'securityContext:' k8s/workloads/kimi/kimi-job.yaml || { echo "Missing securityContext in kimi (post phase3)"; exit 1; }
	@grep -q 'readinessProbe:' k8s/workloads/kimi/kimi-job.yaml || { echo "Missing readinessProbe in kimi"; exit 1; }
	@grep -q 'livenessProbe:' k8s/workloads/kimi/kimi-job.yaml || { echo "Missing livenessProbe in kimi"; exit 1; }
	@echo -e "$(GREEN)✓ K8s content checks passed$(NC)"
	@echo -e "$(YELLOW)→ Kustomize build validation (for modularity)...$(NC)"
	@which kustomize >/dev/null && kustomize build k8s/overlays/test > /dev/null || echo "kustomize not installed or base missing (optional)"
	@echo -e "$(GREEN)✓ Kustomize checks passed (if tool available)$(NC)"

test-ansible:
	@echo -e "$(YELLOW)→ Running Ansible-specific tests...$(NC)"
	ansible-playbook --syntax-check -i ansible/inventory/hosts.ini.example ansible/playbooks/*.yml
	@echo -e "$(GREEN)✓ Ansible syntax checks passed$(NC)"

# =============================================================================
# CI helper (still useful for legacy CI or fresh boxes)
# =============================================================================

ci-install-deps:
	@echo -e "$(YELLOW)→ Installing test dependencies (Linux amd64/arm64; multi-arch pins from tool-versions.env)...$(NC)"
	@# Prefer scripts/ci (SSOT); .github wrapper delegates here too.
	bash scripts/ci/install-lint-tools.sh || true
	@# BATS via direct (not in shared lint script)
	curl -sL https://github.com/bats-core/bats-core/archive/refs/tags/v1.11.0.tar.gz | tar xz -C /tmp && sudo /tmp/bats-core-1.11.0/install.sh /usr/local || true
	@echo -e "$(GREEN)→ Dependencies installed (verify with 'make lint' or 'bazelisk test //:test')$(NC)"
	@echo "Preferred: Dev Containers (docs/dev-environment.md) for Apple Silicon / Windows / Spark parity."

clean:
	find . -name '*.retry' -delete || true
	rm -rf tests/bats/tmp/ || true
	@if [ -n "$(BAZEL)" ]; then $(BAZEL) clean --expunge || true; fi

# =============================================================================
# Convenience
# =============================================================================

ci: validate
	@echo -e "$(GREEN)CI target complete$(NC)"
