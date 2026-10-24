@echo off
REM Cross-platform wrapper for npx execution on Windows to prevent CreateProcess error=193 in IDEs like Android Studio
cmd.exe /c npx %*
