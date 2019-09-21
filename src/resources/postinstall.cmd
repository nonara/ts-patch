@IF NOT EXIST "%~dp0\..\ts-patch\bin\persist.js" DEL /F /Q "%~dp0\postinstall*" && exit

@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\ts-patch\bin\persist.js"
) ELSE (
  @SETLOCAL
  @SET PATHEXT=%PATHEXT:;.JS;=;%
  node  "%~dp0\..\ts-patch\bin\persist.js"
)

:EXIT