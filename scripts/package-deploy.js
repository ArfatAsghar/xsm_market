import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = path.resolve('.');
const DEPLOY_DIR = path.join(ROOT_DIR, 'deploy-temp');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const BACKEND_DIR = path.join(ROOT_DIR, 'php-backend');

function zipDirectory(sourceDir, outPath) {
  const pyCode = `
import zipfile, os, sys

source_dir = sys.argv[1]
out_path = sys.argv[2]

with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(source_dir):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, source_dir).replace('\\\\', '/')
            zipf.write(full_path, rel_path)
`;
  const tempScript = path.join(ROOT_DIR, 'scripts', 'zip-posix-helper.py');
  fs.writeFileSync(tempScript, pyCode);
  try {
    execSync(`python "${tempScript}" "${sourceDir}" "${outPath}"`, { stdio: 'inherit' });
  } finally {
    if (fs.existsSync(tempScript)) {
      fs.removeSync(tempScript);
    }
  }
}

function shouldCleanFile(filename) {
  const lowerName = filename.toLowerCase();
  
  // Suffix checks for development backups
  if (
    lowerName.endsWith('-complete.php') ||
    lowerName.endsWith('-backup.php') ||
    lowerName.endsWith('-clean.php') ||
    lowerName.endsWith('-fixed.php') ||
    lowerName.endsWith('-complex.php') ||
    lowerName.endsWith('-simple.php') ||
    lowerName.endsWith('.backup')
  ) {
    return true;
  }
  
  // Prefix checks for test/dev scripts
  if (
    lowerName.startsWith('test-') ||
    lowerName.startsWith('debug-') ||
    lowerName.startsWith('check-') ||
    lowerName.startsWith('verify-') ||
    lowerName.startsWith('migrate-') ||
    lowerName.startsWith('run_')
  ) {
    return true;
  }
  
  // Specific files not needed in production
  const exactMatches = [
    'setup-admin.php',
    'set-user-admin.php',
    'simple-delete.php',
    'delete.php',
    'server.php',
    'index-complete.php',
    'hybrid-router.php',
    'router-manager.php'
  ];
  
  if (exactMatches.includes(lowerName)) {
    return true;
  }
  
  return false;
}

async function cleanDirectoryRecursive(dir) {
  const items = await fs.readdir(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      await cleanDirectoryRecursive(fullPath);
    } else {
      if (shouldCleanFile(item)) {
        await fs.remove(fullPath);
      }
    }
  }
}

async function main() {
  try {
    console.log('🧹 Cleaning old deployment folders...');
    await fs.remove(DEPLOY_DIR);
    const oldZip = path.join(ROOT_DIR, 'xsm-market-deploy.zip');
    if (await fs.pathExists(oldZip)) {
      await fs.remove(oldZip);
    }

    console.log('📦 Creating fresh deploy-temp directory...');
    await fs.ensureDir(DEPLOY_DIR);

    // 1. Always build fresh frontend
    console.log('🔨 Building fresh frontend bundle...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✨ Copying frontend dist files to deploy root...');
    await fs.copy(DIST_DIR, DEPLOY_DIR);

    // 2. Copy PHP Backend to api/ subdirectory
    const deployApiDir = path.join(DEPLOY_DIR, 'api');
    console.log('✨ Copying php-backend to api/ directory...');
    await fs.copy(BACKEND_DIR, deployApiDir);

    // 3. Clean development env and key copies
    console.log('🧼 Cleaning up development-only and backup files...');
    const envFile = path.join(deployApiDir, '.env');
    const localEnvDev = path.join(deployApiDir, '.env.development');
    const localEnvExample = path.join(deployApiDir, '.env.example');
    
    await fs.remove(envFile); // Remove local development .env
    await fs.remove(localEnvDev);
    await fs.remove(localEnvExample);

    // 4. Swap .env.production to .env
    const envProdFile = path.join(deployApiDir, '.env.production');
    if (await fs.pathExists(envProdFile)) {
      console.log('🚀 Swapping .env.production to .env for Hostinger...');
      await fs.copy(envProdFile, envFile);
      await fs.remove(envProdFile);
    } else {
      throw new Error('.env.production was not found in php-backend folder!');
    }

    // 4.5 Copy .htaccess to the root of deploy-temp and delete from api/ folder
    const rootHtaccess = path.join(BACKEND_DIR, '.htaccess');
    const deployHtaccess = path.join(DEPLOY_DIR, '.htaccess');
    if (await fs.pathExists(rootHtaccess)) {
      console.log('🚀 Copying .htaccess to deploy root...');
      await fs.copy(rootHtaccess, deployHtaccess);
      await fs.remove(path.join(deployApiDir, '.htaccess'));
    }

    // 5. Clean up other files in the backend subfolder recursively
    await cleanDirectoryRecursive(deployApiDir);

    // 6. Remove the legacy api/ subdirectory inside api/ (contains old standalone scripts)
    const nestedApiDir = path.join(deployApiDir, 'api');
    if (await fs.pathExists(nestedApiDir)) {
      console.log('🗑️  Removing legacy nested api/ directory...');
      await fs.remove(nestedApiDir);
    }

    console.log('🤐 Zipping deployment package with POSIX paths for Hostinger compatibility...');
    const targetZipPath = path.join(ROOT_DIR, 'xsm-market-deploy.zip');
    await zipDirectory(DEPLOY_DIR, targetZipPath);

    console.log('✅ Deployment structure successfully packaged and zipped in xsm-market-deploy.zip');
  } catch (error) {
    console.error('❌ Packaging failed:', error);
    process.exit(1);
  }
}

main();
