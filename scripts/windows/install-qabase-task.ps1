#requires -Version 5.1
<#
  Registra la tarea programada QABase: arranca la aplicacion al iniciar
  Windows, sin sesion abierta, y la reintenta cada N minutos si se cayo.

  Requiere una sesion elevada (administrador). El registro de una tarea que
  corre como SYSTEM no se puede hacer desde una cuenta sin privilegios.

      powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\install-qabase-task.ps1

  Para quitarla:

      powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\uninstall-qabase-task.ps1
#>
[CmdletBinding()]
param(
  [string]$TaskName = 'QABase',
  [string]$Root,
  [int]$Port = 3000,
  [int]$IntervalMinutes = 5,
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

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Error @'
Se necesita una sesion elevada. Abre PowerShell como administrador y ejecuta:

  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\windows\install-qabase-task.ps1"

Alternativa: clic derecho sobre PowerShell > Ejecutar como administrador.
'@
  exit 1
}

$rootPath = Resolve-QabaseRoot $Root
$launcher = Join-Path $rootPath 'scripts\windows\start-qabase.ps1'
$entryPoint = Join-Path $rootPath 'apps\api\dist\server.js'

if (-not (Test-Path -LiteralPath $launcher)) {
  Write-Error "No existe el lanzador: $launcher"
  exit 1
}
if (-not (Test-Path -LiteralPath $entryPoint)) {
  Write-Error "Falta el build del API ($entryPoint). Ejecuta primero: npm run build"
  exit 1
}

$resolvedNode = $NodeExe
if (-not $resolvedNode) {
  $resolvedNode = 'C:\Program Files\nodejs\node.exe'
  if (-not (Test-Path -LiteralPath $resolvedNode)) {
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($command) { $resolvedNode = $command.Source }
  }
}
if (-not $resolvedNode -or -not (Test-Path -LiteralPath $resolvedNode)) {
  Write-Error 'No se encontro node.exe. Instala Node 24 o pasa -NodeExe con la ruta.'
  exit 1
}

$powershellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -Port {1} -NodeExe "{2}"' -f $launcher, $Port, $resolvedNode
$interval = 'PT{0}M' -f [int]$IntervalMinutes
# El disparador repetido arranca en el momento del registro: asi la vigilancia
# queda armada de inmediato y no solo despues del siguiente reinicio.
$startBoundary = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')

$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Author>QABase</Author>
    <Description>Arranca QABase (API + SPA) al iniciar Windows y comprueba cada $IntervalMinutes minutos que el puerto $Port siga respondiendo.</Description>
    <URI>\$TaskName</URI>
  </RegistrationInfo>
  <Triggers>
    <BootTrigger>
      <Enabled>true</Enabled>
      <Delay>PT30S</Delay>
    </BootTrigger>
    <TimeTrigger>
      <StartBoundary>$startBoundary</StartBoundary>
      <Enabled>true</Enabled>
      <Repetition>
        <Interval>$interval</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
    </TimeTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>S-1-5-18</UserId>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <DisallowStartOnRemoteAppSession>false</DisallowStartOnRemoteAppSession>
    <UseUnifiedSchedulingEngine>true</UseUnifiedSchedulingEngine>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>3</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$powershellExe</Command>
      <Arguments>$arguments</Arguments>
      <WorkingDirectory>$rootPath</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

try {
  Register-ScheduledTask -TaskName $TaskName -Xml $xml -Force -ErrorAction Stop | Out-Null
} catch {
  Write-Error ("No se pudo registrar la tarea '{0}': {1}" -f $TaskName, $_.Exception.Message)
  exit 1
}

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
if (-not $task) {
  Write-Error ("La tarea '{0}' no quedo registrada." -f $TaskName)
  exit 1
}
Write-Output ("Tarea '{0}' registrada: {1} / {2}" -f $task.TaskName, $task.State, $task.Principal.UserId)
Write-Output ("Accion: {0} {1}" -f $powershellExe, $arguments)
Write-Output 'Prueba manual:  Start-ScheduledTask -TaskName ''QABase'''
Write-Output 'Estado:         Get-ScheduledTaskInfo -TaskName ''QABase'''
Write-Output 'Log:            data\logs\qabase.log'
