# Flutter Run Script - ADC Delivery Mobile App
# Usage: .\flutter_run.ps1              -> run on connected device
#        .\flutter_run.ps1 build-apk    -> build debug APK
#        .\flutter_run.ps1 install      -> adb install debug APK

$env:JAVA_HOME = (Get-ChildItem "C:\Program Files\Microsoft\jdk-*" -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName
$env:ANDROID_HOME = "C:\adb"
$env:PATH = "C:\flutter\bin;C:\adb\cmdline-tools\latest\bin;C:\adb\platform-tools;$env:JAVA_HOME\bin;$env:PATH"

Write-Host "JAVA_HOME   = $env:JAVA_HOME" -ForegroundColor Cyan
Write-Host "ANDROID_HOME = $env:ANDROID_HOME" -ForegroundColor Cyan

$cmd = $args[0]

if ($cmd -eq "build-apk") {
    Write-Host "Building debug APK..." -ForegroundColor Yellow
    flutter build apk --debug
    Write-Host "APK: build\app\outputs\flutter-apk\app-debug.apk" -ForegroundColor Green
} elseif ($cmd -eq "install") {
    Write-Host "Installing APK via adb..." -ForegroundColor Yellow
    adb install build\app\outputs\flutter-apk\app-debug.apk
} else {
    Write-Host "Running on connected device..." -ForegroundColor Yellow
    flutter run
}
