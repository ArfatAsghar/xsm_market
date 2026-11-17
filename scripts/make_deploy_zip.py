import os
import re
import sys
import zipfile

ROOT = r"d:\Zain Project\xsm-market-revision"
DIST_DIR = os.path.join(ROOT, "dist")
PHP_DIR = os.path.join(ROOT, "php-backend")
PUBLIC_DIR = os.path.join(ROOT, "public")
ZIP_PATH = os.path.join(ROOT, "xsm-market-deploy.zip")

EXCLUDE_REGEXES = [
    re.compile(r'-complete\.php$', re.I),
    re.compile(r'-fixed\.php$', re.I),
    re.compile(r'-old\.php$', re.I),
    re.compile(r'-backup\.php$', re.I),
    re.compile(r'-clean\.php$', re.I),
    re.compile(r'-empty\.php$', re.I),
    re.compile(r'-new\.php$', re.I),
    re.compile(r'\.backup$', re.I),
    re.compile(r'\.bak$', re.I),
    re.compile(r'\.tmp$', re.I),
    re.compile(r'^\.env\.local$', re.I),
    re.compile(r'Thumbs\.db$', re.I),
    re.compile(r'\.DS_Store$', re.I),
]

def should_exclude(rel_path, filename):
    if filename.startswith('.git'):
        return True
    if '/uploads/' in rel_path or rel_path.startswith('uploads/'):
        return True
    if '/logs/' in rel_path or rel_path.startswith('logs/'):
        return True
    # We add .htaccess and .env separately to avoid duplicates and ensure right version
    if filename in ('.htaccess', '.htaccess-api', '.env', '.env.example', '.env.production'):
        return True
    for rgx in EXCLUDE_REGEXES:
        if rgx.search(filename):
            return True
    return False

def build_zip():
    print(f"Building {ZIP_PATH} with 100% POSIX forward-slash paths (no backslashes, no duplicates)...")

    if os.path.exists(ZIP_PATH):
        os.remove(ZIP_PATH)

    added_entries = set()

    with zipfile.ZipFile(ZIP_PATH, 'w', compression=zipfile.ZIP_DEFLATED) as zf:

        # 1. Add dist/ (React front-end build) to root of zip
        print("Adding dist/ assets to root...")
        for root, dirs, files in os.walk(DIST_DIR):
            for file in files:
                # Skip .htaccess in dist if present (we will write public/.htaccess as canonical root .htaccess)
                if file == '.htaccess':
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, DIST_DIR).replace('\\', '/')
                if rel_path in added_entries:
                    continue
                assert '\\' not in rel_path, f"Backslash found in {rel_path}"
                zf.write(full_path, arcname=rel_path)
                added_entries.add(rel_path)

        # 2. Add canonical root .htaccess from public/.htaccess
        root_htaccess = os.path.join(PUBLIC_DIR, ".htaccess")
        if os.path.exists(root_htaccess) and ".htaccess" not in added_entries:
            print("Adding root .htaccess...")
            zf.write(root_htaccess, arcname=".htaccess")
            added_entries.add(".htaccess")

        # 3. Add php-backend to api/
        print("Adding php-backend to api/...")
        for root, dirs, files in os.walk(PHP_DIR):
            for file in files:
                full_path = os.path.join(root, file)
                rel_sub = os.path.relpath(full_path, PHP_DIR).replace('\\', '/')
                if should_exclude(rel_sub, file):
                    continue
                arcname = f"api/{rel_sub}".replace('\\', '/')
                assert '\\' not in arcname, f"Backslash found in {arcname}"
                if arcname not in added_entries:
                    zf.write(full_path, arcname=arcname)
                    added_entries.add(arcname)

        # 4. Add api/.htaccess from php-backend/.htaccess
        api_htaccess = os.path.join(PHP_DIR, ".htaccess")
        if os.path.exists(api_htaccess) and "api/.htaccess" not in added_entries:
            print("Adding api/.htaccess...")
            zf.write(api_htaccess, arcname="api/.htaccess")
            added_entries.add("api/.htaccess")

        # 5. Add api/.env and api/.env.production from php-backend/.env.production
        env_prod = os.path.join(PHP_DIR, ".env.production")
        if os.path.exists(env_prod):
            print("Adding api/.env, api/.env.example, and api/.env.production...")
            zf.write(env_prod, arcname="api/.env.production")
            zf.write(env_prod, arcname="api/.env.example")
            zf.write(env_prod, arcname="api/.env")
            added_entries.add("api/.env.production")
            added_entries.add("api/.env.example")
            added_entries.add("api/.env")

        # 6. Ensure api/uploads directory placeholder
        print("Adding api/uploads/.gitkeep...")
        zf.writestr("api/uploads/.gitkeep", "")
        added_entries.add("api/uploads/.gitkeep")

        # 7. Add database schema if present
        schema_path = os.path.join(ROOT, "database_schema_complete_clean.sql")
        if os.path.exists(schema_path) and "database_schema.sql" not in added_entries:
            print("Adding database_schema.sql...")
            zf.write(schema_path, arcname="database_schema.sql")
            added_entries.add("database_schema.sql")

        # 8. Add unzip.php utility with upload preservation and synchronization
        unzip_php_content = """<?php
$zipFile = __DIR__ . '/xsm-market-deploy.zip';
$extractTo = __DIR__;

if (!file_exists($zipFile)) {
    die("<h1>Error: xsm-market-deploy.zip not found</h1><p>Ensure xsm-market-deploy.zip is uploaded to the same directory as unzip.php.</p>");
}

$zip = new ZipArchive();
if ($zip->open($zipFile) === TRUE) {
    $zip->extractTo($extractTo);
    $zip->close();

    // Ensure upload directories exist with full read/write permissions
    $uploadsDirs = [
        $extractTo . '/uploads',
        $extractTo . '/api/uploads'
    ];
    $subfolders = ['ads', 'chat', 'kyc', 'avatars', 'temp'];

    foreach ($uploadsDirs as $baseDir) {
        if (!is_dir($baseDir)) @mkdir($baseDir, 0777, true);
        @chmod($baseDir, 0777);
        foreach ($subfolders as $sub) {
            $subPath = $baseDir . '/' . $sub;
            if (!is_dir($subPath)) @mkdir($subPath, 0777, true);
            @chmod($subPath, 0777);
        }
    }

    // Bidirectional sync between root uploads and api/uploads so no uploaded images are ever lost
    $rootUploads = $extractTo . '/uploads';
    $apiUploads = $extractTo . '/api/uploads';
    foreach ($subfolders as $sub) {
        $rSub = $rootUploads . '/' . $sub;
        $aSub = $apiUploads . '/' . $sub;
        if (is_dir($rSub) && is_dir($aSub)) {
            $rFiles = glob($rSub . '/*');
            if ($rFiles) {
                foreach ($rFiles as $f) {
                    if (is_file($f)) {
                        $target = $aSub . '/' . basename($f);
                        if (!file_exists($target)) @copy($f, $target);
                    }
                }
            }
            $aFiles = glob($aSub . '/*');
            if ($aFiles) {
                foreach ($aFiles as $f) {
                    if (is_file($f)) {
                        $target = $rSub . '/' . basename($f);
                        if (!file_exists($target)) @copy($f, $target);
                    }
                }
            }
        }
    }

    echo "<h1>Successfully Extracted xsm-market-deploy.zip!</h1><p>Your site has been updated and user uploads have been safely preserved. You can now delete unzip.php and xsm-market-deploy.zip.</p>";
} else {
    echo "<h1>Failed to extract xsm-market-deploy.zip</h1><p>Check PHP ZipArchive extension status or file permissions.</p>";
}
?>"""
        print("Adding unzip.php...")
        zf.writestr("unzip.php", unzip_php_content)
        added_entries.add("unzip.php")

        # 9. Add HOSTINGER_README.txt
        readme_content = """XSM MARKET - HOSTINGER DEPLOYMENT PACKAGE
Pre-configured for: xsmmarket.com
Database: u718696665_xsm_market_db

CONTENTS:
- Root: React SPA build (index.html, assets/, images/, favicons, root .htaccess)
- api/: Backend PHP API (/api/index.php, controllers, models, routes, config)
- api/.htaccess: Protects .env and routes API requests internally
- unzip.php: Optional web extraction helper (with upload preservation)
- database_schema.sql: Clean SQL database schema

CRITICAL - PRESERVE USER UPLOADS:
DO NOT delete the uploads/ or api/uploads/ directories when updating!
All user-uploaded listing screenshots, KYC documents, and chat images are stored in uploads/.
Simply upload and extract xsm-market-deploy.zip directly into public_html/ (choosing to overwrite files if prompted).

EXTRACTION STEPS:
1. Upload xsm-market-deploy.zip to public_html/ in Hostinger File Manager
2. Extract directly inside public_html/ (all entries use forward slashes for clean POSIX directory extraction)
   OR upload unzip.php and run: https://xsmmarket.com/unzip.php
3. Verify .env settings in public_html/api/.env
4. Done! React SPA, /api endpoints, and user uploads are immediately live.
"""
        print("Adding HOSTINGER_README.txt...")
        zf.writestr("HOSTINGER_README.txt", readme_content)
        added_entries.add("HOSTINGER_README.txt")

    # 10. Audit zip archive for any backslashes and duplicates
    print("\nAuditing created zip file for backslash entries and duplicates...")
    seen = set()
    backslash_count = 0
    duplicate_count = 0
    total_count = 0

    with zipfile.ZipFile(ZIP_PATH, 'r') as zf:
        for info in zf.infolist():
            total_count += 1
            if '\\' in info.filename:
                print(f"ERROR: Found backslash in entry: {info.filename}")
                backslash_count += 1
            if info.filename in seen:
                print(f"ERROR: Duplicate entry: {info.filename}")
                duplicate_count += 1
            seen.add(info.filename)

    size_mb = os.path.getsize(ZIP_PATH) / (1024 * 1024)
    print(f"\n==========================================")
    print(f"Total entries in zip: {total_count}")
    print(f"Entries with '\\' (backslash): {backslash_count}")
    print(f"Duplicate entries: {duplicate_count}")
    print(f"Zip file size: {size_mb:.2f} MB")
    print(f"Zip file location: {ZIP_PATH}")
    print(f"==========================================")

    if backslash_count > 0 or duplicate_count > 0:
        print("FAIL: Verification failed!")
        sys.exit(1)
    else:
        print("PASS: Zip package is 100% clean with ZERO backslash files and ZERO duplicates!")

if __name__ == '__main__':
    build_zip()
