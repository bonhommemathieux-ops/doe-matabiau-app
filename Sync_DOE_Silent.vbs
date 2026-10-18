' Sync DOE MATABIAU - Synchronisation silencieuse au demarrage Windows
' Lance sync_classer.py en arriere-plan (sans fenetre)
' Appele automatiquement par le raccourci dans le dossier Startup

Set WshShell = CreateObject("WScript.Shell")

repoPath = "C:\Users\bonho\OneDrive\Bureau\DOE_MATABIAU_App"
pythonCmd = "python """ & repoPath & "\sync_classer.py"""

' Laisse 60 secondes pour que le reseau et OneDrive se stabilisent au boot
WScript.Sleep 60000

' Change de dossier et lance Python en mode cache (0 = pas de fenetre)
WshShell.CurrentDirectory = repoPath
WshShell.Run "cmd /c " & pythonCmd, 0, False
