Dim WshShell, fso, appDir, portFile, port, browserPath, i

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 작업 폴더는 "현재 디렉터리"가 아니라 이 스크립트가 있는 폴더여야 한다.
' 파일 연결(.hwp 더블클릭)이나 바로가기로 실행되면 현재 디렉터리가 문서 폴더나
' System32 가 되어 server.mjs / server-port.txt 를 찾지 못하고, 서버가 뜨지 않은 채
' 기본 포트로 브라우저만 열려 엉뚱한(또는 죽은) 화면이 뜬다.
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = appDir

If Not fso.FileExists(fso.BuildPath(appDir, "dist\index.html")) Then
    ' 최초 실행: 의존성이 없으면 설치, 정적 파일이 없으면 빌드부터 (완료까지 대기)
    If Not fso.FolderExists(fso.BuildPath(appDir, "node_modules")) Then
        WshShell.Run "cmd /c npm install", 0, True
    End If
    WshShell.Run "cmd /c npm run build", 0, True
End If

' 빌드 결과물이 없으면 서버가 dist\index.html 을 읽지 못해 "500 Internal Server Error: ENOENT" 가 뜬다.
If Not fso.FileExists(fso.BuildPath(appDir, "dist\index.html")) Then
    MsgBox "Build failed (dist\index.html not found)." & vbCrLf & "Run npm install and npm run build in a command prompt.", vbCritical, "hwp+AI Editor"
    WScript.Quit 1
End If

If fso.FileExists(fso.BuildPath(appDir, "server-port.txt")) Then
    On Error Resume Next
    fso.DeleteFile fso.BuildPath(appDir, "server-port.txt"), True
    On Error GoTo 0
End If

WshShell.Run "cmd /c node server.mjs", 0, False

For i = 1 To 40
    WScript.Sleep 250
    If fso.FileExists(fso.BuildPath(appDir, "server-port.txt")) Then Exit For
Next

port = "7700"
If fso.FileExists(fso.BuildPath(appDir, "server-port.txt")) Then
    On Error Resume Next
    Set portFile = fso.OpenTextFile(fso.BuildPath(appDir, "server-port.txt"), 1)
    If Not portFile.AtEndOfStream Then port = Trim(portFile.ReadLine())
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
