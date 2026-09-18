#!/usr/bin/env bash
#
# Container half of the Linux golden capture: runs inside the pinned Playwright image with the
# repository mounted at /lab.
#
# Invoked by scripts/visual_linux.sh; not meant to be run directly.  Configuration arrives
# through the environment so nothing has to survive a docker run quoting boundary:
#   UPDATE=true      drop the existing baselines and capture a fresh set
#   PLAYWRIGHT_ARGS  extra arguments forwarded to the visual test run
set -euo pipefail

cd /lab/docs-site

# Refuse to render anything unless this container really is the CI architecture.  The check
# lives here rather than in the launcher because it has to hold for the container that does
# the work, not for a probe started alongside it: a multi-architecture image store can resolve
# a tag to whichever variant it happens to hold, and baselines drawn by the wrong renderer
# then fail the docs CI job for every page.
EXPECTED_MACHINE="${EXPECTED_MACHINE:-}"
ACTUAL_MACHINE="$(uname -m)"
if [[ -n $EXPECTED_MACHINE && $ACTUAL_MACHINE != "$EXPECTED_MACHINE" ]]; then
  echo "expected a container reporting ${EXPECTED_MACHINE}, this one reports ${ACTUAL_MACHINE}" >&2
  echo "baselines from the wrong renderer would fail the docs CI job, so this run stopped" >&2
  exit 1
fi
echo "→ rendering in ${ACTUAL_MACHINE} as expected"

# Dependencies live in a named volume that shadows the checkout's node_modules.  The host
# install is built for the workstation and contains platform-specific helper binaries, so
# reusing it here would run Linux against Mac artefacts.  The volume is refreshed whenever the
# lockfile changes, which is also what CI installs from.
LOCK_HASH="$(sha256sum package-lock.json | cut -d ' ' -f 1)"
STAMP=".deps-linux-stamp"
if [[ ! -x node_modules/.bin/next ]] || [[ "$(cat "$STAMP" 2>/dev/null || echo none)" != "$LOCK_HASH" ]]; then
  echo "→ installing npm dependencies for Linux"
  # node_modules is a mountpoint for the shared volume, so the directory itself cannot be
  # removed; clear what is inside it (dot-entries included) and let the installer repopulate.
  shopt -s nullglob dotglob
  rm -rf -- node_modules/* node_modules/.[!.]* node_modules/..[!.]*
  shopt -u nullglob dotglob
  npm ci --legacy-peer-deps
  printf '%s\n' "$LOCK_HASH" >"$STAMP"
else
  echo "→ reusing the Linux dependency volume"
fi

# The production bundle contains platform-specific native code, so the export has to be built
# by this container rather than reused from the host.  It goes to its own directory so the
# host's export — the one the other gates and the browser checks read — is left intact.
EXPORT_DIR="out-linux"
echo "→ building the static export into ${EXPORT_DIR}/"
rm -rf "$EXPORT_DIR" .next
# The build directory is shared with the host, so whatever this Linux build leaves behind is
# removed on the way out rather than being left for a host build to pick up.
trap 'rm -rf .next "$EXPORT_DIR"' EXIT
NEXT_DIST_DIR="$EXPORT_DIR" npm run build

if [[ ${UPDATE:-false} == "true" ]]; then
  echo "→ discarding the committed baselines to capture a fresh set"
  rm -rf tests/visual/goldens
fi

echo "→ capturing screenshots"
# Split the forwarded arguments into an array so each option reaches the runner as its own
# word, including when a caller passes something like `--project desktop`.
forwarded=()
if [[ -n ${PLAYWRIGHT_ARGS:-} ]]; then
  read -ra forwarded <<<"$PLAYWRIGHT_ARGS"
fi

# The spec refuses to invent a baseline when CI is set, which is right for the pipeline but
# wrong for a deliberate refresh, so those markers are cleared for this invocation.  The suite
# is pointed at this container's export, not the host's.
PLAYWRIGHT_EXPORT_DIR="$EXPORT_DIR" \
  env -u CI -u CONTINUOUS_INTEGRATION npx playwright test --reporter=list \
  "${forwarded[@]+"${forwarded[@]}"}"
