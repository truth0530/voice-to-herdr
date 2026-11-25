@echo off
rem voice-to-herdr runner for Windows. Save this file as run-server.cmd INSIDE the server folder.
rem Restarts the server 5 seconds after it exits and appends all output to a log file.
rem If the port is already taken (server exit code 3) it stops, so two runners never fight.
rem Keep this file ASCII only (cmd reads .cmd files in the OEM code page, not UTF-8).
rem If node is not on the PATH of the logged-in user, replace "node" below with the full path
rem from `where.exe node`, for example: set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "NODE_EXE=node"
set "SERVER_DIR=%~dp0"
set "LOGDIR=%LOCALAPPDATA%\voice-to-herdr"
set "LOG=%LOGDIR%\server.log"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
cd /d "%SERVER_DIR%"
:loop
echo [%date% %time%] starting >> "%LOG%"
"%NODE_EXE%" server.mjs >> "%LOG%" 2>&1
set "RC=%errorlevel%"
if "%RC%"=="3" (
  echo [%date% %time%] port busy, runner stops. Another copy is probably running. >> "%LOG%"
  goto :eof
)
echo [%date% %time%] exited with %RC%, restarting in 5s >> "%LOG%"
rem ping instead of timeout: timeout fails at once when there is no console input (hidden task).
ping -n 6 127.0.0.1 > nul
goto loop
