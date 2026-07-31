$root = 'd:\Zain Project\xsm-market-revision'
$pkg  = Join-Path $root 'clean-pkg'
$zip  = Join-Path $root 'xsm-market-deploy.zip'

if (Test-Path $pkg) { Remove-Item -Recurse -Force $pkg }
if (Test-Path $zip) { Remove-Item -Force $zip }

New-Item -ItemType Directory -Path $pkg | Out-Null

# 1. Copy dist (React build) to root of pkg
Copy-Item -Recurse "$root\dist\*" $pkg

# 2. Copy php-backend to api/ (exclude junk/sensitive files)
$apiDir = Join-Path $pkg 'api'
New-Item -ItemType Directory -Path $apiDir | Out-Null

$excludePatterns = @(
    '-complete\.php$', '-fixed\.php$', '-old\.php$', '-backup\.php$',
    '-clean\.php$', '-empty\.php$', '-new\.php$',
    '\.backup$', '\.bak$', '\.tmp$',
    '^\.env$', '^\.env\.'
)

Get-ChildItem -Path "$root\php-backend" -Recurse | Where-Object {
    $f = $_
    if ($f.PSIsContainer) { return $false }
    if ($f.FullName -match '\\uploads\\') { return $false }
    if ($f.FullName -match '\\logs\\') { return $false }
    # Exclude .htaccess files from the php-backend copy (we deploy root .htaccess separately below)
    if ($f.Name -eq '.htaccess' -or $f.Name -eq '.htaccess-api') { return $false }
    foreach ($pat in $excludePatterns) {
        if ($f.Name -match $pat) { return $false }
    }
    return $true
} | ForEach-Object {
    $rel      = $_.FullName.Substring(("$root\php-backend").Length)
    $destPath = Join-Path $apiDir $rel
    $destDir  = Split-Path $destPath -Parent
    if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item $_.FullName -Destination $destPath -Force
}

# 3. Deploy ROOT .htaccess (React SPA + /api/* routing)
if (Test-Path "$root\php-backend\.htaccess") {
    Copy-Item "$root\php-backend\.htaccess" "$pkg\.htaccess"
    Write-Host "Root .htaccess deployed OK"
} else {
    Write-Host "WARNING: php-backend\.htaccess not found!"
}

# 5. Ensure uploads directory exists
$apiUploads = Join-Path $apiDir 'uploads'
New-Item -ItemType Directory -Path $apiUploads -Force | Out-Null
Set-Content -Path (Join-Path $apiUploads '.gitkeep') -Value ''

# 6. Copy database schema if it exists
if (Test-Path "$root\database_schema_complete_clean.sql") {
    Copy-Item "$root\database_schema_complete_clean.sql" "$pkg\database_schema.sql"
    Write-Host "Database schema copied OK"
}

# 7. Write readme
$readme = "XSM MARKET - HOSTINGER DEPLOYMENT`r`n"
$readme += "Pre-configured for: xsmmarket.com`r`n"
$readme += "Database: u718696665_xsm_market_db`r`n`r`n"
$readme += "STEPS:`r`n"
$readme += "1. Upload zip to public_html/ in Hostinger File Manager`r`n"
$readme += "2. Extract (files go directly into public_html/)`r`n"
$readme += "3. Run: https://xsmmarket.com/unzip.php`r`n"
$readme += "4. Test DB: https://xsmmarket.com/api/db-setup.php`r`n"
$readme += "5. Test API: https://xsmmarket.com/api/check.php`r`n"
$readme += "6. Test routing: https://xsmmarket.com/api/route-test.php`r`n"
[System.IO.File]::WriteAllText("$pkg\HOSTINGER_README.txt", $readme)

# 8. Package into zip
Set-Location $pkg
tar -a -cf $zip *

Set-Location $root
Remove-Item -Recurse -Force $pkg

$item = Get-Item $zip
Write-Host ""
Write-Host "SUCCESS: xsm-market-deploy.zip ($([math]::Round($item.Length / 1MB, 2)) MB)"
Write-Host "Path: $zip"
