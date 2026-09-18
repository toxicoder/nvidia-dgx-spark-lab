#!/usr/bin/env bash
#
# Capture the documentation-site screenshot baselines in the same Linux environment the docs
# CI job runs in.
#
# Why this exists: committed goldens are only useful when the machine that produced them and
# the machine that compares against them render text identically.  Font hinting, subpixel
# positioning and emoji fallback differ per platform, so a baseline captured on a laptop
# reports every page as changed on Linux.  This repo has already been burned by that, which is
# why refreshing baselines is a deliberate, scripted act rather than a laptop run of the suite.
#
# The container is pinned to the Playwright release the suite depends on, so the Chromium that
# draws a golden is the same build that later compares against it.  The static export is built
# inside the container too: the Next production bundle carries platform-specific native code,
# so the host's export directory must not be reused.
#
# Usage (from the repository root):
#   bash docs-site/scripts/visual_linux.sh              # compare against committed baselines
#   bash docs-site/scripts/visual_linux.sh --update     # rewrite baselines, then review diffs
#   bash docs-site/scripts/visual_linux.sh -- --project desktop
#
# Baselines land in docs-site/tests/visual/goldens/ in the checkout; review the image diff
# before committing them.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Under `bazelisk run` the script executes out of the runfiles tree; the container has to mount
# the real checkout so the captured baselines land where they can be committed.
if [[ -n ${BUILD_WORKSPACE_DIRECTORY:-} && -d "${BUILD_WORKSPACE_DIRECTORY}/docs-site" ]]; then
  REPO_ROOT="$BUILD_WORKSPACE_DIRECTORY"
fi

usage() {
  sed -n '3,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

UPDATE="false"
PLAYWRIGHT_ARGS=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --update) UPDATE="true" ;;
    --help | -h) usage 0 ;;
    --)
      shift
      break
      ;;
    *)
      echo "unknown option: $1 (see --help)" >&2
      exit 2
      ;;
  esac
  shift
done
if [[ $# -gt 0 ]]; then
  PLAYWRIGHT_ARGS="$*"
fi

command -v docker >/dev/null || {
  echo "docker is not on the PATH; start Docker Desktop first." >&2
  exit 1
}
docker info >/dev/null 2>&1 || {
  echo "the Docker daemon is not running." >&2
  exit 1
}

# The image reference is resolved by one script that both this launcher and the unit test
# consult, so the browser build cannot drift from the library that drives it.  Under
# `bazelisk run` the launcher executes out of the runfiles tree, where its sibling scripts are
# not laid out next to it, so the checkout that is about to be mounted is also where the helper
# is read from.
HELPER="${REPO_ROOT}/docs-site/scripts/visual_linux_image.py"
[[ -f $HELPER ]] || HELPER="${SCRIPT_DIR}/visual_linux_image.py"
[[ -f $HELPER ]] || {
  echo "cannot find visual_linux_image.py next to this script or in ${REPO_ROOT}" >&2
  exit 1
}

PLATFORM="$("$HELPER" --print-platform)"
EXPECTED_MACHINE="$("$HELPER" --print-uname-machine)"
REFERENCES=()
while IFS= read -r line; do
  [[ -n $line ]] && REFERENCES+=("$line")
done < <("$HELPER" --print-candidates)
[[ ${#REFERENCES[@]} -gt 0 && -n $PLATFORM && -n $EXPECTED_MACHINE ]] || {
  echo "could not resolve the Playwright container image" >&2
  exit 1
}

# Pick the first reference that starts a container reporting the CI architecture.  The
# digest-pinned candidate normally wins: a tag in a multi-architecture store can resolve to
# whichever variant happens to be resident, and its stored config can even disagree with what
# --platform asked for.  Asking the container what it actually is, rather than trusting the
# reference, is the only statement that survives that.  The worker container repeats the same
# assertion below, so a baselines run never depends on this probe having been representative.
IMAGE=""
for candidate in "${REFERENCES[@]}"; do
  [[ -n $candidate ]] || continue
  docker pull --platform "$PLATFORM" "$candidate" >/dev/null 2>&1 || true
  reported="$(docker run --rm --platform "$PLATFORM" "$candidate" uname -m 2>/dev/null | tail -1 || true)"
  if [[ $reported == "$EXPECTED_MACHINE" ]]; then
    IMAGE="$candidate"
    break
  fi
  echo "→ ${candidate} reported '${reported:-nothing}'; wanted ${EXPECTED_MACHINE}" >&2
done
[[ -n $IMAGE ]] || {
  echo "no candidate image starts a ${PLATFORM} container (${EXPECTED_MACHINE})" >&2
  echo "baselines from the wrong renderer would fail the docs CI job, so this run stopped" >&2
  exit 1
}

echo "→ baselines render in ${IMAGE} (${PLATFORM}), matching the docs CI job"

# Named volume shadows the checkout's node_modules so the workstation install is neither used
# (wrong platform binaries) nor clobbered.  It is keyed to the package, not the machine.
DEPS_VOLUME="dgx-docs-site-deps-linux"

# Read-write mount on purpose: the suite writes the captured baselines back into the checkout.
docker run --rm --init --platform "$PLATFORM" \
  --volume "${REPO_ROOT}:/lab" \
  --volume "${DEPS_VOLUME}:/lab/docs-site/node_modules" \
  --workdir /lab \
  --env UPDATE="$UPDATE" \
  --env EXPECTED_MACHINE="$EXPECTED_MACHINE" \
  --env PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS" \
  "$IMAGE" \
  bash /lab/docs-site/scripts/visual_linux_in_container.sh

status=$?
if [[ $status -eq 0 ]]; then
  if [[ $UPDATE == "true" ]]; then
    echo "→ baselines rewritten in docs-site/tests/visual/goldens — review the image diff, then commit"
  else
    echo "→ baselines match"
  fi
else
  echo "→ see docs-site/tests/visual/actuals/ for what was captured" >&2
fi
exit "$status"
