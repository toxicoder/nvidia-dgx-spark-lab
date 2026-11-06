---
title: Strong Types
description: How every language in this repository declares its data shapes, which gates enforce it, and what to do when a broad type looks unavoidable.
tags: [conventions, typescript, python, shell, safety, contributing]
---

# Strong Types

**What's on this page**

- The rule this repository holds itself to, and why it is a safety rule here
- The instrument and the enforcing gate for each language: TypeScript, Python, Shell, BATS, data files
- Patterns for the places a broad type looks unavoidable
- How to add a type, and how to add a gate

**What this enables**

- A renamed or missing key in a utility's JSON fails at the edge, where it is named, instead of rendering a wrong capacity verdict later
- `//:validate` catches a shape error, so a reviewer does not have to hold every payload in their head
- New code arrives with its shape already declared, which makes the next change smaller

## The rule

Declare the shape. A name like `Any`, `object`, `dict`, or `Record<string, unknown>` says the author stopped looking. Where a shape genuinely is unknown, say so in a comment next to the narrowest type that still compiles, and record why at the gate's config rather than in an inline suppression.

This is a safety rule in this repository specifically because the Resource Guard reads a JSON verdict produced by a shell utility, and that verdict gates heavy GPU workload starts. Before the boundary parser existed, the dashboard wrote `JSON.parse(stdout) as CapacityCheck`; a renamed key in `scripts/utilities/cluster-resources.sh` would have produced `{ ok: undefined }`, and an unblocked start is the kind of failure nothing logs.

## Per language

| Language | Instrument | Gate |
| --- | --- | --- |
| TypeScript | `strict` plus the flags below, type-aware ESLint, `as const` source-of-truth arrays, zod at every boundary | `//dashboard:typecheck`, `//dashboard:lint`, `//docs-site:typecheck`, `//docs-site:lint` |
| Python | Full annotations, `TypedDict`, `StrEnum`, `Final`, type aliases, `NoReturn` | `//lints:mypy` (`mypy.ini`, `disallow_any_explicit`) |
| Shell | `scripts/lib/types.sh` value-kind contracts (`is_*` / `require_*`) | `//tests:bats_value_types_test` |
| BATS | Contract tests that check each predicate both ways | `//tests:bats` |
| Data files | `tests/config_twin_check.py` compares each `.yaml`/`.json` twin | `//tests:safety_invariants` |

## TypeScript

Both Node apps (`dashboard/`, `docs-site/`) set `strict` and add the flags that catch the cases `strict` leaves open:

| Flag | What it catches |
| --- | --- |
| `noUncheckedIndexedAccess` | Reading `arr[0]` or `map[k]` without handling a miss |
| `exactOptionalPropertyTypes` | Writing `{ description: undefined }` where the prop is simply absent |
| `noImplicitOverride` | A subclass method that silently stopped matching its base |
| `noImplicitReturns`, `noFallthroughCasesInSwitch` | A path that returns nothing; a `case` that runs into the next |
| `noUnusedLocals`, `noUnusedParameters` | Dead bindings (prefix an intentional unused parameter with `_`) |
| `useUnknownInCatchVariables` | Treating an unknown thrown value as an `Error` |
| `strictBuiltinIteratorReturn`, `alwaysStrict`, `forceConsistentCasingInFileNames` | Iterator variance, sloppy-mode drift, case-only path mismatches |

`noPropertyAccessFromIndexSignature` is deliberately `false` in `dashboard/tsconfig.json`: measured on this tree it flagged 232 sites where the code is correct, which would have trained everyone to ignore the gate. Two flags are also left off in `dashboard/eslint.config.mjs`, each with its reason written in the file header.

### Closed sets live in one place

`dashboard/lib/types/index.ts` declares each closed set once as an `as const` array, and everything else derives from it:

```ts
export const CAPACITY_VERDICTS = ["ok", "insufficient_gpu", /* ... */] as const;
export type CapacityVerdict = (typeof CAPACITY_VERDICTS)[number];
export const CapacityVerdictSchema = z.enum(CAPACITY_VERDICTS);
```

The type, the runtime allowlist, and the parser cannot drift apart, which is how `InferenceModelName` and `NemotronStackId` used to work: each was a hand-listed union mirroring a hand-listed `z.enum([...])` in `lib/validation.ts`.

### Validate at the boundary, not at the call site

`dashboard/lib/services/cli-json.ts` is where utility stdout becomes a domain object. A parse failure throws `CliPayloadError` naming the utility and the field. The services that read the Resource Guard verdict go through it, so a broken payload reaches the existing error paths (`verdict: "error"`, an empty suggestion list) instead of reaching a renderer.

Schemas are written so the inferred type *is* the domain type: no `as` casts, no `.passthrough()`. If a schema needs a cast to satisfy the compiler, the schema is wrong.

Broad types are banned outright by the type-aware ESLint rules `no-explicit-any` and the `no-unsafe-*` family. Those rules need the TypeScript program, which is what `languageOptions.parserOptions.projectService` provides; without it they silently cannot run.

### Indexing is an assertion, not a guess

`noUncheckedIndexedAccess` makes `rows[0]` and `map["k"]` possibly `undefined`. A test that writes `rows[0].name` now fails to compile, and the tempting fix (`rows[0]!`) keeps the vacuous pass: an empty array would sail through and fail three property reads later with a message nobody can act on. Tests use the total accessors in `dashboard/lib/__tests__/test-assert.ts` instead:

```ts
const firstRow = itemAt(rows, 0);   // throws naming the index and the length
const ultra = keyIn(catalog.models, "nemotron-3-ultra");
```

Production code reaches for the same idea directly (`if (!x) return early`), since a dashboard has no business throwing on a missing row.

## Python

`mypy.ini` runs `strict` plus `disallow_any_explicit`, `disallow_any_generics`, and `disallow_subclassing_any`. `disallow_any_explicit` is the one that matters: it is not in `strict`, and it is what makes "no `Any`" a build failure rather than a review convention. `warn_unreachable`, `strict_equality`, and `extra_checks` treat dead code and impossible comparisons as defects, and `enable_error_code = ignore-without-code, redundant-cast, unused-ignore` means a suppression must name what it suppresses and cannot go stale.

There are no per-module `disallow_any_explicit = False` exemptions. Adding one needs a written reason in `mypy.ini`.

### Shared vocabulary

`scripts/lib/py/lab_types.py` holds the capacity vocabulary the Resource Guard and the dashboard agree on: `CapacityVerdict` (a `StrEnum`), and `TypedDict`s for `ResourceAmount`, `ModelSpec`, `StackSpec`, `ResourcePolicy`, `CapacityCheck`, and friends. A module that needs a shape not in there declares it file-local, and a reviewer decides whether it belongs in the shared module.

Prefer, in this order:

1. a `TypedDict` when the code reads a known set of keys;
2. `dict[str, object]` when a value is genuinely opaque and only re-serialised, with a comment saying so;
3. a recursive `TypeAlias` (`JsonValue` in `tests/config_twin_check.py`) when walking arbitrary JSON.

Bare `dict`, `list`, `tuple`, and `set` are generics with the parameter left off, and mypy rejects them under `disallow_any_generics`.

### Two small rules that matter

At an untyped boundary (`json.loads`, `yaml.safe_load`, a stubless SDK), prefer `typing.cast` to a named `TypedDict` over an `isinstance` filter when the filter would substitute an empty value on malformed input. A cast is a runtime no-op, so it cannot change behaviour; a filter can. Where both are honest, validate.

To assert a value is present and narrow it, return `NoReturn` from the failure helper rather than using `assert`:

```python
def _reject(verdict: CapacityVerdict, action: str) -> NoReturn: ...

if not stack:
    _reject(CapacityVerdict.UNKNOWN_STACK, action)
# stack is narrowed here, and the check survives `python -O`, which strips asserts.
```

## Shell

Bash has no type system, so `scripts/lib/types.sh` supplies the equivalent: predicate functions that answer a value-kind question, and `require_*` functions that validate a parameter and abort with a diagnostic.

```bash
source "${SCRIPT_DIR}/../lib/types.sh"
require_port "$PORT" "PORT" || return 1
require_k8s_quantity "$MEMORY" "memory" || return 1
```

The contract every function in that file keeps:

- a predicate returns `0` or `1` and never calls `exit`;
- a failure writes exactly one diagnostic to **stderr** naming the parameter, so a utility's stdout stays clean for `$(...)` capture;
- the library carries no `set -euo pipefail`, because it inherits the caller's options;
- every function has a `# @function` tag and `# @param` lines.

Predicates come in signed and unsigned pairs (`is_integer` / `is_unsigned_integer`, `is_number` / `is_unsigned_number`) because counters and telemetry readbacks are non-negative, and accepting a leading `-` there turns a parse glitch into a negative number rather than a rejection.

A utility that installs itself outside the repo, such as `spark-clock.sh`, which the systemd unit execs from `/usr/local/bin` where there is no `../lib` sibling, stays self-contained on purpose. `//tests:bats_tooling_test` holds that boundary with a guard test. Repo-bound utilities source the library unconditionally, so a missing file fails loudly at source time rather than running with the predicates undefined.

## Data files

Several configs ship as a `.yaml` plus a `.json` twin, and the readers load the JSON. That makes a half-finished edit silent rather than loud. `tests/config_twin_check.py` parses both sides and reports the first path where they disagree:

```console
$ python3 tests/config_twin_check.py
config_twin_check: 3 twin pair(s) agree

$ python3 tests/config_twin_check.py /tmp/lab-with-a-stale-twin
config_twin_check: config/resource-policy.headroom.memory_min_per_node: YAML '30Gi', JSON '24Gi'
  (resource_policy.py is handed the JSON, so a stale twin gates starts on old policy)
```

It runs inside `//tests:safety_invariants`, so drift fails the fast CI lane.

## When a broad type really is right

Some values have no shape worth declaring: a Kubernetes `status` blob that the code only re-serialises, an arbitrary key path from a policy file, a Prometheus sample that mixes a float and a string. Use `object` (or `unknown` in TypeScript), and write the reason in a comment on that line. What is not acceptable is the broad type as a default, chosen because declaring the shape was more work than the change was worth.

## Adding a type, adding a gate

**A new data shape.** Put it where its consumers can both see it: `dashboard/lib/types/index.ts` when TypeScript on both sides of a boundary needs it, `scripts/lib/py/lab_types.py` when Python does. If a set is closed, declare it once as an `as const` array (TypeScript) or a `StrEnum` (Python) and derive the rest.

**A new gate.** When a convention is easy to violate, encode it as a check rather than relying on reminder. One rule governs new gates, and it is the lesson of this repository's history: a gate that inspected nothing must not pass. `//lints:mypy` used to print `mypy: no tracked Python files` and `exit 0` because `git ls-files` fails in the Bazel runfiles sandbox, so the Python type gate had never once run; `//lints:yaml_format` resolved its repo root one directory too shallow, globbed zero files, and exited `0`. Both now treat an empty file list as a hard failure. If you add a check that can find nothing to check, make finding nothing an error.

## See also

- [Project Conventions](project-conventions.md) — the shared rules this page extends
- [Contributing to Docs](CONTRIBUTING.md) — how a page gets into the nav
- [Shell Commands & Helpers](generated/shell/reference.md) — the generated shell index
