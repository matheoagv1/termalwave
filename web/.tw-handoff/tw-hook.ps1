# Hooks de Claude Code para el hub tw. Reemplaza al vigilante externo.
#   tw-hook.ps1 stop    -> evento Stop: si el hub tiene trabajo NUEVO, bloquea el cierre y el agente sigue solo.
#                          Si no hay nada, espera con poll dinamico (15/45/60/60 s) y recien despues deja parar.
#   tw-hook.ps1 context -> SessionStart / UserPromptSubmit: inyecta el estado del hub y marca presencia working.
# Falla abierto: si el VPS no responde, nunca traba la sesion.
param([Parameter(Mandatory)][ValidateSet("stop", "context")][string]$Mode)

$Role = "carne"
$SshHost = "agente-carne"
$Dir = "/srv/sites/nasaspaceappchallenge-carne/.tw"
$Waits = @(15, 45, 60, 60)     # segundos entre chequeos tras quedar sin pendientes
$MaxBlocksPerHour = 8          # tope de gasto: pasadas forzadas por hora
$state = Join-Path $env:LOCALAPPDATA "tw-hook-$Role.json"
$log = Join-Path $env:LOCALAPPDATA "tw-hook-$Role.log"

function Log($m) { "$(Get-Date -Format s) $m" | Add-Content $log -Encoding utf8; if ((Get-Item $log).Length -gt 100KB) { (Get-Content $log -Tail 100) | Set-Content $log -Encoding utf8 } }

# ssh con tope duro
function Tw($cmd, $sec = 20) {
  $j = Start-Job -ScriptBlock { param($h, $c) ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=2 $h $c 2>$null | Out-String } -ArgumentList $SshHost, $cmd
  if (Wait-Job $j -Timeout $sec) { $r = Receive-Job $j; Remove-Job $j -Force; return "$r".Trim() }
  Stop-Job $j; Remove-Job $j -Force; return ""
}
function Pulse { Tw "tw --dir $Dir pulse" }
function Sig($p) { if ($p -match "tasks \d+ \| inbox \d+ \| wakes \d+") { $Matches[0] } else { "" } }
# el vigilante (tw-live) ya atiende los mensajes sueltos; el hook solo fuerza seguir por wakes o tareas asignadas
function Pending($p) { $p -match "wakes [1-9]" }
function LoadState { try { Get-Content $state -Raw | ConvertFrom-Json } catch { $null } }
function SaveState($sig, $times) { @{ sig = $sig; blocks = @($times) } | ConvertTo-Json | Set-Content $state -Encoding utf8 }

$inputJson = $null
try { $inputJson = [Console]::In.ReadToEnd() | ConvertFrom-Json } catch {}

if ($Mode -eq "context") {
  $p = Pulse
  if (-not $p) { exit 0 }
  $null = Tw "tw --dir $Dir presence working" 8
  $ctx = "Estado del hub tw (rol $Role): $p. Si hay inbox o wakes, atendelos en tu zona y avisa con tw notify (START/LEAVE/PENDING/HANDOFF)."
  # el agente debe enterarse si el vigilante local no corre
  $liveUp = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*tw-live*' }).Count -gt 0
  if (-not $liveUp) {
    try { Start-ScheduledTask -TaskName "tw-live-$Role" -ErrorAction Stop; $ctx += " ALERTA: el vigilante local (tw-live) NO estaba corriendo; lo relance con la tarea tw-live-$Role. Revisa %LOCALAPPDATA%\tw-live-run-$Role.log y avisa al humano si vuelve a caer." } catch { $ctx += " ALERTA: el vigilante local (tw-live) NO esta corriendo y no pude relanzarlo ($($_.Exception.Message)). Avisa al humano." }
  }
  @{ hookSpecificOutput = @{ hookEventName = $(if ($inputJson.hook_event_name) { $inputJson.hook_event_name } else { "UserPromptSubmit" }); additionalContext = $ctx } } | ConvertTo-Json -Compress -Depth 4
  exit 0
}

# --- stop ---
$st = LoadState
$lastSig = if ($st) { [string]$st.sig } else { "" }
if ($env:TW_PASS -eq "1") { exit 0 }   # pasada lanzada por tw-live: no encadenar esperas
$recent = @()
if ($st -and $st.blocks) { $recent = @($st.blocks | Where-Object { ([DateTime]$_) -gt (Get-Date).AddHours(-1) }) }
if ($recent.Count -ge $MaxBlocksPerHour) { Log "tope por hora ($MaxBlocksPerHour): dejo parar"; exit 0 }

$null = Tw "tw --dir $Dir presence waiting" 8
for ($i = 0; $i -le $Waits.Count; $i++) {
  $p = Pulse
  $sig = Sig $p
  if ($p -and (Pending $p) -and $sig -ne $lastSig) {
    $recent += (Get-Date).ToString("o")
    SaveState $sig $recent
    Log "pendiente nuevo ($sig): bloqueo el cierre"
    $null = Tw "tw --dir $Dir presence working" 8
    $reason = "Hay trabajo nuevo en el hub tw ($sig). Atendelo ahora: tw pulse, inbox_fetch y tasks_list; trabaja solo en tu zona (web/src salvo scene/search y context); responde con tw notify (--re ID) y archiva lo atendido; marca START/LEAVE/PENDING. Respuestas cortas, poco uso de IA. Cuando termines, podes parar."
    @{ decision = "block"; reason = $reason } | ConvertTo-Json -Compress
    exit 0
  }
  if (-not $p) { Log "hub sin respuesta, dejo parar"; exit 0 }
  if ($i -lt $Waits.Count) { Start-Sleep $Waits[$i] }
}
SaveState $lastSig $recent
Log "sin novedades tras $($Waits.Count + 1) chequeos, dejo parar"
exit 0
