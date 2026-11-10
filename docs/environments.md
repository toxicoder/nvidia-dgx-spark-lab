---
title: Environments
description: Environments are values, secrets, and a location, never a branch or a second copy of the tree; the real value and secret homes, and how one revision is promoted across them.
tags: [environments, deploy, helm, kustomize, ansible, ghcr, safety]
---

# Environments

**What's on this page**

- The rule: an environment is values, secrets, and a location
- Every environment that exists here, with its one value home, its secret home, and its artifact channel
- What only looks like an environment: the Kustomize overlays, the Ansible groups, the namespace
- A promotion you can paste: dev, then trunk, then stable, against one revision
- The homes that do not exist yet, named as gaps rather than invented

**What this enables**

- Promoting a change by naming one revision, so dev, the lab, and a held stable run provably the same code
- Finding the one file to edit for a value, instead of grepping a second copy of the tree
- Rolling back by re-pointing a tag, without a rebuild and without a branch
- Reviewing a value change as data, with the code untouched

## The rule

An environment is three things and only three things: a set of **values**, a place to keep
its **secrets**, and a **location** (the host or cluster that runs it). It is not a branch,
and it is not a directory that holds a second copy of the tree.

Three corollaries follow, and all three are load-bearing here:

1. Two environments run the **same revision** with different values. The lever between them
   is an image tag or digest, never a branch name.
2. A second copy of the tree is not an environment; it is a fork, and forks drift. The
   retired `development` branch is the case study in
   [Branching and Trunk-Based Development](branching.md).
3. If an environment differs only in a value, the difference belongs in a file that holds
   nothing but values.

## The environments that exist

| Environment | What it is | Its ONE value home | Its secret home | Artifact channel |
| --- | --- | --- | --- | --- |
| `dev` | Your machine or the devcontainer; hermetic, no cluster, no GPU | `config/flags.yaml` harness defaults plus the process environment; toolchain pins in `.devcontainer/tool-versions.env` | none needed: `USE_MOCKS` and `AUTH_BYPASS` read fixtures, and a fixture carries no credential | the working tree; nothing is pulled and nothing is published |
| `ci` | Ephemeral runners on push and pull request | the workflow files under `.github/workflows/` plus `.devcontainer/tool-versions.env` | GitHub's own `GITHUB_TOKEN`, which writes GHCR on push only; no repo-held secret | the devcontainer image and the GHCR build cache |
| `lab` | the one deployed environment: the DGX Spark fleet, namespace `ai-inference` plus `dev`, `monitoring`, and `agent-tools` | **does not exist yet** - split across the six homes in the next table | committed shape is `*.example.yaml`; live values reach the cluster, the dashboard vault, or the process environment (`LAB_SWITCH_PASSWORD`) | `ghcr.io/toxicoder/nvidia-dgx-spark-lab/<id>`, catalogued in `.github/container-images.json` and built by `.github/workflows/publish-images.yml` |
| `stable` | a revision the lab holds instead of following | **does not exist yet** - nothing records the promoted digest | same as `lab` | an annotated tag on trunk (`vX.Y.Z`) plus the `sha-<short>` tag that build already published |
| `docs` | the public site on GitHub Pages | the `docs/` tree plus `docs-site/lib/nav.json` | none; `GITHUB_TOKEN` only | `.github/workflows/deploy-docs.yml`, published under `latest/` (the `development/` tree retires with the branch) |

## Where the lab's values actually live

`lab` has no single value home today. These six files are the whole set, and each is
authoritative for exactly its own layer:

| Layer | File | What it owns |
| --- | --- | --- |
| Host | `ansible/inventory/group_vars/all.yml` | K3s pin (`k3s_version`, `k3s_channel`), the GPU Operator and chart versions, the `nccl_env` reference block, and the NodePort registry (`*_nodeport`) |
| Lab policy | `config/resource-policy.yaml` and its `.json` twin, plus `config/flags.yaml` | capacity math and headroom, tiers and model registry, and every switch the code branches on |
| Lab identity | `config/lab-domains.yaml` | `local_domain`, `public_domain`, `primary`, `email_domain`, `sso.*`, `tls.*`; regenerate derived manifests with `bazelisk run //:manage -- domains render` |
| Third-party charts | `ansible/files/<chart>-values.yaml` | committed Helm values for Traefik, Authelia, Grafana, Coder, Kasm, node-exporter, and the rest |
| First-party chart | `helm/lab-dashboard/values.yaml` | exactly one values file; no `values-<env>.yaml` exists |
| In-cluster workloads | `k8s/base/`, `k8s/workloads/`, `k8s/dev/`, `mcp/k8s/` | deployed resources, `restartPolicy`, `NCCL_*` env, and image references |

`mcp/config/mcp-policy.yaml` is a seventh, and it is the registry for the MCP component
NodePorts. The host file and that one together are the de-facto port registry: two
environments cannot share a node, because the ports are literals in
`k8s/dev/dashboard/service.yaml`, `k8s/workloads/litellm/service.yaml`,
`ansible/files/traefik-values.yaml`, and `ansible/files/node-exporter-values.yaml`.

## What is not an environment

These look like environments and are not. Each is a size, a topology role, or a string.

**The Kustomize overlays are workload sizes.** `k8s/overlays/` holds 14 directories: nine
`litellm-*` model variants, `rounded-stack`, `rounded-stack-quality`, and `prod` / `test` /
`single-node`. `prod` points at `k8s/workloads/kimi` and nothing else; `test` points at
`k8s/workloads/kimi-test` with `patches/test-resources.yaml`; `single-node` points at
`k8s/workloads/kimi-test` with the tensor-parallel patch. None of the three sets
`namespace`, `namePrefix`, `images:`, or a credential. They differ in which base workload
directory they pull and how many GPUs a patch pins. Only `single-node/qwen36-dual` is
applied by code, in `scripts/lib/models.sh`. The matrix is
[Overlays](operate/overlays.md).

**The namespace is a literal.** `scripts/manage.sh` sets `NAMESPACE="ai-inference"` and
every mutating command uses it. There is no `--env` flag anywhere in this repository, and
no code path selects a namespace from a name.

**Deploy is a path chosen by model, not by environment.** Roughly twelve literal
`kubectl apply -k <path>` call sites in `scripts/lib/*.sh` and `scripts/manage.sh` do the
applying, and the path is picked by a shell `case` on the model name. That is a model
selector, not an environment selector.

**The Ansible groups are topology roles.** `k3s_cluster`, `k3s_server`, and `k3s_agent`
describe how the nodes are cabled. There is no `group_vars/<env>.yml`; the only group vars
file is `all.yml`. `ansible/inventory/hosts.ini` is generated and gitignored, and
`ansible/inventory/lab.yaml` is the declared source of truth for topology. See
[Ansible catalog](operate/ansible-catalog.md).

## Promotion: one revision, three value sets

Pick the revision once. Everything below installs that revision, so the only thing that
changes between stages is which values file is in front of it.

```bash
# Stage 0: choose the revision on trunk, once.
git switch main
git pull --ff-only
REV="$(git rev-parse --short=7 HEAD)"        # one revision, named once, used everywhere below
echo "promoting ${REV}"
```

**dev** - hermetic, on the machine that made the change:

```bash
bazelisk run //:doctor                        # pinned toolchain present
bazelisk run //:validate -- --all             # the whole gate, before anyone reviews it
bazelisk test //tests:flags_registry          # every switch is declared; unfinished ones default off
bazelisk run //:manage -- status              # read-only: tools, cluster reachability, GPUs
```

**trunk** - the lab soaks the tip, and the artifact is pinned to the revision under test:

```bash
# Host values first: prove the change without touching a node.
ansible-playbook -i ansible/inventory/hosts.ini \
  ansible/playbooks/bootstrap-cluster.yml --check --diff

# Only once --check is clean, through the Bazel entry point:
bazelisk run //ansible:bootstrap -- -i inventory/hosts.ini

# First-party app: the GHCR tag that this very revision's build published.
helm upgrade --install lab-dashboard helm/lab-dashboard \
  -n dev \
  -f helm/lab-dashboard/values.yaml \
  --set image.repository=ghcr.io/toxicoder/nvidia-dgx-spark-lab/lab-dashboard \
  --set "image.tag=sha-${REV}" \
  --wait --timeout 5m

# Workloads: an overlay is a size, not an environment.
kubectl apply -k k8s/overlays/test -n ai-inference
bazelisk run //:manage -- status
```

`hosts.ini` is generated; regenerate it from `ansible/inventory/lab.yaml` with
`bazelisk run //:manage -- setup` rather than hand-editing it.

**stable** - the same chart, the same values, the tag the soak approved, and a name a human
can say:

```bash
# Record what the lab actually ran, then name that revision.
kubectl get deploy lab-dashboard -n dev -o jsonpath='{.spec.template.spec.containers[0].image}'
git tag -a vX.Y.Z -m "Release vX.Y.Z - <short description>"
git push origin vX.Y.Z

# Another lab, or this one next week, pins the same thing:
helm upgrade --install lab-dashboard helm/lab-dashboard \
  -n dev \
  -f helm/lab-dashboard/values.yaml \
  --set image.repository=ghcr.io/toxicoder/nvidia-dgx-spark-lab/lab-dashboard \
  --set "image.tag=vX.Y.Z" \
  --wait --timeout 5m

# Roll back by re-pointing at the previous name. No rebuild, no branch.
# Substitute the tag the last promotion recorded, from your own notes.
helm upgrade --install lab-dashboard helm/lab-dashboard \
  -n dev -f helm/lab-dashboard/values.yaml \
  --set image.repository=ghcr.io/toxicoder/nvidia-dgx-spark-lab/lab-dashboard \
  --set "image.tag=<previous-release-tag>" \
  --wait --timeout 5m
```

Heavy inference is not part of a promotion. `kubectl apply -k` brings a workload's shape
in; the Job still starts only when an operator says so through
`bazelisk run //:manage -- start-<model>`, past the Resource Guard's capacity check and
the heavy confirmation. See [Resource Guard](resource-guard.md).

## No deploy path may read a branch name

No manifest, values file, playbook, script, or workflow step that deploys anything may take
a branch name as the thing that selects code. The lever is an image tag or a digest, and
whoever promotes writes it down. A branch name in a deploy path is a defect, and it is the
defect this repository just spent a branch retirement fixing.

Why the GHCR tag that was derived from the git ref had to change:
`.github/workflows/publish-images.yml` tags each published image with the ref name, with
`sha-<short>`, and with `latest` on trunk. While `development` was the integration branch,
the first of those was the only stable name an operator could pin, so a branch name was
quietly doing the work of a release. That left promotion with nothing to pin: two environments
naming the same ref both followed whatever merged last, "promote" meant waiting to see, and
rollback meant rebuilding an older commit and hoping it reproduced. Under trunk-based
development the problem gets worse rather than better, because a branch name is now gone
within days and a tag derived from a ref that no longer exists is a label nobody owns.

So publishing keeps its shape and promotion stops depending on it: `.github/container-images.json`
names *what to build* and deliberately has no tag field, while the promotion above names
*what to run* as `sha-<short>` for the soak and a release tag for what is held. Run this to
catch the old habit coming back:

```bash
grep -rnE 'tag: *(main|development|dev)\b|image\.tag=(main|development|dev)\b' \
  helm/ ansible/ k8s/ scripts/ config/ mcp/
```

A hit is a deploy-path file naming a branch, and every hit is a defect to fix in that
file - comments count, because an operator copies comments. Two related limits are worth knowing before you trust a pin:

- `scripts/lib/monitoring.sh` pins `--set image.repository=lab-dashboard` and
  `--set image.tag=local`, which is the dev shape (build from the checkout). Use the
  `helm upgrade --install ... -f` form above when the artifact must be the published one.
- `helm/lab-dashboard/templates/deployment.yaml` builds the reference by joining repository
  and tag (`{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}`),
  with `appVersion: "1.0.0"` in `helm/lab-dashboard/Chart.yaml` as the fallback. A chart
  that concatenates the two cannot express an `@sha256:` digest, so today the lever is a
  tag. Digest pinning needs that template to accept a full reference first.

## Homes that do not exist yet

Stated as gaps, not papered over:

- **One value home for `lab`.** Six files hold it today. The destination is one values file
  per environment that composes them, not a copy of the tree.
- **A promoted-revision record.** Nothing in the repository says which tag or digest stable
  runs; an operator's notes are the record. A promoted revision should be written down
  where the next reader will find it.
- **Per-environment flag values.** `config/flags.yaml` supports
  `flags.<FLAG>.environments.<env>` in its precedence order and ships no `environments:`
  block, so every flag resolves to its `default` until an environment has a value home.
- **A digest lever in the chart.** See the template limit above.
- **A secret store per environment.** Secrets arrive through `*.example.yaml` templates, the
  dashboard vault, and the process environment. There is no per-environment secret backend,
  and no secret belongs in a values file. Policy and the vault contract are in
  [Secrets](operate/secrets.md).

## Safety impact

- Environment changes are values, so a promotion must not touch `restartPolicy`,
  `backoffLimit`, `NCCL_*` env, or `resources:`. Those stay in the workload manifests where
  `//tests:safety_invariants` can grep them.
- Nothing auto-starts on reboot in any environment, and no promotion may add an auto-start.
- Two environments on one host collide on NodePort today; a second lab needs its own host or
  a port registry change in the files named above.
- Resource Guard capacity gates and heavy-workload confirmations apply identically in every
  environment; they are never relaxed to make a deploy easier.

## See also

- [Branching and Trunk-Based Development](branching.md) - one trunk, and why environments are not branches
- [Overlays](operate/overlays.md) - the 14 overlay directories and what each points at
- [Secrets](operate/secrets.md) - templates, the dashboard vault, and what git must never contain
- [Ansible catalog](operate/ansible-catalog.md) - playbooks, roles, and the inventory source of truth
- [Resource Guard](resource-guard.md) - the capacity gate every start passes through
- [Project Conventions](project-conventions.md) - sources of truth and the safety invariants
- [Building with Bazel](BUILDING_WITH_BAZEL.md) - every entry point used above
- [Publishing workflow](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/.github/workflows/publish-images.yml) - the image build and its tags
