# carry tab completion (bash)
_carry() {
  local cur=${COMP_WORDS[COMP_CWORD]} prev=${COMP_WORDS[COMP_CWORD-1]} cmd=${COMP_WORDS[1]} words=""
  local IFS=$'\n'
  if [ "$COMP_CWORD" -eq 1 ]; then
    words=$'setup\ninstall-skill\nlist\nname\nshare\nprojects\nnote\nfriend\nfriends\ninbox\nreturn\ninstall-hook\nsync\npacks\nopen\nmcp\nupdate\ndoctor\ncompletion'
  else
    case $prev in
      --to) if [ "$cmd" = open ]; then words=$'claude_code\nclaude_app\ncodex\ncodex_app\nopencode\ncursor\npi\nchat\nhere'
            else words=$(carry __names friends 2>/dev/null); fi ;;
      --project) words=$(carry __names projects 2>/dev/null) ;;
      --handoff|--dir) COMPREPLY=($(compgen -f -- "$cur")); return ;;
      *)
        if [[ $cur == -* ]]; then
          words=$'--to\n--with\n--link\n--handoff\n--project\n--chats\n--add\n--skip\n--related\n--dir\n--auto-return\n--no-resume\n--web\n--as'
        else
          case $cmd in
            share|name|return) [ "$COMP_CWORD" -eq 2 ] && words=$(carry __names chats 2>/dev/null) ;;
            open) [ "$COMP_CWORD" -eq 2 ] && words=$(carry __names packs 2>/dev/null) ;;
            projects) words=$(carry __names projects 2>/dev/null) ;;
            friend) [ "$COMP_CWORD" -eq 2 ] && words=$'add\nremove' ;;
            completion) words=$'zsh\nbash\npowershell' ;;
          esac
        fi ;;
    esac
  fi
  COMPREPLY=($(compgen -W "$words" -- "$cur"))
}
complete -o default -F _carry carry
