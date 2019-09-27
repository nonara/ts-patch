@SETLOCAL
@SET tspdir="%~dp0\..\tspatch"
@IF NOT EXIST "%tspdir%\bin\persist.js" DEL /F /Q "%~dp0\postinstall*" && exit

@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%tspdir\bin\persist.js"
) ELSE (
  @SETLOCAL
  @SET PATHEXT=%PATHEXT:;.JS;=;%
  node  "%tspdir%\bin\persist.js"
)

:EXIT