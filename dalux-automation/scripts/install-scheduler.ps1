# One-time setup so the scheduler runs without ever opening a terminal:
#
#   1. A "daluxscheduler:" URI protocol lets the dashboard's "Start scheduler"
#      button launch it on demand.  (HKCU only — no admin needed.)
#   2. A logon task starts it hidden at every login.  (Best effort: creating a
#      scheduled task may require elevation; if it fails, the button still works.)
#
# Run once:  powershell -NoProfile -ExecutionPolicy Bypass -File install-scheduler.ps1
# Remove:    powershell -NoProfile -ExecutionPolicy Bypass -File install-scheduler.ps1 -Uninstall

param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'

$scripts = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbs = Join-Path $scripts 'start-scheduler.vbs'
$taskName = 'DaluxAutomationScheduler'
$protoKey = 'HKCU:\Software\Classes\daluxscheduler'

if ($Uninstall) {
    try { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop } catch { }
    Remove-Item -Path $protoKey -Recurse -Force -ErrorAction SilentlyContinue
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

# ── 2. Logon task (best effort — may need elevation) ──────────────────────────
$taskOk = $false
try {
    $svc = New-Object -ComObject Schedule.Service
    $svc.Connect()
    $root = $svc.GetFolder('\')
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
    $root.RegisterTaskDefinition($taskName, $task, 6, $null, $null, 3) | Out-Null
    $taskOk = $true
} catch {
    Write-Output "TASK_FAILED: $($_.Exception.Message)"
}

if ($taskOk) { Write-Output 'TASK_OK' }
Write-Output 'INSTALLED'
