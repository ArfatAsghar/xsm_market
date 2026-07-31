$root = 'd:\Zain Project\xsm-market-revision'
$distZip = Join-Path $root 'dist-update.zip'
$phpZip = Join-Path $root 'php-backend-update.zip'
$tempPhp = Join-Path $root 'temp-php-pkg'

if (Test-Path $distZip) { Remove-Item -Force $distZip }
if (Test-Path $phpZip) { Remove-Item -Force $phpZip }
if (Test-Path $tempPhp) { Remove-Item -Recurse -Force $tempPhp }

# 1. Zip frontend dist
Compress-Archive -Path "$root\dist\*" -DestinationPath $distZip -Force

# 2. Copy php-backend except uploads folder
New-Item -ItemType Directory -Path $tempPhp | Out-Null

Get-ChildItem -Path "$root\php-backend" -Exclude "uploads" | Copy-Item -Destination $tempPhp -Recurse -Force

Compress-Archive -Path "$tempPhp\*" -DestinationPath $phpZip -Force
Remove-Item -Recurse -Force $tempPhp

$f1 = Get-Item $distZip
$f2 = Get-Item $phpZip
Write-Host "Frontend Update Zip: $($f1.FullName) ($([math]::Round($f1.Length/1KB, 2)) KB)"
Write-Host "Backend Update Zip: $($f2.FullName) ($([math]::Round($f2.Length/1KB, 2)) KB)"
