@IF NOT EXIST "%~dp0\..\ts-patch\bin\postinstall.js" DEL /F /Q "%~dp0\postinstall*"

@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\ts-patch\bin\postinstall.js"
) ELSE (
  @SETLOCAL
  @SET PATHEXT=%PATHEXT:;.JS;=;%
  node  "%~dp0\..\ts-patch\bin\postinstall.js"
)