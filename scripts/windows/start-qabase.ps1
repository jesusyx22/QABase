#requires -Version 5.1
<#
  Arranca QABase (un solo proceso: API + SPA) en segundo plano y comprueba
  /api/health. Es idempotente: si el puerto ya escucha, no lanza otro proceso.

  Lo ejecuta la tarea programada QABase al arrancar Windows y cada 5 minutos
  como vigilante. Tambien sirve a mano:

      powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\start-qabase.ps1

  Codigos de salida: 0 = servicio arriba (o ya lo estaba), 1 = no se pudo
  levantar. El script no compila: si falta el build o esta mas viejo que el
  codigo, lo deja anotado en el log y falla.
#>
[CmdletBinding()]
param(
  [string]$Root,
  [int]$Port = 3000,
  [int]$TimeoutSeconds = 90,
  [string]$NodeExe
)

$ErrorActionPreference = 'Stop'

function Resolve-QabaseRoot {
  param([string]$Candidate)
  if ($Candidate) {
    return (Resolve-Path -LiteralPath $Candidate).Path
  }
  $scriptDir = Split-Path -Parent $PSCommandPath
  return (Split-Path -Parent (Split-Path -Parent $scriptDir))
}

$rootPath = Resolve-QabaseRoot $Root
$logFile = Join-Path $rootPath 'data\logs\qabase.log'
# La salida del proceso va a un archivo aparte: quien lo redirige lo mantiene
# abierto y nadie mas podria anexar la traza del lanzador.
$appLogFile = Join-Path $rootPath 'data\logs\qabase-app.log'
$entryPoint = Join-Path $rootPath 'apps\api\dist\server.js'
$webIndex = Join-Path $rootPath 'apps\web\dist\index.html'

function Write-QabaseLog {
  param([string]$Message)
  $line = '{0} {1}' -f (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss'), $Message
  try {
    $logDir = Split-Path -Parent $logFile
    if (-not (Test-Path -LiteralPath $logDir)) {
      New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
  } catch {
    # Sin log escribible se sigue informando por la salida estandar.
  }
  Write-Output $line
}

function Invoke-LogRotation {
  param([string]$File)
  try {
    if (-not (Test-Path -LiteralPath $File)) { return }
    if ((Get-Item -LiteralPath $File).Length -lt 5MB) { return }
    $previous = '{0}.1' -f $File
    if (Test-Path -LiteralPath $previous) {
      Move-Item -LiteralPath $previous -Destination ('{0}.old' -f $previous) -Force
    }
    Move-Item -LiteralPath $File -Destination $previous -Force
  } catch {
    # Si no se puede rotar se sigue anexando al archivo actual.
  }
}

function Test-QabasePort {
  param([int]$PortToCheck, [int]$TimeoutMs = 600)
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $connect = $client.ConnectAsync('127.0.0.1', $PortToCheck)
    if (-not $connect.Wait($TimeoutMs)) { return $false }
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Test-QabaseHealth {
  param([int]$PortToCheck)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$PortToCheck/api/health" -TimeoutSec 5
    return ($response.StatusCode -eq 200 -and $response.Content -match '"status"\s*:\s*"ok"')
  } catch {
    return $false
  }
}

function Resolve-NodeExe {
  param([string]$Candidate)
  $candidates = @()
  if ($Candidate) { $candidates += $Candidate }
  if ($env:QABASE_NODE) { $candidates += $env:QABASE_NODE }
  $candidates += 'C:\Program Files\nodejs\node.exe'
  $resolved = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($resolved) { $candidates += $resolved.Source }

  foreach ($path in $candidates) {
    if ($path -and (Test-Path -LiteralPath $path)) { return $path }
  }
  return $null
}

function Get-NewestSource {
  param([string]$Directory, [string]$Pattern)
  if (-not (Test-Path -LiteralPath $Directory)) { return $null }
  return Get-ChildItem -LiteralPath $Directory -Recurse -File -Filter $Pattern |
    Where-Object { $_.Name -notmatch '\.test\.' } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
}

Invoke-LogRotation -File $logFileWrite-QabaseLog "Arranque solicitado (raiz=$rootPath puerto=$Port)."

if (-not (Test-Path -LiteralPath $entryPoint)) {
  Write-QabaseLog "ERROR falta el build del API: $entryPoint. Ejecuta npm run build."
  exit 1
}

if (-not (Test-Path -LiteralPath $webIndex)) {
  Write-QabaseLog "AVISO no hay build de la SPA en apps\web\dist; la API servira solo /api."
}

$newestApi = Get-NewestSource (Join-Path $rootPath 'apps\api\src') '*.ts'
$newestShared = Get-NewestSource (Join-Path $rootPath 'packages\shared\src') '*.ts'
$apiBuildTime = (Get-Item -LiteralPath $entryPoint).LastWriteTime
foreach ($file in @($newestApi, $newestShared)) {
  if ($file -and $file.LastWriteTime -gt $apiBuildTime) {
    Write-QabaseLog ("AVISO el build del API es mas antiguo que {0}; ejecuta npm run build." -f $file.Name)
  }
}
$newestWeb = Get-NewestSource (Join-Path $rootPath 'apps\web\src') '*.*'
if ((Test-Path -LiteralPath $webIndex) -and $newestWeb) {
  if ($newestWeb.LastWriteTime -gt (Get-Item -LiteralPath $webIndex).LastWriteTime) {
    Write-QabaseLog ("AVISO el build de la SPA es mas antiguo que {0}; ejecuta npm run build." -f $newestWeb.Name)
  }
}

if (Test-QabasePort -PortToCheck $Port) {
  if (Test-QabaseHealth -PortToCheck $Port) {
    Write-QabaseLog "OK QABase ya respondia en http://127.0.0.1:$Port/api/health; no se inicia otro proceso."
    exit 0
  }
  Write-QabaseLog "ERROR el puerto $Port esta ocupado y /api/health no responde. No se inicia otro proceso."
  exit 1
}

$nodePath = Resolve-NodeExe $NodeExe
if (-not $nodePath) {
  Write-QabaseLog "ERROR no se encontro node.exe. Instala Node 24 o define QABASE_NODE."
  exit 1
}

$nodeVersion = & $nodePath --version
Write-QabaseLog "Node $nodeVersion ($nodePath)."

# La configuracion del API lee PORT del entorno; se fija para que el chequeo
# de salud y el proceso coincidan.
$env:PORT = [string]$Port

$shell = $env:ComSpec
if (-not $shell -or -not (Test-Path -LiteralPath $shell)) {
  $shell = Join-Path $env:SystemRoot 'System32\cmd.exe'
}

$launchCommand = '/c ""{0}" "{1}" >> "{2}" 2>&1"' -f $nodePath, $entryPoint, $appLogFile
Invoke-LogRotation -File $appLogFile
try {
  $tracked = Start-Process -FilePath $shell -ArgumentList $launchCommand `
    -WorkingDirectory $rootPath -WindowStyle Hidden -PassThru
} catch {
  Write-QabaseLog ("ERROR al lanzar el proceso: {0}" -f $_.Exception.Message)
  exit 1
}
Write-QabaseLog ("Proceso lanzado (pid {0}); esperando /api/health." -f $tracked.Id)

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 500
  if (Test-QabaseHealth -PortToCheck $Port) {
    Write-QabaseLog "OK QABase escuchando en http://127.0.0.1:$Port (pid $($tracked.Id))."
    exit 0
  }
}

Write-QabaseLog "ERROR QABase no respondio en $TimeoutSeconds s. Ultimas lineas de qabase-app.log:"
try {
  Get-Content -LiteralPath $appLogFile -Tail 20 | ForEach-Object { Write-Output $_ }
} catch {
  # Sin log no hay mas contexto que el codigo de salida.
}
exit 1
