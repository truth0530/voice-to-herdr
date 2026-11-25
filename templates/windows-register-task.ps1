# voice-to-herdr: register a Task Scheduler task that starts the server hidden, at logon, as the CURRENT user.
# Do not run it as SYSTEM or "whether user is logged on or not": then it cannot see the user's herdr session.
# Usage (normal PowerShell, not admin):
#   powershell -NoProfile -ExecutionPolicy Bypass -File "<repo>\templates\windows-register-task.ps1" -TaskName "voice-to-herdr" -ServerDir "<repo>\server"
# ServerDir must contain run-server.cmd and run-hidden.vbs (copied from templates).
param(
  [Parameter(Mandatory = $true)][string]$TaskName,
  [Parameter(Mandatory = $true)][string]$ServerDir
)
$ErrorActionPreference = "Stop"
$vbs = Join-Path $ServerDir "run-hidden.vbs"
$cmd = Join-Path $ServerDir "run-server.cmd"
foreach ($f in @($vbs, $cmd)) { if (-not (Test-Path $f)) { throw "missing: $f (copy it from templates)" } }

$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`"" -WorkingDirectory $ServerDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Output "registered and started: $TaskName (user $user)"
