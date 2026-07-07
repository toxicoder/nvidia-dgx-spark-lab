#!/usr/bin/env bash
set -e

echo "=== Post-create setup for nvidia-dgx-spark-lab dev container ==="

# Ensure user tools are up to date
pip install --user --upgrade pip setuptools wheel 2>/dev/null || true

# Docs tooling (MkDocs, Playwright for visual goldens, etc.)
pip install --user -r docs/requirements.txt

# Playwright browser for docs visual regression tests
python -m playwright install chromium

# Dashboard dependencies
( cd dashboard && npm ci )

# Verify key tools
echo "Verifying tools..."
command -v bazelisk && bazelisk version || echo "bazelisk not in PATH"
command -v buildifier && buildifier --version || echo "buildifier not in PATH"
command -v shfmt && shfmt --version || echo "shfmt not in PATH"
command -v ruff && ruff --version || echo "ruff not in PATH"
command -v ansible && ansible --version | head -1 || echo "ansible not in PATH"
command -v kubectl && kubectl version --client || echo "kubectl not in PATH"
command -v helm && helm version || echo "helm not in PATH"
command -v kubeconform && kubeconform -v || echo "kubeconform not in PATH"
command -v shellcheck && shellcheck --version | head -1 || echo "shellcheck not in PATH"
command -v bats && bats --version || echo "bats not in PATH"

# Dashboard / Node (devcontainer feature)
command -v node && node --version || echo "node not in PATH"
command -v npm && npm --version || echo "npm not in PATH"

echo ""
echo "Running smoke test: bazelisk test //:test --config=ci"
if ! bazelisk test //:test --config=ci; then
  echo ""
  echo "=== Smoke test failed ==="
  echo "The dev container is usable, but //:test did not pass yet."
  echo "Common fixes:"
  echo "  bazelisk test //:test --config=ci --test_output=errors"
  echo "  bazelisk run //:fix"
  echo "  bazelisk build //... --nobuild"
  echo "See docs/BUILDING_WITH_BAZEL.md and AGENTS.md for the full workflow."
  exit 1
fi

echo ""
echo "=== Dev environment ready ==="
echo "Recommended commands:"
echo "  bazelisk test //:test"
echo "  bazelisk test //:lint"
echo "  bazelisk build //..."
echo "  cd dashboard && npm run test:coverage"
echo "  bazel run //docs:serve"
echo ""
echo "See docs/BUILDING_WITH_BAZEL.md for details."