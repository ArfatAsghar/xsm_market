import os
import zipfile
import sys
import shutil

ROOT_DIR = os.path.abspath(os.path.dirname(__file__) + "/..")
DIST_DIR = os.path.join(ROOT_DIR, "dist")
PHP_BACKEND_DIR = os.path.join(ROOT_DIR, "php-backend")

OUTPUT_ZIPS = [
    os.path.join(ROOT_DIR, "xsm-market-deploy.zip"),
    os.path.join(ROOT_DIR, "xsm-dmarket-deploy.zip"),
]

# Ensure uploads subdirectories exist with .gitkeep
uploads_dir = os.path.join(PHP_BACKEND_DIR, "uploads")
for sub in ["chat", "ads", "avatars", "temp"]:
    sub_path = os.path.join(uploads_dir, sub)
    os.makedirs(sub_path, exist_ok=True)
    gitkeep = os.path.join(sub_path, ".gitkeep")
    if not os.path.exists(gitkeep):
        with open(gitkeep, "w") as f:
            f.write("")

# Files and extensions to exclude
EXCLUDE_EXTS = {".log", ".tmp", ".swp", ".bak", ".backup"}
EXCLUDE_NAMES = {
    ".DS_Store", "Thumbs.db", "__pycache__", ".git", ".gitignore",
    "image.png", "debug-check.php", "route-test.php", "check.php", "deals-test.php",
    "create-deals-table.php", "deal-agree.php", "DealController.php",
    ".env", ".env.development", "create.php"
}

def should_exclude_file(filename):
    f_lower = filename.lower()
    if f_lower in EXCLUDE_NAMES or filename in EXCLUDE_NAMES:
        return True
    if any(f_lower.endswith(ext) for ext in EXCLUDE_EXTS):
        return True
    # Exclude development backup/duplicate variants
    backup_suffixes = (
        '-backup.php', '-old.php', '-complete.php', '-fixed.php',
        '-clean.php', '-empty.php', '-new.php', '.backup'
    )
    if any(f_lower.endswith(s) for s in backup_suffixes):
        return True
    return False

def add_bytes_to_zip(zf, data, arcname, is_dir=False):
    clean_arcname = arcname.replace("\\", "/").strip("/")
    if is_dir:
        clean_arcname += "/"
    if "\\" in clean_arcname:
        raise ValueError(f"Backslash detected in arcname: {clean_arcname}")
    
    zinfo = zipfile.ZipInfo(clean_arcname)
    zinfo.date_time = (2026, 9, 10, 4, 30, 0)
    zinfo.compress_type = zipfile.ZIP_DEFLATED
    
    if is_dir:
        zinfo.external_attr = (0o755 << 16) | 0x10
        zf.writestr(zinfo, b"")
    else:
        zinfo.external_attr = 0o644 << 16
        zf.writestr(zinfo, data)

def add_file_to_zip(zf, file_path, arcname):
    with open(file_path, "rb") as f:
        data = f.read()
    add_bytes_to_zip(zf, data, arcname, is_dir=False)

def add_dir_to_zip(zf, dir_arcname):
    add_bytes_to_zip(zf, b"", dir_arcname, is_dir=True)

def build_zip(zip_path):
    zip_name = os.path.basename(zip_path)
    print(f"\n==========================================")
    print(f"Building {zip_name}...")
    print(f"==========================================")
    
    if os.path.exists(zip_path):
        os.remove(zip_path)
    
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        # 1. Add dist/ files to root of zip
        print("  -> Adding frontend dist files to root of zip...")
        for root, dirs, files in os.walk(DIST_DIR):
            dirs.sort()
            files.sort()
            rel_dir = os.path.relpath(root, DIST_DIR).replace("\\", "/")
            if rel_dir != ".":
                add_dir_to_zip(zf, rel_dir)
            for f in files:
                if should_exclude_file(f):
                    continue
                file_path = os.path.join(root, f)
                rel_file = os.path.relpath(file_path, DIST_DIR).replace("\\", "/")
                add_file_to_zip(zf, file_path, rel_file)

        # 2. Add helper unzip.php to root of zip
        unzip_php_code = """<?php
$zipFile = __DIR__ . '/xsm-market-deploy.zip';
$extractTo = __DIR__;

if (!file_exists($zipFile)) {
    die("<h1>Error: xsm-market-deploy.zip not found</h1><p>Ensure xsm-market-deploy.zip is uploaded to the same directory as unzip.php.</p>");
}

$zip = new ZipArchive();
if ($zip->open($zipFile) === TRUE) {
    $zip->extractTo($extractTo);
    $zip->close();
    echo "<h1>Successfully Extracted xsm-market-deploy.zip!</h1><p>Your site has been updated. You can now delete unzip.php and xsm-market-deploy.zip.</p>";
} else {
    echo "<h1>Failed to extract xsm-market-deploy.zip</h1><p>Check PHP ZipArchive extension status or file permissions.</p>";
}
?>"""
        add_bytes_to_zip(zf, unzip_php_code.encode("utf-8"), "unzip.php")

        # 3. Add php-backend/ files to php-backend/ in zip
        print("  -> Adding php-backend files...")
        add_dir_to_zip(zf, "php-backend")
        
        # Load production env content if present
        prod_env_path = os.path.join(PHP_BACKEND_DIR, ".env.production")
        prod_env_bytes = None
        if os.path.exists(prod_env_path):
            with open(prod_env_path, "rb") as pf:
                prod_env_bytes = pf.read()

        for root, dirs, files in os.walk(PHP_BACKEND_DIR):
            dirs.sort()
            files.sort()
            rel_dir = os.path.relpath(root, PHP_BACKEND_DIR).replace("\\", "/")
            if rel_dir != ".":
                add_dir_to_zip(zf, f"php-backend/{rel_dir}")
            for f in files:
                if should_exclude_file(f):
                    continue
                file_path = os.path.join(root, f)
                rel_file = f"php-backend/{os.path.relpath(file_path, PHP_BACKEND_DIR).replace(chr(92), '/')}"
                
                # If packaging .env, use production env content
                if f == ".env" and prod_env_bytes is not None:
                    add_bytes_to_zip(zf, prod_env_bytes, rel_file)
                else:
                    add_file_to_zip(zf, file_path, rel_file)

    # 4. Strict Verification
    print(f"  -> Verifying {zip_name} entries for 100% POSIX compliance...")
    with zipfile.ZipFile(zip_path, "r") as zf:
        namelist = zf.namelist()
        backslash_entries = [name for name in namelist if "\\" in name]
        if backslash_entries:
            print(f"[ERROR] Found {len(backslash_entries)} entries containing backslashes:")
            for name in backslash_entries[:10]:
                print(f"    {name}")
            sys.exit(1)
        
        file_count = len([n for n in namelist if not n.endswith('/')])
        dir_count = len([n for n in namelist if n.endswith('/')])
        size_mb = os.path.getsize(zip_path) / (1024 * 1024)
        print(f"[SUCCESS] PASSED VERIFICATION:")
        print(f"    - Total entries: {len(namelist)} ({file_count} files, {dir_count} directories)")
        print(f"    - Backslash entries: 0 (100% forward-slash POSIX compatible)")
        print(f"    - Size: {size_mb:.2f} MB ({os.path.getsize(zip_path):,} bytes)")

def main():
    for zp in OUTPUT_ZIPS:
        build_zip(zp)
    print("\n[DONE] Deployment zip archives successfully built and ready for Hostinger!\n")

if __name__ == "__main__":
    main()
