---
title: Branching and Trunk-Based Development
description: One trunk, short-lived prefixed branches, the commit contract, unfinished work behind a declared flag, and the retirement record for development and dev.
tags: [contributing, git, branches, ci, flags, safety]
---

# Branching and Trunk-Based Development

**What's on this page**

- The branch model: one trunk, everything else short-lived
- Why `development` and `dev` are being retired, with their recovery SHAs
- Prefixes, lifetimes, and rebase rules for a branch you cut today
- The commit-summary contract that reviewers and the gates read
- How unfinished work ships on trunk behind a flag declared in `config/flags.yaml`

**What this enables**

- One place to answer "is this released": the tip of `main`
- A reviewer diffs a PR against the trunk they already know, not against a second integration branch
- Unfinished code stops hiding in a long-lived branch and becomes a small, off-by-default, reviewable delta
- Rollback is a revision, so a bad merge never blocks the next good one

## The model

`main` is the only long-lived branch in this repository. It is trunk, it is the
default branch on the remote (`origin/HEAD` -> `refs/remotes/origin/main`), and it
is the branch every pull request targets. Everything else is short-lived.

| Kind | Lifetime | Who writes to it | How it moves |
| --- | --- | --- | --- |
| `main` (trunk) | permanent | nobody directly | pull request only, linear history |
| a prefixed branch | days | you, alone | rebase on trunk, delete on merge |
| an `archive/*` ref | until the maintainer says otherwise | nobody | cut once, then never moved |

There is no integration branch between your branch and trunk. `development` used to
play that role; it now holds content that trunk has not been given yet, and the next
section says how that gets resolved.

## Why one trunk

Two long-lived branches meant every change was reviewed twice or not at all: a PR into
`development` was reviewed, and the promotion PR into `main` was a bulk commit
(`chore: promote development to main`) that nobody re-read. The gate that mattered,
`bazelisk run //:validate -- --all`, therefore ran its most important pass on code
that had already been merged.

Keeping a second branch also cost real correctness. Between the two tips, `main` was
last written on 2026-09-13 while `development` moved on, and the retired Material for
MkDocs scaffolding (`mkdocs.yml`, `docs/hooks.py`, the `docs/test_mkdocs_*` gates,
`docs/assets/**`) survived on `main` long after `development` deleted it. A stale
branch is not a safe branch; it is a second tree that stopped being checked.

One trunk keeps the only sequence of revisions that CI, the operator, and the published
images all agree on.

## Short-lived branches

Cut from the tip of trunk before the first edit, so the branch never carries a merge
commit of work it did not do:

```bash
git switch main
git pull --ff-only
git switch -c feat/flags-registry-docs
```

Prefixes are the whole vocabulary. Pick the one that matches the change:

| Prefix | For |
| --- | --- |
| `feat/` | new behaviour an operator can use |
| `fix/` | a defect, including one found in review |
| `refactor/` | no behaviour change |
| `docs/` | prose only (`docs/`, `README.md`, comments that feed generated reference) |
| `chore/` | tooling, config, dependency and CI-adjacent work with no behaviour change |
| `ci/` | `.github/workflows/**`, `.gitea/workflows/**`, gate wiring |
| `test/` | tests only, or tests that fail before the fix lands |
| `perf/` | a measured speed or memory win, with the measurement in the PR |
| `build/` | Bazel rules, toolchains, `BUILD.bazel`, container builds |

Keep the description short, kebab-case, and meaningful; a ticket number alone is not a
description (`fix/312` tells a reader nothing a month later). The older `feature/` and
`hotfix/` spellings fold into `feat/` and `fix/`: an urgent fix is the same shape of
branch, expedited in review rather than branched from somewhere else.

Rules that keep a branch short:

1. **Merge by pull request within days.** A branch that outlives its week is a branch
   that should have been split, or work that should have been flagged off.
2. **Delete on merge.** The remote should hold trunk plus the branches someone is
   actively pushing.
3. **Rebase your own branch when trunk moves**, and force-push only your own branch.
   Never rebase or force-push a branch someone else may have pulled; add a commit
   instead.
4. **Never rebase or force-push trunk.** Protected branches keep linear history
   through rebase or squash at merge time, not afterwards.
5. **One logical change per branch.** Independent reviewable units are independent
   branches, cut from the same trunk tip.

## Commit summaries

Write them for the next reader, in the imperative, at 72 characters or fewer, with a
conventional prefix:

```text
fix: refuse a visual start while an inference Job holds the GPU
```

**Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `build`. The
summary says what; the body says *why* when it is not obvious, wrapped at 72 to 80
characters. A footer may link an issue. Keep secrets, tokens, dumps, hostnames from an
inventory, and `WIP` out of final messages.

## Unfinished work ships behind a flag

Unfinished work belongs on trunk, not on a branch that waits for it to be finished. The
mechanism is a flag that defaults off, declared in `config/flags.yaml` and gated by
`bazelisk test //tests:flags_registry` - one checked-in registry so a reviewer sees the
whole flag surface in one read and retiring a switch is one edit and a grep.

| Kind | Contract the gate enforces |
| --- | --- |
| `feature` | gates unfinished work; must default off; exactly one reader |
| `capability` | a shipped control or component; may default on, with a `reason`; one reader |
| `harness` | a dev or test switch; must default off, name its production `guard`, and may be read from up to three files when one guard expression tests several |

The registry as it stands:

| Flag | Kind | Default | Reader | Guard |
| --- | --- | --- | --- | --- |
| `SSO_ENABLED` | capability | true | `scripts/lib/sso.sh` | n/a (a control that must stay on) |
| `CONTEXT7_ENABLED` | capability | true | `mcp/k8s/workloads/context7-proxy/server.py` | n/a |
| `AUTH_BYPASS` | harness | false | `dashboard/lib/require-session.ts`, `dashboard/middleware.ts` | `dashboard/lib/env-guards.ts` |
| `USE_MOCKS` | harness | false | `dashboard/lib/require-session.ts`, `dashboard/middleware.ts` | `dashboard/lib/env-guards.ts` |

Both harness flags are forbidden in production; the guard file is what refuses them. The
two capabilities default on because they are deployed controls, so the gate demands a
`reason` instead of a false default.

Precedence, highest first: the process environment, then `flags.<FLAG>.environments.<env>`,
then `flags.<FLAG>.default`. The `environments:` layer is deliberately absent from
`config/flags.yaml` today, so every flag resolves to `default`; it appears when an
environment has a value home of its own, which is the gap
[Environments](environments.md) names.

A flag is not a feature toggle for traffic. It gates code that is not finished, and it
carries an `owner` and an `expires` note so a reviewer can ask when it dies.

## The gate before a merge

Bazel is the only entry point, and the local gate mirrors CI:

```bash
bazelisk run //:validate            # path-aware: the slices your diff touches, same filters as CI
bazelisk run //:validate -- --all   # before merge, and after any broad refactor
```

| Target | Holds |
| --- | --- |
| `//:test-fast` | the CI core: safety invariants, BATS, docs render |
| `//:test` | every fast hermetic test |
| `//:verify` | every fast hermetic gate in one command |
| `//:lint` | the lint suite (run with `--test_tag_filters=manual`) |

`//tests:safety_invariants` and `//tests:flags_registry` are part of that contract and
are never skipped to go faster. See
[Building with Bazel](BUILDING_WITH_BAZEL.md) for the full target map.

## Retirement note

Labelled record for the branches this model retires. Keep the recovery refs until the
maintainer confirms the promotion; deleting a branch is cheap to undo only while a ref
names its tip.

| Branch | Tip | Last written | Status |
| --- | --- | --- | --- |
| `main` | `02dc3f330391e6e17884584232a94897d8968110` | 2026-09-13 | trunk |
| `development` | `7867ee87ea62c747656785f500f93c211cd465f3` | 2026-11-10 | frozen; delete once its content is promoted to `main` |
| `dev` | `1b4bcbefba62a5e860b7044dec0b49d518249b8b` | 2026-07-20 | abandoned intermediate promotion gate; delete |

`development` holds 159 commits `main` does not, and the content delta is small enough to
review in one pass: `git diff --diff-filter=D --name-only origin/main origin/development`
returns 14 files, all of them retired Material-for-MkDocs scaffolding (`mkdocs.yml`,
`docs/hooks.py`, `docs/test_hooks.py`, the `docs/test_mkdocs_*` gates,
`docs/assets/**`, `docs/includes/cluster-config.md`) plus three prose pages that already
have `.mdx` twins on `development` (`docs/getting-started.md`,
`docs/concepts/interconnect-nccl.md`, `docs/start/choose-topology.md`). So `main` carries
no unique shipped work: it is a stale promotion target, not a source of truth.

Before either branch is deleted, pin its tip with an `archive/*` tag so a rescue branch is
one command away:

```bash
git tag -a archive/development-2026-11 7867ee87ea62c747656785f500f93c211cd465f3 \
  -m "Retired integration branch: development"
git push origin archive/development-2026-11

# To work from the retired tip again:
git switch -c rescue/development 7867ee87ea62c747656785f500f93c211cd465f3
```

Use the same `git switch -c` shape with the `dev` tip if that gate is ever needed. After
promotion, automation and dependabot stop targeting `development`: any workflow trigger,
bot configuration, or documented command that still names a retired branch is a defect,
not a compatibility shim.

## What did not change

- **Safety invariants are untouched.** `restartPolicy` on inference Jobs stays `OnFailure`
  or `Never`, heavy Jobs keep a low `backoffLimit`, multi-node work keep their high-speed
  `NCCL_*` env, and nothing starts on reboot. See
  [Reboot safety](reboot-safety.md) and [Resource Guard](resource-guard.md).
- **No direct pushes to trunk.** Every change still arrives by pull request.
- **Environments are still not branches.** One trunk removed the integration branch; it did
  not create environment branches. The rule and the real value homes are in
  [Environments](environments.md).

## See also

- [Environments](environments.md) - values, secrets, and a location; never a branch
- [Project Conventions](project-conventions.md) - the shared rules this page sits in
- [Strong Types](strong-types.md) - the sibling rule for data shapes
- [Contributing to Docs](CONTRIBUTING.md) - how a page gets into the nav
- [Building with Bazel](BUILDING_WITH_BAZEL.md) - the gates above, in full
- [Shell Commands & Helpers](generated/shell/reference.md) - the generated operator CLI index
- [CONTRIBUTING.md (repo root)](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/CONTRIBUTING.md) - the contribution hub
- [SECURITY.md](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/SECURITY.md) - what no branch may contain
