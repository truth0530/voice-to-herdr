# voice-to-herdr: status / restart / stop / remove on Windows.
# Run with (ExecutionPolicy Bypass is needed for .ps1 files under the default policy):
#   powershell -NoProfile -ExecutionPolicy Bypass -File "<repo>\templates\windows-service.ps1" -Action status -TaskName "voice-to-herdr"
# Actions:
#   status    runner loops, whether node is listening on the configured port, task state
#   restart   stops node only; the runner loop starts it again in about 5 s with the new config
#   stop      stops the runner loop and node (until next logon or Start-ScheduledTask)
#   remove    stop + unregister the task
# Why: the task only launches wscript, which exits at once. Stop-ScheduledTask does not stop the
# cmd runner loop, and Start-ScheduledTask while it runs would start a second loop.
# The port is read from %APPDATA%\voice-to-herdr\config.json, and only node.exe processes are stopped.
param(
  [Parameter(Mandatory = $true)][ValidateSet("status", "restart", "stop", "remove")][string]$Action,
  [string]$TaskName = "voice-to-herdr",
  [int]$Port = 0
)

if (-not $Port) {
  $cfgPath = if ($env:VOICE_TO_HERDR_CONFIG) { $env:VOICE_TO_HERDR_CONFIG } else { Join-Path $env:APPDATA "voice-to-herdr\config.json" }
  try { $Port = [int]((Get-Content -Raw -Encoding UTF8 $cfgPath | ConvertFrom-Json).port) } catch { }
  if (-not $Port) { $Port = 8765 }
}

function Get-Runners {
  Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" | Where-Object { $_.CommandLine -like "*run-server.cmd*" }
}
function Get-ServerPids {
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    Where-Object { (Get-Process -Id $_ -ErrorAction SilentlyContinue).ProcessName -eq "node" }
}

switch ($Action) {
  "status" {
    $r = @(Get-Runners).Count
    $p = @(Get-ServerPids)
    Write-Output "port $Port   runner loops: $r   node listening: $(if ($p.Count) { 'yes (pid ' + ($p -join ',') + ')' } else { 'no' })"
    Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Select-Object TaskName, State | Format-Table -AutoSize
  }
  "restart" {
    if (-not @(Get-Runners).Count) { Start-ScheduledTask -TaskName $TaskName; Write-Output "runner was not running: started the task"; break }
    Get-ServerPids | ForEach-Object { Stop-Process -Id $_ -Force }
    Write-Output "node stopped; the runner restarts it in about 5 s"
  }
  { $_ -in "stop", "remove" } {
    Get-Runners | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    Get-ServerPids | ForEach-Object { Stop-Process -Id $_ -Force }
    Write-Output "runner and server stopped"
    if ($Action -eq "remove") { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false; Write-Output "task removed: $TaskName" }
  }
}
