Dim WshShell, fso, portFile, port, browserPath
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
WshShell.CurrentDirectory = fso.GetAbsolutePathName(".")

If fso.FileExists("server-port.txt") Then
    On Error Resume Next
    fso.DeleteFile "server-port.txt", True
    On Error GoTo 0
End If

WshShell.Run "cmd /c node server.mjs", 0, False

Dim i
For i = 1 To 20
    WScript.Sleep 250
    If fso.FileExists("server-port.txt") Then Exit For
Next

port = "7700"
If fso.FileExists("server-port.txt") Then
    On Error Resume Next
    Set portFile = fso.OpenTextFile("server-port.txt", 1)
    port = Trim(portFile.ReadLine())
    portFile.Close
    On Error GoTo 0
End If

browserPath = ""
If fso.FileExists("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe") Then
    browserPath = """C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"" --app=http://127.0.0.1:" & port
ElseIf fso.FileExists("C:\Program Files\Microsoft\Edge\Application\msedge.exe") Then
    browserPath = """C:\Program Files\Microsoft\Edge\Application\msedge.exe"" --app=http://127.0.0.1:" & port
ElseIf fso.FileExists("C:\Program Files\Google\Chrome\Application\chrome.exe") Then
    browserPath = """C:\Program Files\Google\Chrome\Application\chrome.exe"" --app=http://127.0.0.1:" & port
ElseIf fso.FileExists("C:\Program Files (x86)\Google\Chrome\Application\chrome.exe") Then
    browserPath = """C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"" --app=http://127.0.0.1:" & port
End If

If browserPath <> "" Then
    WshShell.Run browserPath, 1, False
Else
    WshShell.Run "http://127.0.0.1:" & port, 1, False
End If
