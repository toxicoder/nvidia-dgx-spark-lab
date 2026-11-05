#!/usr/bin/env bash
#
# npm-install-lock.sh
# Serialize the docs-site npm install across the Bazel targets that share one package tree.
#
# `//:test-fast` runs `//docs-site:unit` and `//docs:test_command_vars` in parallel, and both
# have to run Vitest out of the *physical* docs-site directory: Vite resolves a module to its
# real path before serving it, so a suite run from the runfiles symlink tree loads React,
# vitest and vitest.setup.ts twice and jest-dom's matchers land on a different `expect` than
# the specs use. One shared directory means one shared `node_modules`, and two first-run
# `npm ci` calls in it race each other (`npm error ENOTEMPTY: directory not empty, rmdir
# node_modules/...`, as seen on the CI runner).
#
# This file is sourced, never executed. Take the lock with `npm_install_lock <package-dir>`
# and hold it for the rest of the process: it sits on descriptor 9, which the exec'd npm or
# vitest inherits, so a waiting peer cannot delete `node_modules` mid-suite.
#
# Usage:
#   source "./scripts/npm-install-lock.sh"
#   npm_install_lock "$PWD"
#   npm ci --legacy-peer-deps

# @function npm_install_lock
# Take the exclusive install lock for one docs-site package directory.
# The lock is never released by hand: it drops when descriptor 9 closes with the process,
# which is exactly the lifetime a suite needs.
# @param $1  Absolute path of the docs-site package directory.
npm_install_lock() {
  local pkg_dir="${1:?npm_install_lock: package directory required}"
  local lock_id lock_file

  lock_id="$(printf '%s' "$pkg_dir" | tr -c '[:alnum:]' '_')"
  # /tmp is deliberate. Bazel gives every test action its own TMPDIR/TEST_TMPDIR, and a lock
  # file living there would not be the same file for the two processes that must exclude
  # each other. The name is derived from the package path so distinct checkouts do not queue
  # behind one another.
  lock_file="/tmp/docs-site-npm-${lock_id}.lock"

  if ! command -v flock >/dev/null 2>&1; then
    # No flock(1) on a macOS dev host. The lock exists for parallel Bazel test actions; a
    # developer running one target at a time cannot hit the race it prevents.
    return 0
  fi

  exec 9>"$lock_file" || return 0
  flock 9
}
