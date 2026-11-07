# carry tab completion (PowerShell)
Register-ArgumentCompleter -Native -CommandName carry, carry.cmd, carry.ps1 -ScriptBlock {
  param($word, $ast, $cursor)
  $w = @($ast.CommandElements | ForEach-Object { $_.ToString() })
  $i = if ($word) { $w.Count - 1 } else { $w.Count }
  $prev = if ($i -ge 1) { $w[$i - 1] } else { '' }
  $cmd = if ($w.Count -gt 1) { $w[1] } else { '' }
  $list = if ($i -eq 1) { 'setup', 'install-skill', 'list', 'name', 'share', 'projects', 'note', 'friend', 'friends', 'inbox', 'return', 'install-hook', 'sync', 'packs', 'open', 'mcp', 'update', 'doctor', 'completion' }
    elseif ($prev -eq '--to') { if ($cmd -eq 'open') { 'claude_code', 'claude_app', 'codex', 'codex_app', 'opencode', 'cursor', 'pi', 'chat', 'here' } else { carry __names friends 2>$null } }
    elseif ($prev -eq '--project') { carry __names projects 2>$null }
    elseif ($word -like '-*') { '--to', '--with', '--link', '--handoff', '--project', '--chats', '--add', '--skip', '--related', '--dir', '--auto-return', '--no-resume', '--web', '--as' }
    elseif ($i -eq 2 -and $cmd -in 'share', 'name', 'return') { carry __names chats 2>$null }
    elseif ($i -eq 2 -and $cmd -eq 'open') { carry __names packs 2>$null }
    elseif ($cmd -eq 'projects') { carry __names projects 2>$null }
    elseif ($i -eq 2 -and $cmd -eq 'friend') { 'add', 'remove' }
    elseif ($cmd -eq 'completion') { 'zsh', 'bash', 'powershell' }
  # Nothing to offer: return nothing, so PowerShell falls back to file names.
  @($list) | Where-Object { $_ -and $_ -like "$word*" } | ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
}
