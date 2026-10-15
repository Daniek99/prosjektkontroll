' Launcher for the Dalux automation helper. Started by the dashboard buttons via
' the "daluxscheduler:" protocol, and by the logon task.
'
'   daluxscheduler://start  -> start the scheduler (hidden)
'   daluxscheduler://login  -> open Dalux so the user can log in (session saved automatically)
'
' The command window stays hidden; the Playwright browser window is visible.

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)   ' ...\dalux-automation\scripts
root      = fso.GetParentFolderName(scriptDir)                ' ...\dalux-automation

url = ""
If WScript.Arguments.Count > 0 Then url = LCase(WScript.Arguments(0))

sh.CurrentDirectory = root

If InStr(url, "login") > 0 Then
    sh.Run "cmd /c node src\login-auto.mjs >> login.log 2>&1", 0, False
Else
    sh.Run "cmd /c node src\scheduler.mjs >> scheduler.log 2>&1", 0, False
End If
