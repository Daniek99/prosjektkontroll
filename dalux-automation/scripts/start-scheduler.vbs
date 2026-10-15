' Starts the Dalux automation scheduler hidden (no console window).
' Used by the logon task and by the "daluxscheduler:" protocol (dashboard button).

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)   ' ...\dalux-automation\scripts
root      = fso.GetParentFolderName(scriptDir)                ' ...\dalux-automation

sh.CurrentDirectory = root
' 0 = hidden window, False = don't wait
sh.Run "cmd /c node src\scheduler.mjs >> scheduler.log 2>&1", 0, False
