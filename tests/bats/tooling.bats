#!/usr/bin/env bats
#
# Hermetic tests for repo tooling scripts (validate, yaml_format).

load 'test_helper'

setup() {
  TEST_TMP_DIR="$(mktemp -d)"
  export TEST_TMP_DIR
  REPO_ROOT="$(bats_canonical_repo_root)"
  export REPO_ROOT
}

teardown() {
  rm -rf "$TEST_TMP_DIR" || true
}

@test "validate.sh --help prints usage" {
  run bash "${REPO_ROOT}/scripts/validate.sh" --help
  [ "$status" -eq 0 ]
  [[ $output == *"Usage: validate.sh"* ]]
  [[ $output == *"--all"* ]]
  [[ $output == *"--ci"* ]]
}

@test "yaml_format.sh --help prints usage" {
  run bash "${REPO_ROOT}/scripts/yaml_format.sh" --help
  [ "$status" -eq 0 ]
  [[ $output == *"Usage: yaml_format.sh"* ]]
  [[ $output == *"--write"* ]]
  [[ $output == *"--check"* ]]
}

@test "prometheus_scrape dump_yaml_literal works" {
  run python3 "${REPO_ROOT}/scripts/lib/py/test_prometheus_scrape.py"
  [ "$status" -eq 0 ]
}

@test "disk_catalog unit tests" {
  run python3 "${REPO_ROOT}/scripts/lib/py/test_disk_catalog.py"
  [ "$status" -eq 0 ]
}

@test "lab_identities unit tests" {
  run python3 "${REPO_ROOT}/scripts/lib/py/test_lab_identities.py"
  [ "$status" -eq 0 ]
}

@test "disk_inuse unit tests" {
  run python3 "${REPO_ROOT}/scripts/lib/py/test_disk_inuse.py"
  [ "$status" -eq 0 ]
}

@test "resource_policy unit tests" {
  # The Resource Guard maths that gates heavy GPU workload starts.
  run python3 "${REPO_ROOT}/scripts/lib/py/test_resource_policy.py"
  [ "$status" -eq 0 ]
}

@test "suggest_free_resources unit tests" {
  run python3 "${REPO_ROOT}/scripts/lib/py/test_resources_suggest_free_resources.py"
  [ "$status" -eq 0 ]
}

@test "spark-clock stays self-contained" {
  # The systemd unit execs the installed copy at /usr/local/bin, which has no
  # ../lib sibling, so this utility must not come to depend on the shared library.
  [ -f "${REPO_ROOT}/scripts/utilities/spark-clock.sh" ]
  run grep -F 'lib/types.sh' "${REPO_ROOT}/scripts/utilities/spark-clock.sh"
  [ "$status" -ne 0 ]
  grep -qF 'is_numeric()' "${REPO_ROOT}/scripts/utilities/spark-clock.sh"
}

@test "CI bazel-core path filter includes the devcontainer" {
  # Dockerfile-only PRs must still run //tests:bats_devcontainer_test.
  local gh="${REPO_ROOT}/.github/workflows/ci.yml"
  local gitea="${REPO_ROOT}/.gitea/workflows/ci.yml"
  grep -F '.devcontainer/**' "$gh"
  grep -F '.devcontainer/**' "$gitea"
}

@test "devcontainer image workflow builds linux/amd64 and linux/arm64" {
  local wf="${REPO_ROOT}/.github/workflows/devcontainer-image.yml"
  [[ -f $wf ]]
  grep -q 'linux/amd64' "$wf"
  grep -q 'linux/arm64' "$wf"
  grep -q 'packages: write' "$wf"
  grep -F '.devcontainer/**' "$wf"
  grep -q 'ghcr.io' "$wf"
}

@test "devcontainer image digest artifacts have slash-free names" {
  # upload-artifact@v4 rejects names containing / (run 35474275534:
  # "The artifact name is not valid: digests-linux/amd64").
  # Keep docker platforms as linux/amd64; use a separate matrix.artifact id.
  local wf="${REPO_ROOT}/.github/workflows/devcontainer-image.yml"
  [[ -f $wf ]]
  ! grep -F 'name: digests-${{ matrix.platform }}' "$wf"
  grep -F 'name: digests-${{ matrix.artifact }}' "$wf"
  grep -F 'pattern: digests-*' "$wf"
  grep -qE '^[[:space:]]+platform:[[:space:]]+linux/amd64[[:space:]]*$' "$wf"
  grep -qE '^[[:space:]]+platform:[[:space:]]+linux/arm64[[:space:]]*$' "$wf"
  grep -qE '^[[:space:]]+artifact:[[:space:]]+linux-amd64[[:space:]]*$' "$wf"
  grep -qE '^[[:space:]]+artifact:[[:space:]]+linux-arm64[[:space:]]*$' "$wf"
  if grep -E '^[[:space:]]+artifact:[[:space:]]+' "$wf" | grep -q '/'; then
    echo "matrix.artifact values must not contain /:" >&2
    grep -E '^[[:space:]]+artifact:[[:space:]]+' "$wf" >&2
    return 1
  fi
}

@test "CI artifact and docker action pins sit at the current majors" {
  # Dependabot's github-actions group owns these pins. The guard keeps a silent
  # downgrade, or a bump applied to only one CI surface, from landing: both
  # surfaces must carry the same major for actions/upload-artifact.
  # Enumerate the files: CI YAML reaches this test as individual runfiles from
  # //:ci_workflows, so a recursive grep over the directory finds nothing.
  local files=(
    "${REPO_ROOT}/.github/workflows/ci.yml"
    "${REPO_ROOT}/.github/workflows/dashboard-goldens.yml"
    "${REPO_ROOT}/.github/workflows/devcontainer-image.yml"
    "${REPO_ROOT}/.github/workflows/publish-images.yml"
    "${REPO_ROOT}/.gitea/workflows/ci.yml"
  )
  local f
  for f in "${files[@]}"; do
    [[ -f $f ]] || { echo "missing workflow ${f}" >&2; return 1; }
  done

  local spec action want found
  for spec in "actions/upload-artifact v7" \
    "actions/download-artifact v8" \
    "docker/login-action v4" \
    "docker/metadata-action v6"; do
    action="${spec%% *}"
    want="${spec##* }"
    found="$(grep -hoE "uses: ${action}@v[0-9]+" "${files[@]}" | sort -u)"
    # A gate that inspected nothing must fail rather than pass silently.
    if [[ -z $found ]]; then
      echo "no ${action} step found in the CI workflows" >&2
      return 1
    fi
    if [[ $found != "uses: ${action}@${want}" ]]; then
      echo "${action} should be pinned at ${want}, found:" >&2
      echo "$found" >&2
      return 1
    fi
  done
}

@test "CI gates trunk on push and pull requests on both CI surfaces" {
  # Trunk-based development: main is the only long-lived branch. Both CI surfaces
  # must run the gate on push to it, keep pull requests gated (development only
  # while that legacy branch is retired), and stop naming the retired refs.
  # Use portable grep (not host ripgrep): GHA ubuntu-latest has no rg by default.
  local gh="${REPO_ROOT}/.github/workflows/ci.yml"
  local gitea="${REPO_ROOT}/.gitea/workflows/ci.yml"
  [[ -f $gh && -f $gitea ]]
  local file
  for file in "$gh" "$gitea"; do
    if ! grep -A1 -E '^  push:' "$file" | grep -Eq 'branches:[[:space:]]*\[main\]'; then
      echo "push must trigger on trunk alone in ${file}" >&2
      return 1
    fi
    if ! grep -A1 -E '^  pull_request:' "$file" | grep -Eq 'branches:[[:space:]]*\[main, development\]'; then
      echo "pull_request must stay gated on trunk plus the retiring branch in ${file}" >&2
      return 1
    fi
    if grep -A2 -E '^  (push|pull_request):' "$file" |
      grep -Eq '(^|[^[:alnum:]_-])(dev|master)([^[:alnum:]_-]|$)'; then
      echo "retired branch still named in the triggers of ${file}" >&2
      return 1
    fi
  done
}

# Extract unique "owner/name@vN" (or "owner/name@vN.M") pins from a workflow YAML.
# Ignores local composite actions (./.github/...).
_ci_action_pins() {
  local file="$1"
  # Match marketplace-style uses: lines; drop leading whitespace / "- uses:".
  grep -oE 'uses:[[:space:]]+[^[:space:]#]+' "$file" |
    sed -E 's/^uses:[[:space:]]+//' |
    grep -E '^[^./][^@]*@v[0-9]+' |
    sed -E 's|@v([0-9]+).*|@v\1|' |
    sort -u
}

@test "Gitea CI mirrors GitHub CI jobs, filters, commands, and action majors" {
  # Feature parity: .gitea/workflows/ci.yml is the Forgejo/Gitea mirror of
  # .github/workflows/ci.yml. Job graph, path filters, Bazel commands, and
  # marketplace action major versions must stay aligned. Intentional
  # non-parity (deploy-docs, dependabot, Gitea header comment) is out of scope.
  local gh="${REPO_ROOT}/.github/workflows/ci.yml"
  local gitea="${REPO_ROOT}/.gitea/workflows/ci.yml"
  [[ -f $gh && -f $gitea ]]

  local job
  for job in changes bazel-core dashboard-unit dashboard-hermetic docs-and-render validate-gate; do
    grep -qE "^  ${job}:" "$gh"
    grep -qE "^  ${job}:" "$gitea"
  done

  local filter
  for filter in bazel-core dashboard docs ci-graph ci-workflow; do
    grep -qE "^[[:space:]]+${filter}:" "$gh"
    grep -qE "^[[:space:]]+${filter}:" "$gitea"
  done

  local cmd
  for cmd in \
    '//:test-fast //:lint' \
    '//dashboard:fast-test' \
    'DASHBOARD_TEST_MODE=visual' \
    'DASHBOARD_TEST_MODE=full' \
    '//docs-site:visual-linux' \
    '//docs-site:visual_tooling_test' \
    'scripts/ci_check_only.sh'; do
    grep -qF "$cmd" "$gh"
    grep -qF "$cmd" "$gitea"
  done

  # Shared setup composite must remain referenced from Gitea (do not fork it).
  grep -qF './.github/actions/setup-bazel' "$gitea"

  local gh_pins gitea_pins
  gh_pins="$(_ci_action_pins "$gh")"
  gitea_pins="$(_ci_action_pins "$gitea")"
  if [[ $gh_pins != "$gitea_pins" ]]; then
    echo "Marketplace action major pins differ (bump both in the same PR):" >&2
    echo "--- GitHub ---" >&2
    echo "$gh_pins" >&2
    echo "--- Gitea ---" >&2
    echo "$gitea_pins" >&2
    diff -u <(printf '%s\n' "$gh_pins") <(printf '%s\n' "$gitea_pins") >&2 || true
    return 1
  fi
}

@test "Dependabot PRs target trunk" {
  # main is the trunk and the only long-lived branch, so dependency updates must
  # open against it. Without target-branch the ecosystem still resolves to the
  # default branch, and an explicit value keeps the intent reviewable.
  local cfg="${REPO_ROOT}/.github/dependabot.yml"
  [[ -f $cfg ]]
  local ecosystems targets
  ecosystems=$(grep -cE '^[[:space:]]+-[[:space:]]+package-ecosystem:' "$cfg" || true)
  targets=$(grep -cE '^[[:space:]]+target-branch:[[:space:]]+main[[:space:]]*$' "$cfg" || true)
  if [[ $ecosystems -lt 3 || $ecosystems -ne $targets ]]; then
    echo "Each Dependabot ecosystem must set target-branch: main:" >&2
    echo "package-ecosystem count=${ecosystems} target-branch: main count=${targets}" >&2
    return 1
  fi
}

@test "GitHub Actions cache action is Node-24-capable (not cache@v4)" {
  # actions/cache@v4 targets deprecated Node 20 on GitHub runners.
  # Prefer @v5+ (repo standard: @v6) in workflows and composite actions.
  # CI YAML is provided hermetically via //:ci_workflows runfiles.
  local setup_bazel="${REPO_ROOT}/.github/actions/setup-bazel/action.yml"
  local hits=""
  local f
  for f in \
    "${REPO_ROOT}/.github/actions/setup-bazel/action.yml" \
    "${REPO_ROOT}/.github/workflows/ci.yml" \
    "${REPO_ROOT}/.github/workflows/deploy-docs.yml" \
    "${REPO_ROOT}/.github/workflows/devcontainer-image.yml" \
    "${REPO_ROOT}/.github/workflows/publish-images.yml" \
    "${REPO_ROOT}/.gitea/workflows/ci.yml"; do
    if [[ -f $f ]] && grep -qE 'actions/cache@v4([^0-9]|$)' "$f"; then
      hits+="$(grep -nE 'actions/cache@v4([^0-9]|$)' "$f")"$'\n'
    fi
  done
  if [[ -n $hits ]]; then
    echo "Found deprecated actions/cache@v4 (use actions/cache@v6):" >&2
    echo "$hits" >&2
    return 1
  fi
  # Positive control: setup-bazel must pin a modern cache major.
  [[ -f $setup_bazel ]]
  grep -qE 'actions/cache@v[56]([^0-9]|$)' "$setup_bazel"
}

_publish_image_ids() {
  python3 - <<'PY'
import json
import os
from pathlib import Path

root = Path(os.environ["REPO_ROOT"])
catalog = json.loads((root / ".github/container-images.json").read_text())
print(" ".join(img["id"] for img in catalog["images"]))
PY
}

@test "publish-images catalog lists portable lab images only" {
  local catalog="${REPO_ROOT}/.github/container-images.json"
  [[ -f $catalog ]]
  python3 - "$catalog" <<'PY'
import json
import sys
from pathlib import Path

catalog_path = Path(sys.argv[1])
data = json.loads(catalog_path.read_text())
images = data["images"]
got = [img["id"] for img in images]
want = [
    "lab-dashboard",
    "mcp-fetch",
    "mcp-gitea",
    "mcp-qdrant",
    "mcp-memory",
    "mcp-searxng",
    "mcp-firecrawl",
    "context7-proxy",
    "doc-ingest",
    "coder-workspace",
]
if got != want:
    print(f"catalog ids {got} != {want}", file=sys.stderr)
    sys.exit(1)
forbidden = (
    "devcontainer",
    "lab-dashboard-test",
    "glm53-flash-tp3",
    "dsv41-flash-tp3",
    "kasm-spark-desktop",
    "spark-lab-kasm-desktop",
)
for img in images:
    for key in ("id", "file", "context", "paths"):
        if key not in img or img[key] in ("", [], None):
            print(f"{img.get('id', '<missing>')}: missing {key}", file=sys.stderr)
            sys.exit(1)
    if "/" in img["id"]:
        print(f"image id must be slash-free for artifact names: {img['id']}", file=sys.stderr)
        sys.exit(1)
    if img["id"] in forbidden or any(tok in img["file"] for tok in forbidden):
        print(f"must not publish {img['id']} ({img['file']})", file=sys.stderr)
        sys.exit(1)
    if "Dockerfile.test" in img["file"]:
        print(f"must not publish test image {img['file']}", file=sys.stderr)
        sys.exit(1)
print("ok")
PY
}

@test "publish-images workflow builds linux/amd64 and linux/arm64 and pushes GHCR only after merge" {
  local wf="${REPO_ROOT}/.github/workflows/publish-images.yml"
  local catalog="${REPO_ROOT}/.github/container-images.json"
  [[ -f $wf && -f $catalog ]]
  grep -q 'packages: write' "$wf"
  grep -q 'ghcr.io' "$wf"
  grep -q 'linux/amd64' "$wf"
  grep -q 'linux/arm64' "$wf"
  grep -q 'ubuntu-24.04-arm' "$wf"
  grep -q 'workflow_dispatch' "$wf"
  grep -F '.github/container-images.json' "$wf"
  grep -q 'type=cacheonly' "$wf"
  grep -q 'push-by-digest=true' "$wf"
  grep -q 'github.event_name != '\''pull_request'\''' "$wf" ||
    grep -q 'github.event_name != "pull_request"' "$wf"
  # PRs must not get a pull_request publish path (cacheonly + no merge).
  grep -qE '^[[:space:]]+if:.*github.event_name != .pull_request' "$wf" ||
    grep -qF "if: github.event_name != 'pull_request'" "$wf"
  ! grep -F 'name: digests-${{ matrix.platform }}' "$wf"
  grep -F 'digests-${{ matrix.image }}' "$wf"
  grep -qE 'artifact:[[:space:]]+linux-amd64|linux-amd64' "$wf"
  grep -qE 'artifact:[[:space:]]+linux-arm64|linux-arm64' "$wf"
  local id
  for id in $(_publish_image_ids); do
    grep -qF "$id" "$catalog"
  done
  [[ ! -f ${REPO_ROOT}/.gitea/workflows/publish-images.yml ]]
}

@test "publish-images Dockerfiles are not blocked by root dockerignore COPY excludes" {
  # Root .dockerignore excludes k8s/ and ansible/ so hermetic dashboard tests
  # stay small. Production images COPY those trees, so they need a sibling
  # <Dockerfile>.dockerignore that un-excludes the COPY sources (BuildKit).
  local root_ignore="${REPO_ROOT}/.dockerignore"
  local dash_ignore="${REPO_ROOT}/dashboard/Dockerfile.dockerignore"
  local coder_ignore="${REPO_ROOT}/k8s/dev/images/coder-workspace/Dockerfile.dockerignore"
  [[ -f $root_ignore && -f $dash_ignore && -f $coder_ignore ]]
  grep -qE '^k8s/' "$root_ignore"
  grep -qE '^ansible/' "$root_ignore"
  grep -q '!k8s/workloads' "$dash_ignore"
  grep -q '!k8s/base' "$dash_ignore"
  grep -q '!ansible/files/coder-values.yaml' "$dash_ignore"
  grep -q '!k8s/dev/images/coder-workspace' "$coder_ignore"
  grep -q 'workspace-init.sh' "$coder_ignore"
  grep -q 'coder-workspace.mcp.json.example' "$coder_ignore"
}

@test "dashboard image builder creates public before COPY --from=builder" {
  # The dashboard has no public/ directory. Docker COPY of a missing path
  # fails with: failed to calculate checksum ... "/app/public": not found.
  local df="${REPO_ROOT}/dashboard/Dockerfile"
  [[ -f $df ]]
  python3 - "$df" <<'PY'
import sys
from pathlib import Path

text = Path(sys.argv[1]).read_text()
if "COPY --from=builder /app/public" not in text:
    print("ok (no public COPY)")
    sys.exit(0)
if "mkdir -p public" not in text and "mkdir -p /app/public" not in text:
    print(
        "builder must mkdir -p public before COPY --from=builder /app/public",
        file=sys.stderr,
    )
    sys.exit(1)
print("ok")
PY
}

@test "dashboard image npm ci uses --legacy-peer-deps like the hermetic test image" {
  # Plain `npm ci` on node:alpine hits arborist "Cannot read properties of
  # null (reading 'edgesOut')". dashboard/Dockerfile.test and run_npm.sh
  # already pass --legacy-peer-deps; the production image must match.
  local prod="${REPO_ROOT}/dashboard/Dockerfile"
  [[ -f $prod ]]
  grep -qE 'npm ci --legacy-peer-deps' "$prod"
}

@test "dashboard image apk packages include openssl for get-helm-3" {
  # node:alpine does not ship openssl. Helm's get-helm-3 verifies the tarball
  # checksum with it and otherwise fails: "openssl must first be installed".
  local df="${REPO_ROOT}/dashboard/Dockerfile"
  [[ -f $df ]]
  python3 - "$df" <<'PY'
import re
import sys
from pathlib import Path

text = Path(sys.argv[1]).read_text()
if "get-helm-3" not in text:
    print("dashboard Dockerfile must install helm via get-helm-3", file=sys.stderr)
    sys.exit(1)
apk = None
for line in text.splitlines():
    if "apk add" in line:
        apk = line
    if "get-helm-3" in line and apk:
        break
else:
    print("get-helm-3 must follow an apk add in dashboard/Dockerfile", file=sys.stderr)
    sys.exit(1)
if not re.search(r"(^|[\s])openssl([\s\\]|$)", apk):
    print(f"apk add before get-helm-3 must include openssl: {apk}", file=sys.stderr)
    sys.exit(1)
print("ok")
PY
}

@test "coder-workspace installs yamllint via pip only" {
  # apt yamllint has no pip RECORD. A later `pip install yamllint` (or
  # ansible-lint, which depends on it) then fails with uninstall-no-record-file.
  local df="${REPO_ROOT}/k8s/dev/images/coder-workspace/Dockerfile"
  [[ -f $df ]]
  python3 - "$df" <<'PY'
import sys
from pathlib import Path

lines = Path(sys.argv[1]).read_text().splitlines()
in_apt = False
in_pip = False
apt_yamllint = False
pip_yamllint = False
for line in lines:
    stripped = line.strip().rstrip("\\").strip()
    if line.startswith("RUN ") and "apt-get install" in line:
        in_apt, in_pip = True, False
    elif line.startswith("RUN ") and ("pip3 install" in line or "pip install" in line):
        in_apt, in_pip = False, True
    elif line.startswith("RUN "):
        in_apt, in_pip = False, False
    if in_apt and stripped == "yamllint":
        apt_yamllint = True
    if in_pip and stripped == "yamllint":
        pip_yamllint = True
if apt_yamllint:
    print("coder-workspace must not apt-install yamllint (pip RECORD conflict)", file=sys.stderr)
    sys.exit(1)
if not pip_yamllint:
    print("coder-workspace must pip-install yamllint", file=sys.stderr)
    sys.exit(1)
print("ok")
PY
}

@test "coder-workspace installs the lint trio in its own venv" {
  # apt installs ansible, which drags in Debian wheels (python3-cryptography, ansible-core) that
  # ship without a pip RECORD. A pip install into system site-packages then aborts with
  # uninstall-no-record-file, and shadowing those wheels would silently repoint the workspace's
  # own ansible. The linters get a venv instead, so neither side touches the other.
  local df="${REPO_ROOT}/k8s/dev/images/coder-workspace/Dockerfile"
  [[ -f $df ]]
  if ! grep -qE 'python3 -m venv ' "$df"; then
    echo "the lint trio must install into a dedicated venv:" >&2
    grep -nE 'pip3? install' "$df" >&2 || true
    return 1
  fi
  local tool
  for tool in ansible-lint yamllint ruff; do
    if ! grep -A4 -E 'bin/pip install --no-cache-dir[[:space:]]+\\$' "$df" |
      grep -Eq "^[[:space:]]+${tool}([[:space:]]+\\\\)?$"; then
      echo "the venv pip must install ${tool}:" >&2
      grep -nE -A4 'bin/pip install' "$df" >&2 || true
      return 1
    fi
    if ! grep -Eq "ln -sf[^;]*bin/${tool}( |$|\\\\)" "$df"; then
      echo "${tool} must be linked onto PATH from the venv:" >&2
      return 1
    fi
  done
  # apt ansible is what the workspace runs lab playbooks with; the venv must leave it installed.
  if ! grep -Eq '^[[:space:]]+ansible[[:space:]]+\\$' "$df"; then
    echo "coder-workspace must keep apt-installing ansible:" >&2
    grep -nE '^[[:space:]]+ansible' "$df" >&2 || true
    return 1
  fi
  # The venv dir goes on the END of PATH. ansible-lint stays quiet only when its own directory is
  # already there, and appending keeps /usr/bin/ansible and /usr/bin/python3 winning over the copies
  # a venv bin also carries. Prepending would repoint the workspace's ansible.
  if grep -Eq '^[[:space:]]*ENV[[:space:]]+PATH="/opt/lab-lint/bin' "$df"; then
    echo "the venv must be appended to PATH, never prepended (it would shadow distro ansible):" >&2
    grep -nE '^[[:space:]]*ENV[[:space:]]+PATH=' "$df" >&2 || true
    return 1
  fi
  if ! grep -Eq '^[[:space:]]*ENV[[:space:]]+PATH=".*:/opt/lab-lint/bin"' "$df"; then
    echo "PATH must end with the venv bin so ansible-lint finds its own directory:" >&2
    grep -nE '^[[:space:]]*ENV[[:space:]]+PATH=' "$df" >&2 || true
    return 1
  fi
}

@test "Deploy Documentation workflow publishes only after merge (not on PR)" {
  # Public docs go live on push to trunk (a merged PR) or workflow_dispatch, by
  # publishing the two static exports. Opening a PR must
  # not deploy-pages or trigger a pull_request publish path (PR validation is
  # the docs-and-render CI job).
  local deploy="${REPO_ROOT}/.github/workflows/deploy-docs.yml"
  [[ -f $deploy ]]
  # No PR trigger for this workflow.
  if grep -qE '^[[:space:]]*pull_request:' "$deploy"; then
    echo "deploy-docs.yml must not trigger on pull_request:" >&2
    grep -nE '^[[:space:]]*pull_request:' "$deploy" >&2 || true
    return 1
  fi
  # Publishing commits the assembled tree to the repository's legacy `gh-pages`
  # Pages source branch, which is only reachable from the push/dispatch triggers
  # above.  A PR-time deploy would let an unreviewed branch overwrite the public
  # site, so the checks below are the ones that keep it safe.
  if grep -qE 'preview-branch|allow-preview-deployment|pages-deployment-branch' "$deploy"; then
    echo "deploy-docs.yml must not publish a PR preview deployment:" >&2
    grep -nE 'preview-branch|allow-preview-deployment|pages-deployment-branch' "$deploy" >&2 || true
    return 1
  fi
  # Positive controls: push to trunk alone + manual republish + both version
  # aliases published.
  grep -qE '^[[:space:]]*push:' "$deploy"
  grep -A1 -E '^[[:space:]]*push:' "$deploy" | grep -qE 'branches:[[:space:]]*\[main\]'
  grep -qF 'workflow_dispatch' "$deploy"
  grep -qF '//docs-site:build-latest' "$deploy"
  grep -qF '//docs-site:build-development' "$deploy"
  grep -qF 'git push origin gh-pages' "$deploy"
  # The gh-pages branch is a fast-forward-only artifact branch: no force-push, ever.
  if grep -qE 'git push .*(--force|-f)' "$deploy"; then
    echo "deploy-docs.yml must never force-push the gh-pages branch:" >&2
    grep -nE 'git push .*(--force|-f)' "$deploy" >&2 || true
    return 1
  fi
  # The publish commit is scoped to the published site: after the branch switch
  # the source .gitignore is gone from the worktree, so a bare `git add -A`
  # would commit the build workspace (node_modules, .next, bazel symlinks)
  # into the Pages branch.
  grep -qF '!/latest' "$deploy"
  grep -qF '!/development' "$deploy"
  grep -qF '!/index.html' "$deploy"
  # GitHub Pages in legacy (Jekyll) mode drops `_next/` unless a root `.nojekyll`
  # is published.  The scoped gitignore would also drop that file unless it is
  # explicitly un-ignored.
  grep -qF '.nojekyll' "$deploy"
  grep -qF '!/.nojekyll' "$deploy"
  # The working tree is restored to the source commit after the push: local
  # composite actions re-resolve their action.yml from disk in post steps.
  grep -qF 'SRC_SHA=$(git rev-parse HEAD)' "$deploy"
  grep -qF 'git checkout -f "$SRC_SHA"' "$deploy"
  # mike is gone: nothing may shell out to it any more.
  if grep -qF 'mike ' "$deploy"; then
    echo "deploy-docs.yml still invokes mike:" >&2
    grep -nF 'mike ' "$deploy" >&2 || true
    return 1
  fi
}

@test "Published docs aliases bake the GitHub Pages repo prefix, not a host-root /latest" {
  # Project Pages lives at /<repo>/{latest,development}/.  A Next basePath of
  # `/latest` makes the browser request https://<user>.github.io/latest/_next/...
  # which 404s and leaves the live docs unstyled.  Alias builds must pass
  # DOCS_ALIAS and must not inject a half-path NEXT_BASE_PATH.
  local pkg="${REPO_ROOT}/docs-site/package.json"
  local runner="${REPO_ROOT}/docs-site/run_npm.sh"
  [[ -f $pkg && -f $runner ]]
  grep -qF 'DOCS_ALIAS=latest' "$pkg"
  grep -qF 'DOCS_ALIAS=development' "$pkg"
  if grep -qE 'NEXT_BASE_PATH=/(latest|development)([[:space:]"]|$)' "$pkg" "$runner"; then
    echo "alias builds must not set NEXT_BASE_PATH to a host-root /latest or /development:" >&2
    grep -nE 'NEXT_BASE_PATH=/(latest|development)([[:space:]"]|$)' "$pkg" "$runner" >&2 || true
    return 1
  fi
}

# ## docs-site npm install lock
#
# `//:test-fast` runs `//docs-site:unit` and `//docs:test_command_vars` in parallel, and both
# have to run Vitest out of the *physical* docs-site directory: Vite realpath-resolves every
# module it serves, so a runfiles symlink tree splits one suite across two copies of React and
# vitest. Sharing that directory means sharing one node_modules, and two first-run `npm ci`
# calls in it race (`npm error ENOTEMPTY: directory not empty, rmdir node_modules/...`, seen
# on the CI runner for PR #80). The lock in docs-site/scripts/npm-install-lock.sh is what keeps
# them apart; these tests hold that contract.

make_docs_site_fixture() {
  local root="$1"
  mkdir -p "$root/pkg" "$root/rf" "$root/bin" "$root/pkg/scripts"
  printf '{"name":"docs-site-fixture"}\n' >"$root/pkg/package.json"
  cp "${REPO_ROOT}/docs-site/run_npm.sh" "$root/pkg/run_npm.sh"
  cp "${REPO_ROOT}/docs-site/scripts/npm-install-lock.sh" "$root/pkg/scripts/npm-install-lock.sh"
  # Mimic the runfiles layout: the package arrives as a symlink into the real tree.
  ln -s "$root/pkg" "$root/rf/docs-site"
  cat >"$root/bin/npm" <<'FAKENPM'
#!/usr/bin/env bash
set -euo pipefail
echo "$*" >>"${FAKE_NPM_LOG:?}"
echo "$PWD" >>"${FAKE_NPM_PWD_LOG:-/dev/null}"
if [[ ${1:-} == "ci" ]]; then
  sleep "${FAKE_NPM_SLEEP:-0}"
  mkdir -p node_modules/.bin
  for bin in next vitest tsc; do
    printf '#!/usr/bin/env bash\nexit 0\n' >"node_modules/.bin/$bin"
    chmod +x "node_modules/.bin/$bin"
  done
fi
FAKENPM
  chmod +x "$root/bin/npm"
}

@test "docs-site npm install lock keeps concurrent installers apart" {
  local helper="${REPO_ROOT}/docs-site/scripts/npm-install-lock.sh"
  [[ -f $helper ]]
  local marker="$TEST_TMP_DIR/in-flight"
  local observed="$TEST_TMP_DIR/observed"
  echo 0 >"$marker"
  : >"$observed"
  local i pid
  for i in 1 2 3; do
    (
      # shellcheck source=/dev/null
      source "$helper"
      npm_install_lock "$TEST_TMP_DIR/pkg"
      live=$(( $(<"$marker") + 1 ))
      echo "$live" >"$marker"
      echo "$live" >>"$observed"
      sleep 1
      echo $(( live - 1 )) >"$marker"
    ) &
    pid=$!
  done
  wait "$pid"
  # The highest concurrency any holder observed was 1, so no two acquirers overlapped.
  [ "$(sort -n "$observed" | tail -1)" = "1" ]
}

@test "run_npm.sh installs docs-site deps once when two Bazel tests share the package dir" {
  local root="$TEST_TMP_DIR/shared"
  make_docs_site_fixture "$root"
  export FAKE_NPM_LOG="$TEST_TMP_DIR/npm.log"
  export FAKE_NPM_PWD_LOG="$TEST_TMP_DIR/pwd.log"
  export FAKE_NPM_SLEEP=1
  : >"$FAKE_NPM_LOG"
  local p1 p2
  ( PATH="$root/bin:$PATH" bash "$root/rf/docs-site/run_npm.sh" unit ) &
  p1=$!
  ( PATH="$root/bin:$PATH" bash "$root/rf/docs-site/run_npm.sh" unit ) &
  p2=$!
  wait "$p1"
  wait "$p2"
  local ci_count
  ci_count=$(grep -c '^ci ' "$FAKE_NPM_LOG" || true)
  [ "$ci_count" = "1" ]
}

@test "run_npm.sh keeps non-Vitest subcommands out of the shared package dir" {
  # Only Vitest needs the realpath'd tree. Pulling tsc, next build and the codemods in there
  # too is what put three targets on one node_modules.
  local root="$TEST_TMP_DIR/typecheck"
  make_docs_site_fixture "$root"
  export FAKE_NPM_LOG="$TEST_TMP_DIR/npm.log"
  export FAKE_NPM_PWD_LOG="$TEST_TMP_DIR/pwd.log"
  : >"$FAKE_NPM_LOG"
  : >"$FAKE_NPM_PWD_LOG"
  PATH="$root/bin:$PATH" bash "$root/rf/docs-site/run_npm.sh" typecheck
  [ "$(sort -u "$FAKE_NPM_PWD_LOG")" = "$root/rf/docs-site" ]
}

@test "docs command-vars test shares the docs-site install lock" {
  local script="${REPO_ROOT}/docs/test_command_vars.sh"
  [[ -f $script ]]
  grep -q 'npm-install-lock.sh' "$script"
}

# ## dashboard npm runner argument passthrough
#
# `bazelisk run //dashboard:visual -- --update-snapshots` silently did nothing. The lane ran
# `npm exec playwright test --update-snapshots`, and npm claimed the flag as its own setting
# ("npm warn Unknown cli config --update-snapshots") instead of handing it to Playwright, so
# Playwright compared against the committed goldens rather than rewriting them. With no working
# way to regenerate a baseline, the golden matrix rotted: the specs captured light mode and the
# routed sections, but those files had never been written to disk. The lane must separate npm's
# options from Playwright's with `--`, which is what the test lane already does with
# `npm run test -- --run`.

make_dashboard_npm_fixture() {
  local root="$1"
  mkdir -p "$root/pkg" "$root/bin" "$root/pkg/node_modules/.bin"
  printf '{"name":"dashboard-fixture"}\n' >"$root/pkg/package.json"
  cp "${REPO_ROOT}/dashboard/run_npm.sh" "$root/pkg/run_npm.sh"
  # ensure_deps() only runs `npm ci` when neither binary is present.
  printf '#!/usr/bin/env bash\nexit 0\n' >"$root/pkg/node_modules/.bin/playwright"
  chmod +x "$root/pkg/node_modules/.bin/playwright"
  cat >"$root/bin/npm" <<'FAKENPM'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"${FAKE_NPM_LOG:?}"
FAKENPM
  chmod +x "$root/bin/npm"
}

@test "dashboard visual lane forwards passthrough args to playwright" {
  local root="$TEST_TMP_DIR/dash"
  make_dashboard_npm_fixture "$root"
  export FAKE_NPM_LOG="$root/npm.log"
  : >"$FAKE_NPM_LOG"

  run env -u BUILD_WORKSPACE_DIRECTORY PATH="$root/bin:$PATH" \
    bash "$root/pkg/run_npm.sh" visual --update-snapshots
  [ "$status" -eq 0 ]
  cat "$FAKE_NPM_LOG"

  # The flag has to survive to Playwright, so `--` must separate it from npm's own options.
  grep -qF 'playwright test -- --update-snapshots' "$FAKE_NPM_LOG"
}

@test "dashboard visual lane still runs playwright with no passthrough args" {
  local root="$TEST_TMP_DIR/dash-empty"
  make_dashboard_npm_fixture "$root"
  export FAKE_NPM_LOG="$root/npm.log"
  : >"$FAKE_NPM_LOG"

  run env -u BUILD_WORKSPACE_DIRECTORY PATH="$root/bin:$PATH" \
    bash "$root/pkg/run_npm.sh" visual
  [ "$status" -eq 0 ]
  cat "$FAKE_NPM_LOG"
  grep -qE '^exec playwright test( --)?$' "$FAKE_NPM_LOG"
}

@test "every Next app keeps its build output out of the Bazel workspace" {
  # `next build` writes dashboard/.next/standalone/, and the standalone copy carries the
  # app's own BUILD.bazel, .dockerignore and .env.example with it. Bazel then loads that
  # generated tree as a real package, so //tests:bazel_file_coverage starts reporting
  # unsanctioned globs and dangling references that nobody wrote. .gitignore keeps the tree
  # out of commits; only a .bazelignore entry keeps it out of the build graph.
  local found=0
  local cfg app_dir
  while IFS= read -r cfg; do
    app_dir="${cfg#./}"
    app_dir="$(dirname "$app_dir")"
    found=$((found + 1))
    if ! grep -qxF "${app_dir}/.next/" "${REPO_ROOT}/.bazelignore"; then
      echo "missing from .bazelignore: ${app_dir}/.next/" >&2
      return 1
    fi
  done < <(
    cd "$REPO_ROOT" && find . -maxdepth 2 -name 'next.config.*' \
      -not -path '*/node_modules/*' -not -path '*/.next/*'
  )

  # A check that inspected nothing must fail, the same rule //lints:mypy follows. This repo
  # ships exactly two Next apps, so a run that sees fewer has lost its data deps.
  [ "$found" -ge 2 ]
}
