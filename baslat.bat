@echo off
chcp 65001 >nul
title ONLUNET ZEKA — Baslatiliyor
cd /d "D:\Antigravity\ONLUNET ZEKA"

echo ============================================================
echo ⚡ ONLUNET ZEKA — Otonom Proje & Kod Uretim Merkezi
echo ============================================================

:: Port 4200 kontrolu
netstat -ano | findstr ":4200" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [BILGI] Sunucu zaten port 4200 uzerinde calisiyor.
) else (
    echo [BASLATILIYOR] Arka plan sunucusu baslatiliyor...
    start /b "" node src/app/server.js >nul 2>&1
    timeout /t 2 /nobreak >nul
)

:: Tarayicida ac
echo [ACILIYOR] Tarayicida http://localhost:4200 aciliyor...
start "" "http://localhost:4200"

exit
