# Vigilante VISIBLE de esta PC: pulsa al hub, escucha wakes/inbox y lanza pasadas de Claude Code mostrando la salida.
# Se ejecuta en una ventana de terminal normal (no oculta) para poder monitorearlo.
#   tw-live.ps1 -Role carne -SshHost agente-carne -Dir /srv/sites/nasaspaceappchallenge-carne/.tw -Workdir "C:\ruta"
# - cada ciclo hace UNA consulta ssh: `tw watcher ping` (pulso de vida) + `tw pulse` (estado). Ciclo 5 s con actividad, 15 s en reposo.
# - WAKE => pasada ya (tope WakeGapMin). Mensajes sin wake => juntar CoalesceSec y pasada (tope MinGapMin).
# - mientras corre una pasada SIGUE pulsando (la pasada va en un job y se muestra en vivo).
# - solo dispara si la firma tasks|inbox|wakes cambio desde la ultima pasada.
param(
  [Parameter(Mandatory)][string]$Role,
  [Parameter(Mandatory)][string]$SshHost,
  [Parameter(Mandatory)][string]$Dir,
  [Parameter(Mandatory)][string]$Workdir,
  [ValidateSet("claude", "codex")][string]$Launcher = "claude",
  [int]$MinGapMin = 10, [int]$WakeGapMin = 2, [int]$CoalesceSec = 10, [int]$MaxTurns = 40
)
$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "VIGILANTE $Role (tw-live) - no cerrar"
$mutex = New-Object Threading.Mutex($false, "Global\tw-live-$Role")
if (-not $mutex.WaitOne(0)) { Write-Host "ya hay un vigilante $Role corriendo"; Start-Sleep 5; exit 0 }
$logf = Join-Path $env:LOCALAPPDATA "tw-live-$Role.log"
function Say($m, $c = "Gray") { $l = "$(Get-Date -Format HH:mm:ss) $m"; Write-Host $l -ForegroundColor $c; "$(Get-Date -Format s) $m" | Add-Content $logf -Encoding utf8; if ((Get-Item $logf).Length -gt 200KB) { (Get-Content $logf -Tail 300) | Set-Content $logf -Encoding utf8 } }

function Find-Claude {
  $c = Get-ChildItem (Join-Path $env:LOCALAPPDATA "Claude-Data") -Recurse -Filter claude.exe -ErrorAction SilentlyContinue | Sort-Object FullName
  if ($c) { return $c[-1].FullName }; $g = Get-Command claude -ErrorAction SilentlyContinue; if ($g) { return $g.Source }; return $null
}
# ssh con tope duro; devuelve la salida o "" si falla
function Tw($cmd, $sec = 25) {
  $j = Start-Job -ScriptBlock { param($h, $c) ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=2 $h $c 2>$null | Out-String } -ArgumentList $SshHost, $cmd
  if (Wait-Job $j -Timeout $sec) { $r = Receive-Job $j; Remove-Job $j -Force; return "$r".Trim() }
  Stop-Job $j; Remove-Job $j -Force; return ""
}
# firma = conteos + checksum de los ids del inbox: un mensaje sustituido con igual conteo tambien cuenta como nuevo
function Sig($p) {
  if ($p -notmatch "tasks \d+ \| inbox \d+ \| wakes \d+") { return "" }
  $s = $Matches[0]; if ($p -match "(?m)^ck=(\d+)") { $s += " #" + $Matches[1] }; return $s
}
# un ciclo: pulso de vida + estado + checksum de ids del inbox
function Beat { Tw "tw --dir $Dir watcher ping; tw --dir $Dir pulse; echo ck=`$(tw --dir $Dir inbox --limit 50 2>/dev/null | cut -d' ' -f1 | cksum | cut -d' ' -f1)" }

$prompt = @"
Sos el agente $Role del proyecto TermalWave (PC Carne). Te desperto el hub tw. 1) tw pulse; 2) si hay wakes, atendelos; si hay inbox, inbox_fetch y tasks_list; trabaja solo en tu zona (web/src salvo scene/search y context); 3) responde con tw notify --re ID, archiva lo atendido y marca START/LEAVE/PENDING/HANDOFF; 4) trabaja de forma agentica: si hay tareas grandes o independientes, delegalas a subagentes (herramienta Agent) y vos coordina, verifica y commitea; 5) NUNCA quedes freezado: si necesitas algo de otro agente, pedilo YA con tw notify --wake al dueño (que necesitas, para que tarea, que haces mientras tanto) y pasa a la siguiente tarea; 6) cuando no quede nada nuevo, termina. Respuestas cortas, poco uso de IA.
"@

# muestra en vivo lo que hace la pasada (stream-json de Claude Code)
function Show-Line($line) {
  try { $o = $line | ConvertFrom-Json -ErrorAction Stop } catch { if ($line.Trim()) { Write-Host "  $line" -ForegroundColor DarkGray }; return }
  if ($o.type -eq "assistant") {
    foreach ($b in $o.message.content) {
      if ($b.type -eq "text" -and $b.text) { Write-Host ("  claude> " + $b.text.Trim()) -ForegroundColor Cyan }
      elseif ($b.type -eq "tool_use") { $d = ($b.input | ConvertTo-Json -Compress -Depth 3); if ($d.Length -gt 110) { $d = $d.Substring(0, 110) + "..." }; Write-Host "  [tool] $($b.name) $d" -ForegroundColor DarkYellow }
    }
  } elseif ($o.type -eq "result") { Write-Host ("  == fin de pasada: " + $o.subtype + " (" + [int]($o.duration_ms / 1000) + " s)") -ForegroundColor Green }
}

Say "VIGILANTE $Role en marcha. Cada ciclo: pulso + estado. Ctrl+C para detener." "Green"
if ($Launcher -eq "claude") { $exe = Find-Claude } else { $g = Get-Command codex -ErrorAction SilentlyContinue; $exe = if ($g) { $g.Source } else { $null } }
if (-not $exe) { Say "NO encuentro el cliente ${Launcher}. Las pasadas no van a lanzar, los pulsos si." "Red" }
$lastSig = ""; $lastLaunch = [DateTime]::MinValue; $lastActive = Get-Date; $coalesceAt = $null
$job = $null; $fails = 0; $beats = 0

while ($true) {
  $p = Beat
  if ($p -match "inbox \d+") {
    if ($fails -gt 0) { Say "hub de vuelta tras $fails ciclos sin respuesta" "Green" }; $fails = 0; $beats++
    $sig = Sig $p; $isWake = $p -notmatch "wakes 0"; $pending = ($p -match "inbox [1-9]") -or $isWake
    if (-not $job -and ($beats % 4 -eq 1)) { Say ("pulso ok | " + (($p -split '\|')[0..3] -join '|')) "DarkGreen" }
    # firma nueva con pendientes => programar pasada
    if (-not $job -and $pending -and $sig -ne $lastSig) {
      if ($isWake) { $gap = $WakeGapMin; $go = $true }
      else { $gap = $MinGapMin; if (-not $coalesceAt) { $coalesceAt = (Get-Date).AddSeconds($CoalesceSec); Say "mensaje nuevo ($sig): junto ${CoalesceSec}s antes de actuar" "Yellow" }; $go = (Get-Date) -ge $coalesceAt }
      if ($go -and ((Get-Date) -ge $lastLaunch.AddMinutes($gap))) {
        $coalesceAt = $null; $lastLaunch = Get-Date; $lastActive = Get-Date
        $null = Tw "tw --dir $Dir presence working" 10
        Say ("PASADA ({0}): {1}" -f $(if ($isWake) { "WAKE" } else { "inbox" }), $sig) "Magenta"
        if ($exe) {
          $job = Start-Job -ScriptBlock {
            param($exe, $wd, $prompt, $turns, $launcher)
            Set-Location $wd; $env:TW_PASS = "1"
            if ($launcher -eq "claude") {
              & $exe -p $prompt --continue --max-turns $turns --permission-mode acceptEdits --allowedTools "PowerShell" "Read" "Edit" "Write" "Grep" "Glob" "Agent" "mcp__tw" --output-format stream-json --verbose 2>&1
            } else {
              & $exe exec resume --last $prompt 2>&1
            }
          } -ArgumentList $exe, $Workdir, $prompt, $MaxTurns, $Launcher
        } else { $lastSig = $sig }
      }
    } elseif (-not $pending) { $coalesceAt = $null }
  } else {
    $fails++; if ($fails -in 1, 6, 24) { Say "hub sin respuesta ($fails ciclos seguidos)" "Red" }
  }
  # volcar en vivo la salida de la pasada y detectar su fin
  if ($job) {
    foreach ($l in @(Receive-Job $job)) { Show-Line "$l" }
    if ($job.State -ne "Running") {
      foreach ($l in @(Receive-Job $job)) { Show-Line "$l" }
      Remove-Job $job -Force; $job = $null
      $null = Tw "tw --dir $Dir presence waiting" 10
      $lastSig = Sig (Beat); Say "pasada terminada; firma $lastSig" "Magenta"
    }
  }
  $act = ((Get-Date) - $lastActive).TotalSeconds -lt 120 -or $job
  Start-Sleep $(if ($act) { 5 } else { 15 })
}
