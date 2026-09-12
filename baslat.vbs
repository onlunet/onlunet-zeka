Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\Antigravity\ONLUNET ZEKA"
WshShell.Run "cmd.exe /c baslat.bat", 0, False
