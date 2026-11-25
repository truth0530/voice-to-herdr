' voice-to-herdr: starts run-server.cmd with no visible window.
' Save this file as run-hidden.vbs INSIDE the server folder, next to run-server.cmd.
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run """" & dir & "\run-server.cmd""", 0, False
