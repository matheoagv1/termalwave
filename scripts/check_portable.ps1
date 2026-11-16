# Prove TermalWave runs using only vendored libraries on Windows.
# Required Python minor comes from config/runtime.json.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$runtime = Get-Content -Raw "config/runtime.json" | ConvertFrom-Json
$reqMajor = [int]$runtime.python.major
$reqMinor = [int]$runtime.python.minor
$req = "$reqMajor.$reqMinor"
$defaultConfig = $runtime.paths.default_config

$PythonArgs = @()
$Python = $null
$pyLauncher = Get-Command "py" -ErrorAction SilentlyContinue
if ($pyLauncher) {
  $Python = $pyLauncher.Source
  $PythonArgs = @("-$req")
} else {
  foreach ($name in @("python$req", "python$reqMajor.$reqMinor", "python")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) {
      $Python = $cmd.Source
      break
    }
  }
}
if (-not $Python) {
  Write-Error "Python $req is required"
}

$ver = & $Python @PythonArgs -c "import sys; print(f'{sys.version_info[0]}.{sys.version_info[1]}')"
if ($ver -ne $req) {
  Write-Error "Python $req.x required (found $ver via $Python)"
}

$env:PYTHONNOUSERSITE = "1"
$env:PYTHONPATH = ""

Write-Host "==> Unit + smoke tests with PYTHONNOUSERSITE=1 and empty PYTHONPATH"
& $Python @PythonArgs -m unittest discover -s tests -v
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> CLI smoke"
& $Python @PythonArgs -m termalwave info
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $Python @PythonArgs -m termalwave run --config $defaultConfig --offline --verify-vendor
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Portable check passed."
