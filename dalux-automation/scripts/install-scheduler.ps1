# One-time setup so the scheduler is always running — no terminal needed:
#
#   1. A "daluxscheduler:" URI protocol lets the dashboard's "Start scheduler"
#      and "Logg inn på Dalux" buttons launch things on demand.  (HKCU, no admin.)
#   2. A Startup-folder shortcut starts the scheduler hidden at every login.
#      (No admin needed — this is the reliable "always online" mechanism.)
#   3. A logon scheduled task as well, if the account is allowed to create one.
#
# Run once:  powershell -NoProfile -ExecutionPolicy Bypass -File install-scheduler.ps1
# Remove:    powershell -NoProfile -ExecutionPolicy Bypass -File install-scheduler.ps1 -Uninstall

param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'

$scripts = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scripts
$vbs = Join-Path $scripts 'start-scheduler.vbs'
$taskName = 'DaluxAutomationScheduler'
$protoKey = 'HKCU:\Software\Classes\daluxscheduler'
$startup = [Environment]::GetFolderPath('Startup')
$lnk = Join-Path $startup 'Dalux Automation Scheduler.lnk'

if ($Uninstall) {
    try { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop } catch { }
    Remove-Item -Path $protoKey -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $lnk -Force -ErrorAction SilentlyContinue
    Write-Output 'UNINSTALLED'
    exit 0
}

if (-not (Test-Path $vbs)) { throw "Launcher not found: $vbs" }

# ── 1. Register the daluxscheduler: protocol (no admin required) ──────────────
New-Item -Path $protoKey -Force | Out-Null
Set-ItemProperty -Path $protoKey -Name '(Default)' -Value 'URL:Dalux Automation Scheduler'
Set-ItemProperty -Path $protoKey -Name 'URL Protocol' -Value ''
New-Item -Path "$protoKey\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$protoKey\shell\open\command" -Name '(Default)' -Value "wscript.exe `"$vbs`""
Write-Output 'PROTOCOL_OK'

# ── 2. Startup-folder shortcut: starts the scheduler at every login ───────────
try {
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut($lnk)
    $sc.TargetPath = 'wscript.exe'
    $sc.Arguments = "`"$vbs`""
    $sc.WorkingDirectory = $root
    $sc.WindowStyle = 7 # minimized
    $sc.Description = 'Starts the Dalux automation scheduler (hidden)'
    $sc.Save()
    Write-Output 'STARTUP_OK'
} catch {
    Write-Output "STARTUP_FAILED: $($_.Exception.Message)"
}

# ── 3. Logon scheduled task (best effort — may need elevation) ────────────────
$taskOk = $false
try {
    $svc = New-Object -ComObject Schedule.Service
    $svc.Connect()
    $folder = $svc.GetFolder('\')
    $task = $svc.NewTask(0)
    $task.RegistrationInfo.Description = 'Starts the Dalux automation scheduler (hidden).'
    $task.Settings.Hidden = $true
    $task.Settings.MultipleInstances = 2          # IgnoreNew
    $task.Settings.ExecutionTimeLimit = 'PT0S'    # no limit
    $task.Settings.StartWhenAvailable = $true
    $trigger = $task.Triggers.Create(9)           # 9 = at logon
    $action = $task.Actions.Create(0)             # 0 = exec
    $action.Path = 'wscript.exe'
    $action.Arguments = "`"$vbs`""
    # 6 = TASK_CREATE_OR_UPDATE, 3 = TASK_LOGON_INTERACTIVE_TOKEN
    $folder.RegisterTaskDefinition($taskName, $task, 6, $null, $null, 3) | Out-Null
    $taskOk = $true
} catch {
    Write-Output "TASK_FAILED: $($_.Exception.Message)"
}

if ($taskOk) { Write-Output 'TASK_OK' }
Write-Output 'INSTALLED'
