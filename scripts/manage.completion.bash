# Bash completion for ./scripts/manage.sh (and manage.sh)
#
# ## manage.completion.bash
#
# Provides tab-completion for the main commands of the lab management script.
#
# Source it in your shell:
#   source scripts/manage.completion.bash
#
# Commands covered:
#   status, start-*, setup, urls, wait, stop-*, cleanup, doctor, help, estimate, etc.
#
# @file scripts/manage.completion.bash

_manage_complete() {
  local cur="${COMP_WORDS[COMP_CWORD]}"
  local cmds="status start-test start-kimi start-ray start-nemotron start-glm start-coder start-kasm start-monitoring start-default setup urls wait stop-coder stop-kasm stop-dev stop cleanup secrets doctor help"
  COMPREPLY=( $(compgen -W "$cmds" -- "$cur") )
}

complete -F _manage_complete ./scripts/manage.sh
complete -F _manage_complete manage.sh
