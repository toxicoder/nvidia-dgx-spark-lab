#!/usr/bin/env bash
#
# ## render-domains — regenerate domain-dependent manifests
#
# Reads config/lab-domains.yaml and config/sso-policy.yaml, then writes generated
# Kubernetes, Ansible, and Grafana artifacts.
#
# Usage:
#   ./scripts/utilities/render-domains.sh
#
# @command render-domains
# @description Regenerate SSO routes, TLS certs, Helm values, and Grafana links from lab-domains config.

set -euo pipefail

# shellcheck source=../lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/../lib/paths.sh"
ROOT="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(lab_script_dir 1 utilities)/../.." && pwd)}"
export REPO_ROOT="$ROOT"

exec python3 "${ROOT}/scripts/lib/render_domains.py"