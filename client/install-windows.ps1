# Windows：登入時自動啟動本機轉發（工作排程器，不需要系統管理員）。
# 用法（在這個資料夾裡）：powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
# 設定寫在 %USERPROFILE%\.claude-mem\access-proxy.env（見 README）。
$ErrorActionPreference = "Stop"
$dest = Join-Path $env:LOCALAPPDATA "claude-mem-hub"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Force (Join-Path $PSScriptRoot "access-proxy.mjs") $dest
$node = (Get-Command node -ErrorAction Stop).Source
$script = Join-Path $dest "access-proxy.mjs"
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$script`"" -WorkingDirectory $dest
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -Hidden
Register-ScheduledTask -TaskName "claude-mem-access-proxy" -Action $action -Trigger $trigger `
  -Settings $settings -Description "claude-mem central worker access proxy" -Force | Out-Null
Start-ScheduledTask -TaskName "claude-mem-access-proxy"
Write-Host "已安裝並啟動：claude-mem-access-proxy（$script）"
