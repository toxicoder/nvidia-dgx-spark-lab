#!/usr/bin/env bash
#
# ## rebuild-cleanup — remove archive tags and transient rebuild branches
#
# Idempotent helpers used by rebuild-history.sh after rewriting main.

# @function cleanup_rebuild_refs
# Remove archive safety tags and transient rebuild branches (idempotent).
cleanup_rebuild_refs() {
  local tag
  while IFS= read -r tag; do
    [[ -n "$tag" ]] || continue
    git tag -d "$tag" 2>/dev/null || true
  done < <(git tag -l 'archive/pre-*' 2>/dev/null || true)
  git branch -D wip/integration rebuilt-main rebuild-temp 2>/dev/null || true
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  cleanup_rebuild_refs
fi