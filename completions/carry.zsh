# carry tab completion (zsh)
(( $+functions[compdef] )) || { autoload -Uz compinit && compinit }
_carry() {
  if (( CURRENT == 2 )); then
    compadd setup install-skill list name share projects note friend friends inbox return install-hook sync packs open mcp update doctor completion
    return
  fi
  case $words[CURRENT-1] in
    --to) if [[ $words[2] == open ]]; then compadd claude_code claude_app codex codex_app opencode cursor pi chat here
          else compadd -- ${(f)"$(carry __names friends 2>/dev/null)"}; fi; return ;;
    --project) compadd -- ${(f)"$(carry __names projects 2>/dev/null)"}; return ;;
    --handoff|--dir) _files; return ;;
  esac
  if [[ $words[CURRENT] == -* ]]; then
    compadd -- --to --with --link --handoff --project --chats --add --skip --related --dir --auto-return --no-resume --web --as
    return
  fi
  case $words[2] in
    share|name|return) (( CURRENT == 3 )) && compadd -- ${(f)"$(carry __names chats 2>/dev/null)"} ;;
    open) (( CURRENT == 3 )) && { compadd -- ${(f)"$(carry __names packs 2>/dev/null)"}; _files -g '*.carry' } ;;
    projects) compadd -- ${(f)"$(carry __names projects 2>/dev/null)"} ;;
    friend) (( CURRENT == 3 )) && compadd add remove ;;
    completion) compadd zsh bash powershell ;;
    setup) _files -/ ;;
  esac
}
compdef _carry carry
