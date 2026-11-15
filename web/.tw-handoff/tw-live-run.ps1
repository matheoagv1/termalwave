# Supervisor del vigilante visible. Lo lanza la tarea de inicio de sesion (ventana normal, no oculta).
# - valida la sintaxis de tw-live.ps1 antes de correrlo; si esta roto usa la ultima copia buena (tw-live.good.ps1)
# - si el vigilante termina o falla, AVISA al hub (tw notify al Master) y lo reinicia con espera creciente
# - una corrida estable (>120 s) se guarda como "buena"
param(
  [string]$Role = "carne",
  [string]$SshHost = "agente-carne",
  [string]$Dir = "/srv/sites/nasaspaceappchallenge-carne/.tw",
  [string]$Workdir = "C:\Users\HP\Desktop\NASA space apps",
  [string]$Launcher = "claude"
)
$Host.UI.RawUI.WindowTitle = "SUPERVISOR vigilante $Role - no cerrar"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$live = Join-Path $here "tw-live.ps1"
$good = Join-Path $here "tw-live.good.ps1"
$log = Join-Path $env:LOCALAPPDATA "tw-live-run-$Role.log"
function Say($m, $c = "Gray") { $l = "$(Get-Date -Format HH:mm:ss) $m"; Write-Host $l -ForegroundColor $c; "$(Get-Date -Format s) $m" | Add-Content $log -Encoding utf8; if ((Get-Item $log).Length -gt 100KB) { (Get-Content $log -Tail 200) | Set-Content $log -Encoding utf8 } }
function Alert($msg) {
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("vigilante ${Role} (PC Carne): $msg"))
  $cmd = "b=`$(echo $b64 | base64 -d); tw --dir $Dir notify --to vps --topic alerta-vigilante --body `"`$b`""
  try { $null = (ssh -o BatchMode=yes -o ConnectTimeout=10 $SshHost $cmd 2>&1 | Out-String) } catch {}
}
function ParseError($path) {
  try { $tokens = $null; $errs = $null; [void][Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errs); if ($errs -and $errs.Count) { return ($errs[0].Message + " (linea " + $errs[0].Extent.StartLineNumber + ")") }; return $null } catch { return $_.Exception.Message }
}

$wait = 10
while ($true) {
  $script = $live
  $perr = ParseError $live
  if ($perr) {
    Say "tw-live.ps1 ROTO: $perr" "Red"
    if (Test-Path $good) { Say "uso la ultima copia buena (tw-live.good.ps1)" "Yellow"; $script = $good; Alert "tw-live.ps1 roto ($perr); corro la copia buena" }
    else { Alert "tw-live.ps1 roto ($perr) y no hay copia buena; reintento en ${wait}s"; Say "sin copia buena; reintento en ${wait}s" "Red"; Start-Sleep $wait; $wait = [Math]::Min($wait * 2, 120); continue }
  }
  $t0 = Get-Date
  Say "arranco $(Split-Path -Leaf $script)" "Green"
  try { & $script -Role $Role -SshHost $SshHost -Dir $Dir -Workdir $Workdir -Launcher $Launcher } catch { Say "excepcion: $($_.Exception.Message)" "Red"; $lastErr = $_.Exception.Message }
  $ran = ((Get-Date) - $t0).TotalSeconds
  if ($ran -gt 120) { if ($script -eq $live -and -not $perr) { Copy-Item $live $good -Force }; $wait = 10 }
  Say ("el vigilante termino tras {0:N0} s" -f $ran) "Red"
  Alert ("el vigilante termino tras {0:N0} s{1}; lo reinicio" -f $ran, $(if ($lastErr) { " (" + $lastErr + ")" } else { "" }))
  $lastErr = $null
  Start-Sleep $wait; $wait = [Math]::Min($wait * 2, 120)
}
