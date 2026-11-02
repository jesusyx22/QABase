#requires -Version 5.1
<#
  Quita la tarea programada QABase. No detiene la aplicacion si ya esta
  corriendo: para eso, cierra el proceso node de QABase o reinicia la PC.

  Requiere una sesion elevada (administrador).

      powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\uninstall-qabase-task.ps1
#>
[CmdletBinding()]
param(
  [string]$TaskName = 'QABase'
)

$ErrorActionPreference = 'Stop'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Error 'Se necesita una sesion elevada para quitar la tarea programada.'
  exit 1
}

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
  Write-Output ("La tarea '{0}' no existe; nada que quitar." -f $TaskName)
  exit 0
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Output ("Tarea '{0}' eliminada." -f $TaskName)
