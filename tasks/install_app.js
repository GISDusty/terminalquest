/**
 * Installs the game bundle's dependencies (public/) exactly as locked in
 * public/package-lock.json, using `npm ci`.
 *
 * Run by the root `postinstall` hook (npm run install:app).
 *
 * It re-invokes the same npm that is running the parent script
 * (npm_execpath) instead of whatever `npm` is first on PATH. npm scripts put
 * every ancestor node_modules/.bin on PATH, so a stray old npm there (for
 * example npm 6 from a parent checkout's node_modules) would otherwise be
 * picked up; npm 6 does not understand the v3 lockfile and re-resolves
 * everything, pulling in cheerio versions that Electron 11 cannot run.
 *
 * To change a public/ dependency on purpose, run `npm install <pkg>` inside
 * public/ and commit the updated lockfile.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const cwd = path.join(__dirname, '..', 'public');
const execPath = process.env.npm_execpath;

const result = execPath
  ? spawnSync(process.execPath, [execPath, 'ci'], { cwd, stdio: 'inherit' })
  : spawnSync('npm', ['ci'], {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
