# One-command USB play: arms the cable bridge and opens GWENT in Expo Go.
#
# Use this when Wi-Fi between phone and PC is unreliable (see README).
# Prerequisites (already set up on this machine):
#   - Android platform-tools on PATH (C:\Users\<you>\platform-tools)
#   - netsh portproxy 127.0.0.1:18081 -> [::1]:8081  (IPv4 shim for Metro,
#     needed because `expo start --localhost` binds IPv6-only on Windows;
#     persists across reboots)
#   - Phone with USB debugging enabled, plugged in, authorized
#
# Flow: start the dev server first in another terminal:
#   npx expo start --localhost
# then run:
#   npm run usb

$ErrorActionPreference = 'Stop'

$adb = Get-Command adb -ErrorAction SilentlyContinue
if ($null -eq $adb) {
    $fallback = Join-Path $env:USERPROFILE 'platform-tools\adb.exe'
    if (Test-Path $fallback) { $adb = $fallback } else { throw 'adb not found - install Android platform-tools' }
} else {
    $adb = $adb.Source
}

$devices = (& $adb devices) -split "`n" | Where-Object { $_ -match "`tdevice$" }
if ($devices.Count -eq 0) {
    throw 'No phone detected. Plug it in (File transfer mode) and accept the USB debugging prompt.'
}

# Verify the IPv4 shim answers; without it the bridge dies silently.
$shim = & curl.exe -4 -s -o NUL -w '%{http_code}' --max-time 5 'http://127.0.0.1:18081/status'
if ($shim -ne '200') {
    Write-Warning "Metro not reachable via the 18081 shim (got '$shim')."
    Write-Warning 'Is the dev server running?  npx expo start --localhost'
    exit 1
}

& $adb reverse --remove-all | Out-Null
& $adb reverse tcp:8081 tcp:18081 | Out-Null
& $adb shell am force-stop host.exp.exponent
& $adb shell am start -a android.intent.action.VIEW -d 'exp://127.0.0.1:8081' | Out-Null
Write-Host 'Bridge armed - GWENT is launching in Expo Go on the phone.' -ForegroundColor Green
