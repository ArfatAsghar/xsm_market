$root = 'd:\Zain Project\xsm-market-revision'
$pkg = Join-Path $root 'deploy-package'
$zip = Join-Path $root 'xsm-market-deploy.zip'

if (Test-Path $pkg) { Remove-Item -Recurse -Force $pkg }
if (Test-Path $zip) { Remove-Item -Force $zip }

New-Item -ItemType Directory -Path $pkg | Out-Null

# Copy compiled dist files
Copy-Item -Recurse "$root\dist\*" $pkg

# Copy php-backend to api/ folder (exclude root-only htaccess files)
$apiDir = Join-Path $pkg 'api'
New-Item -ItemType Directory -Path $apiDir | Out-Null
Get-ChildItem -Path "$root\php-backend" -Recurse | Where-Object {
    if ($_.PSIsContainer) { return $false }
    if ($_.Name -eq '.htaccess' -or $_.Name -eq '.htaccess-api') { return $false }
    return $true
} | ForEach-Object {
    $rel = $_.FullName.Substring(("$root\php-backend").Length)
    $destPath = Join-Path $apiDir $rel
    $destDir = Split-Path $destPath -Parent
    if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item $_.FullName -Destination $destPath -Force
}

# Root .htaccess (React SPA + /api/* routing)
if (Test-Path "$root\php-backend\.htaccess") {
    Copy-Item "$root\php-backend\.htaccess" "$pkg\.htaccess"
}

# api/.htaccess (route requests inside api/ to index.php)
if (Test-Path "$root\php-backend\.htaccess-api") {
    Copy-Item "$root\php-backend\.htaccess-api" "$apiDir\.htaccess"
}

# Copy database schema
if (Test-Path "$root\database_schema_complete_clean.sql") {
    Copy-Item "$root\database_schema_complete_clean.sql" "$pkg\database_schema.sql"
}

# Write Hostinger Readme
$instructions = @"
=====================================================
  XSM MARKET - HOSTINGER DEPLOYMENT INSTRUCTIONS
=====================================================

1. UPLOAD & EXTRACT:
   - Upload the contents of this zip file into your Hostinger 'public_html' folder.
   - Ensure .htaccess is included (enable 'Show Hidden Files' in Hostinger File Manager).

2. DATABASE SETUP:
   - In Hostinger hPanel, go to 'MySQL Databases' and create a new database & database user.
   - Go to phpMyAdmin, select your database, and Import 'database_schema.sql'.

3. CONFIGURE ENVIRONMENT VARIABLES:
   - Edit 'api/config/env.php' or set environment variables in Hostinger with your database details:
       DB_HOST=localhost
       DB_NAME=your_db_name
       DB_USER=your_db_user
       DB_PASSWORD=your_db_password
       JWT_SECRET=your_secret_key
       SITE_URL=https://yourdomain.com

4. PERMISSIONS:
   - Ensure the 'api/uploads' directory has write permissions (0755).

5. ALL DONE!
   Your site is now ready at https://yourdomain.com
"@

$instructions | Out-File -Encoding UTF8 "$pkg\HOSTINGER_README.txt"

# Compress to zip
Compress-Archive -Path "$pkg\*" -DestinationPath $zip -Force

# Clean up staging directory
Remove-Item -Recurse -Force $pkg

$item = Get-Item $zip
Write-Host "SUCCESS: Created $zip ($([math]::Round($item.Length / 1MB, 2)) MB)"
