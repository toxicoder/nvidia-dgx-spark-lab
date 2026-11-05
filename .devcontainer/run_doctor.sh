#!/usr/bin/env bash
# ## Run the contributor-environment doctor through Bazel.
#
# Owns the doctor behind a Bazel target so contributors have one documented
# way to check their toolchain. The doctor inspects the real checkout
# (dashboard/node_modules, docs venv, docs-site/node_modules), so under
# `bazel run` it has to be re-rooted out of the runfiles tree.
#
# The devcontainer's postStartCommand keeps calling .devcontainer/doctor.sh
# directly: that step is the bootstrap which proves bazelisk itself is
# installed, so it cannot depend on bazelisk working first.
#
# Usage: bazelisk run //:doctor [-- --quiet]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n ${BUILD_WORKSPACE_DIRECTORY:-} ]]; then
  ROOT="${BUILD_WORKSPACE_DIRECTORY}"
elif [[ -n ${TEST_SRCDIR:-} ]]; then
  ROOT="${TEST_SRCDIR}/_main"
else
  ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
fi

DOCTOR="${ROOT}/.devcontainer/doctor.sh"
if [[ ! -f ${DOCTOR} ]]; then
  echo "doctor: missing ${DOCTOR}" >&2
  exit 1
fi

exec bash "${DOCTOR}" "$@"
