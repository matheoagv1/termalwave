# Harness para trabajar en el VPS sin llenar el contexto de ruido.
# Salida corta por defecto; el log completo queda en $env:TEMP\vps-last.log.
#
# Uso:  .\vps.ps1 <comando> [args]
#   status                      git corto + tablero de tareas
#   run "<comando>"             corre algo en la raiz del repo remoto
#   put <local> <remoto>        sube un archivo o carpeta (ruta remota relativa al repo)
#   get <remoto> <local>        baja un archivo o carpeta
#   check                       tsc --noEmit en web/
#   build                       npm run build en web/
#   commit "<mensaje>"          git add de tu zona + commit con identidad del agente
#   notify <para> <tema> "<texto>"
#   task <id> <estado> ["notas"]
#   task-add "<titulo>" ["notas"]
#   archive <archivo.md> [...]  archiva mensajes de tu inbox
#   serve [carpeta]             sirve una carpeta local en http://127.0.0.1:8765
#   log                         muestra el log completo del ultimo comando
#
# Configuracion (variables de entorno, con valores para carne):
#   VPS_HOST  alias ssh del agente     (agente-carne)
#   VPS_REPO  ruta del worktree        (/srv/sites/nasaspaceappchallenge-carne)
#   VPS_ROLE  rol para notify/commit   (carne)
#   VPS_PATHS carpetas que commitea    (web comms/carne)
#   VPS_TAIL  lineas por defecto       (12)

param(
  [Parameter(Position = 0)][string]$Cmd = "help",
  [Parameter(Position = 1, ValueFromRemainingArguments = $true)][string[]]$Rest
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
function Cfg($name, $default) { $v = [Environment]::GetEnvironmentVariable($name); if ($v) { $v } else { $default } }
$H     = Cfg "VPS_HOST"  "agente-carne"
$R     = Cfg "VPS_REPO"  "/srv/sites/nasaspaceappchallenge-carne"
$Role  = Cfg "VPS_ROLE"  "carne"
$Paths = Cfg "VPS_PATHS" "web comms/carne"
$Tail  = [int](Cfg "VPS_TAIL" "12")
$Log   = Join-Path $env:TEMP "vps-last.log"
$Noise = '^(npm notice|npm warn|\s*$)'

function Sq([string]$s) { "'" + $s.Replace("'", "'\''") + "'" }

# Corre un script bash en el VPS sin problemas de comillas ni de codificacion.
function Remote([string]$script, [int]$tail = $Tail, [switch]$Raw) {
  $tmp = Join-Path $env:TEMP "vps-$PID.sh"
  $body = ("cd $R`n" + $script + "`n").Replace("`r", "")
  [IO.File]::WriteAllText($tmp, $body, (New-Object Text.UTF8Encoding($false)))
  cmd /c "ssh -o BatchMode=yes -o ConnectTimeout=15 $H bash -s < `"$tmp`" > `"$Log`" 2>&1"
  $code = $LASTEXITCODE
  Remove-Item $tmp -ErrorAction SilentlyContinue
  $lines = @(Get-Content $Log -ErrorAction SilentlyContinue | Where-Object { $_ -notmatch $Noise })
  if ($lines.Count -gt $tail) { $lines = $lines[($lines.Count - $tail)..($lines.Count - 1)] }
  if ($code -ne 0) { Write-Output "fallo (codigo $code)" }
  $lines
  if ($Raw) { return }
  $global:LASTEXITCODE = $code
}

switch ($Cmd) {
  "status" {
    Remote "git status -sb | head -6; python3 scripts/comms.py status 2>&1 | head -24" 30
  }
  "run" {
    Remote ($Rest -join " ")
  }
  "put" {
    if ($Rest.Count -lt 2) { "uso: put <local> <remoto>"; break }
    # Si el archivo remoto es de otro usuario no se puede sobrescribir, pero sí borrar y recrear.
    if (Test-Path $Rest[0] -PathType Leaf) { Remote "rm -f $(Sq $Rest[1]) 2>&1 | tail -1" 2 | Out-Null }
    scp -rq $Rest[0] "${H}:$R/$($Rest[1])" 2>&1 | Select-Object -First 3
    if ($LASTEXITCODE -eq 0) { "subido: $($Rest[1])" } else { "fallo al subir" }
  }
  "get" {
    if ($Rest.Count -lt 2) { "uso: get <remoto> <local>"; break }
    scp -rq "${H}:$R/$($Rest[0])" $Rest[1] 2>&1 | Select-Object -First 3
    if ($LASTEXITCODE -eq 0) { "bajado: $($Rest[1])" } else { "fallo al bajar" }
  }
  "check" {
    Remote "cd web && npx tsc --noEmit 2>&1 | head -25; echo EXIT=`${PIPESTATUS[0]}" 25
  }
  "build" {
    Remote "cd web && npm run build 2>&1 | grep -E 'error|Error|built in|brand:|TS[0-9]+' | head -20" 20
  }
  "commit" {
    $msg = $Rest -join " "
    if (-not $msg) { "uso: commit <mensaje>"; break }
    $id = "-c user.name=agente-$Role -c user.email=agente-$Role@termalwave.local"
    Remote "git add -A $Paths 2>&1 | head -3; git $id commit -q -m $(Sq $msg) 2>&1 | head -5; git log -1 --format='commit %h %s'" 8
  }
  "notify" {
    if ($Rest.Count -lt 3) { "uso: notify <para> <tema> <texto>"; break }
    $body = ($Rest[2..($Rest.Count - 1)] -join " ")
    Remote "python3 scripts/comms.py notify --from $Role --to $(Sq $Rest[0]) --topic $(Sq $Rest[1]) --body $(Sq $body) 2>&1 | tail -2" 4
  }
  "archive" {
    if ($Rest.Count -lt 1) { "uso: archive <archivo.md> [...]"; break }
    $cmds = ($Rest | ForEach-Object { "python3 scripts/comms.py archive --name $(Sq $_) 2>&1 | tail -1" }) -join "`n"
    Remote $cmds 10
  }
  "task-add" {
    if ($Rest.Count -lt 1) { "uso: task-add <titulo> [notas]"; break }
    $notes = if ($Rest.Count -gt 1) { " --notes " + (Sq ($Rest[1..($Rest.Count - 1)] -join " ")) } else { "" }
    Remote "python3 scripts/comms.py task add --owner $Role --title $(Sq $Rest[0])$notes 2>&1 | tail -2" 4
  }
  "task" {
    if ($Rest.Count -lt 2) { "uso: task <id> <estado> [notas]"; break }
    $notes = if ($Rest.Count -gt 2) { " --notes " + (Sq ($Rest[2..($Rest.Count - 1)] -join " ")) } else { "" }
    Remote "python3 scripts/comms.py task set $($Rest[0]) --status $($Rest[1])$notes 2>&1 | tail -2" 4
  }
  "serve" {
    $dir = if ($Rest.Count -ge 1) { (Resolve-Path $Rest[0]).Path } else { (Get-Location).Path }
    $srv = Join-Path $env:TEMP "vps-serve.ps1"
    @'
param($Dir, $Port)
$l = New-Object Net.HttpListener
$l.Prefixes.Add("http://127.0.0.1:$Port/")
$l.Start()
$types = @{ ".html"="text/html; charset=utf-8"; ".js"="text/javascript"; ".mjs"="text/javascript"; ".css"="text/css"; ".json"="application/json"; ".png"="image/png"; ".jpg"="image/jpeg"; ".ico"="image/x-icon"; ".svg"="image/svg+xml"; ".woff2"="font/woff2"; ".ttf"="font/ttf"; ".webmanifest"="application/manifest+json" }
while ($l.IsListening) {
  $c = $l.GetContext()
  $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath).TrimStart("/")
  if (-not $p) { $p = "index.html" }
  $f = Join-Path $Dir $p
  if ((Test-Path $f -PathType Leaf) -and ((Resolve-Path $f).Path.StartsWith($Dir))) {
    $b = [IO.File]::ReadAllBytes($f)
    $t = $types[[IO.Path]::GetExtension($f).ToLower()]
    if ($t) { $c.Response.ContentType = $t }
    $c.Response.OutputStream.Write($b, 0, $b.Length)
  } else { $c.Response.StatusCode = 404 }
  $c.Response.Close()
}
'@ | Set-Content $srv -Encoding UTF8
    Start-Process -WindowStyle Hidden powershell -ArgumentList "-NoProfile", "-File", $srv, "-Dir", $dir, "-Port", "8765"
    Start-Sleep 1
    "sirviendo $dir en http://127.0.0.1:8765/"
  }
  "log" {
    Get-Content $Log -ErrorAction SilentlyContinue
  }
  default {
    Get-Content $PSCommandPath -TotalCount 30| Where-Object { $_ -match '^#' } | ForEach-Object { $_.TrimStart('# ') }
  }
}
