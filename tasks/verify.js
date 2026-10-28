/*
 * npm run verify
 *
 * One-command safety net:
 *   1. build:all must succeed
 *   2. npm test, with pass/fail counts (failures fail verify unless
 *      VERIFY_ALLOW_TEST_FAILURES=1)
 *   3. launch smoke test: start Electron with a remote-debugging port, wait for
 *      the "TerminalQuest" window, check the app rendered, collect console
 *      errors for a few seconds, save a screenshot via CDP, kill Electron.
 *
 * Env vars:
 *   VERIFY_PORT                    CDP port (default 9333)
 *   VERIFY_ALLOW_TEST_FAILURES=1   report test failures but do not fail verify
 *   VERIFY_STARTUP_TIMEOUT_MS      time to wait for window + app render (default 90000)
 *   VERIFY_CONSOLE_MS              time to collect console output (default 10000)
 *   VERIFY_STRICT_CONSOLE=1        fail verify on unexpected console errors
 *   VERIFY_SKIP_SMOKE=1            skip the launch smoke test
 *
 * The smoke test never sends input to any window. The save file
 * (<userData>/config.json) is backed up before launch and restored on exit,
 * including on failure and on SIGINT/SIGTERM.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync, execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'verify-output');
const port = parseInt(process.env.VERIFY_PORT || '9333', 10);
const startupTimeoutMs = parseInt(
  process.env.VERIFY_STARTUP_TIMEOUT_MS || '90000',
  10
);
const consoleMs = parseInt(process.env.VERIFY_CONSOLE_MS || '10000', 10);
const allowTestFailures = process.env.VERIFY_ALLOW_TEST_FAILURES === '1';
const strictConsole = process.env.VERIFY_STRICT_CONSOLE === '1';

// Known log noise that is not a regression signal.
const NOISE = [
  /Fontconfig/i,
  /cross-unzip/i,
  /Exited with code 9/i,
  /An error occurred: /, // electron-devtools-installer failure
  /contextIsolation/i,
  /Added Extension/i,
  /DevTools listening on/i,
  /Download the React DevTools/i,
  /vaapi_wrapper\.cc/, // Chromium VA-API probe stderr on Linux
  /quota_database\.cc/, // Chromium quota DB migration stderr
];
const isNoise = text => NOISE.some(re => re.test(text));

const summary = {
  build: null,
  tests: null,
  smoke: null,
  screenshot: null,
  consoleErrors: [],
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function log(msg) {
  console.log(`[verify] ${msg}`);
}

// ---------------------------------------------------------------------------
// Save file backup / restore
// ---------------------------------------------------------------------------

const userDataDir = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  'terminalquest'
);
const saveFile = path.join(userDataDir, 'config.json');
const backupDir = path.join(outDir, 'save-backup');
const backupFile = path.join(backupDir, 'config.json');
const backupMarker = path.join(backupDir, 'ABSENT');
let backupTaken = false;
let restored = false;

function backupSave() {
  fs.mkdirSync(backupDir, { recursive: true });
  if (fs.existsSync(saveFile)) {
    fs.copyFileSync(saveFile, backupFile);
    fs.rmSync(backupMarker, { force: true });
  } else {
    fs.rmSync(backupFile, { force: true });
    fs.writeFileSync(backupMarker, '');
  }
  backupTaken = true;
  log(`backed up save file (${saveFile}) to ${backupDir}`);
}

function restoreSave() {
  if (!backupTaken || restored) return;
  restored = true;
  try {
    if (fs.existsSync(backupFile)) {
      fs.copyFileSync(backupFile, saveFile);
    } else {
      fs.rmSync(saveFile, { force: true });
    }
    fs.rmSync(backupDir, { recursive: true, force: true });
    log('restored save file');
  } catch (err) {
    console.error(
      `[verify] FAILED to restore save file: ${err.message}. ` +
        `Backup is at ${backupFile}`
    );
  }
}

// ---------------------------------------------------------------------------
// Electron process management (kill by PID only)
// ---------------------------------------------------------------------------

let electronProc = null;

function killElectron() {
  if (!electronProc || electronProc.pid === undefined) return;
  const pid = electronProc.pid;
  electronProc = null;
  // Electron was started detached, so its PID is also its process group ID.
  // Signalling the negative PID reaches Electron's own helper processes
  // (zygote, GPU, renderer) and nothing else.
  try {
    process.kill(-pid, 'SIGTERM');
  } catch (err) {
    /* already gone */
  }
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      process.kill(-pid, 0);
    } catch (err) {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch (err) {
    /* already gone */
  }
}

function cleanup() {
  killElectron();
  restoreSave();
}

process.on('exit', cleanup);
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig =>
  process.on(sig, () => {
    cleanup();
    process.exit(130);
  })
);

// ---------------------------------------------------------------------------
// Step 1: build
// ---------------------------------------------------------------------------

function runBuild() {
  log('step 1/3: npm run build:all');
  const res = spawnSync('npm', ['run', 'build:all'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  summary.build = res.status === 0;
  return summary.build;
}

// ---------------------------------------------------------------------------
// Step 2: tests
// ---------------------------------------------------------------------------

function runTests() {
  log('step 2/3: npm test');
  fs.mkdirSync(outDir, { recursive: true });
  const res = spawnSync('npm', ['test'], {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  const output = `${res.stdout || ''}\n${res.stderr || ''}`;
  fs.writeFileSync(path.join(outDir, 'test.log'), output);

  const suites = output.match(/^Test Suites:\s*(.*)$/m);
  const tests = output.match(/^Tests:\s*(.*)$/m);
  const count = (line, word) => {
    const m = line && line.match(new RegExp(`(\\d+) ${word}`));
    return m ? parseInt(m[1], 10) : 0;
  };
  const total = count(tests && tests[1], 'total');
  const passed = count(tests && tests[1], 'passed');
  const failed = count(tests && tests[1], 'failed');
  const skipped = count(tests && tests[1], 'skipped');

  // Print the failing test names and the jest totals, not the whole log.
  output
    .split('\n')
    .filter(l => /^(PASS|FAIL) /.test(l) || /^\s+● .* › /.test(l))
    .forEach(l => console.log(l));
  if (suites) console.log(`Test Suites: ${suites[1]}`);
  if (tests) console.log(`Tests:       ${tests[1]}`);

  summary.tests = {
    passed,
    failed,
    skipped,
    total,
    suites: suites ? suites[1] : 'unknown',
    ok: res.status === 0 && total > 0,
    logFile: path.join(outDir, 'test.log'),
  };
  return summary.tests.ok;
}

// ---------------------------------------------------------------------------
// Step 3: launch smoke test over CDP
// ---------------------------------------------------------------------------

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error('timeout')));
  });
}

function hasTerminalQuestWindow() {
  try {
    const out = execFileSync('hyprctl', ['clients', '-j'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(out).some(c => c.class === 'terminalquest');
  } catch (err) {
    return false; // not running under Hyprland, nothing to wait for
  }
}

async function waitForFreeWindow() {
  const deadline = Date.now() + 15 * 60 * 1000;
  while (hasTerminalQuestWindow()) {
    if (Date.now() > deadline) {
      throw new Error('a terminalquest window stayed open for 15 minutes');
    }
    log('another terminalquest window is open, waiting 30 s');
    await sleep(30000);
  }
}

// Minimal CDP client over the `ws` package.
class Cdp {
  constructor(wsUrl) {
    const WebSocket = require('ws');
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    this.ws = new WebSocket(wsUrl, { perMessageDeflate: false });
    this.ready = new Promise((resolve, reject) => {
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
    });
    this.ws.on('message', data => {
      const msg = JSON.parse(data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        this.listeners.forEach(fn => fn(msg.method, msg.params));
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(fn) {
    this.listeners.push(fn);
  }

  close() {
    try {
      this.ws.close();
    } catch (err) {
      /* ignore */
    }
  }
}

async function evaluate(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });
  return res.result && res.result.value;
}

async function runSmoke() {
  log('step 3/3: launch smoke test');
  fs.mkdirSync(outDir, { recursive: true });
  await waitForFreeWindow();
  backupSave();

  const electronBin = require('electron');
  const electronLog = [];
  electronProc = spawn(
    electronBin,
    ['.', `--remote-debugging-port=${port}`],
    {
      cwd: rootDir,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  log(`launched electron pid ${electronProc.pid}, CDP port ${port}`);
  const collect = chunk =>
    chunk
      .toString()
      .split('\n')
      .filter(l => l.trim())
      .forEach(l => electronLog.push(l));
  electronProc.stdout.on('data', collect);
  electronProc.stderr.on('data', collect);
  let exited = false;
  electronProc.on('exit', () => (exited = true));

  // Wait for the target.
  const deadline = Date.now() + startupTimeoutMs;
  let target = null;
  while (Date.now() < deadline && !target) {
    if (exited) throw new Error('electron exited before the window appeared');
    try {
      const targets = await httpGetJson(`http://127.0.0.1:${port}/json`);
      target = targets.find(
        t => t.type === 'page' && t.title === 'TerminalQuest'
      );
    } catch (err) {
      /* endpoint not up yet */
    }
    if (!target) await sleep(500);
  }
  if (!target) throw new Error('no page titled TerminalQuest on the CDP endpoint');
  log(`found target "${target.title}"`);

  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.ready;

  const consoleProblems = [];
  cdp.on((method, params) => {
    if (method === 'Runtime.consoleAPICalled') {
      if (params.type === 'error' || params.type === 'assert') {
        const text = params.args
          .map(a => a.value !== undefined ? a.value : a.description || a.type)
          .join(' ');
        consoleProblems.push(`console.${params.type}: ${text}`);
      }
    } else if (method === 'Runtime.exceptionThrown') {
      const d = params.exceptionDetails;
      const text =
        (d.exception && (d.exception.description || d.exception.value)) ||
        d.text;
      consoleProblems.push(`exception: ${text}`);
    } else if (method === 'Log.entryAdded') {
      const e = params.entry;
      if (e.level === 'error') {
        consoleProblems.push(`log.error: ${e.text} (${e.url || ''})`);
      }
    }
  });
  // Runtime.enable and Log.enable replay messages buffered before we attached.
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.enable');

  // Wait until the document is complete and React has replaced the static
  // "Loading" placeholder with the app.
  const appExpr = `(function () {
    var app = document.getElementById('app');
    return {
      ready: document.readyState === 'complete',
      children: app ? app.children.length : 0,
      loading: !!document.querySelector('#app .__loading'),
      text: app ? app.innerText.slice(0, 200) : ''
    };
  })()`;
  let state = null;
  while (Date.now() < deadline) {
    if (exited) throw new Error('electron exited while loading');
    state = await evaluate(cdp, appExpr);
    if (state && state.ready && state.children > 0 && !state.loading) break;
    await sleep(500);
  }
  if (!state || !state.ready || state.children === 0 || state.loading) {
    cdp.close();
    throw new Error(
      `page never finished loading (state: ${JSON.stringify(state)})`
    );
  }
  log(`app rendered (#app has ${state.children} children)`);

  log(`collecting console output for ${consoleMs / 1000} s`);
  await sleep(consoleMs);

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const shotPath = path.join(outDir, 'smoke.png');
  fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
  summary.screenshot = shotPath;
  cdp.close();

  const unexpected = consoleProblems
    .concat(electronLog.filter(l => /error|exception/i.test(l)))
    .filter(l => !isNoise(l));
  summary.consoleErrors = Array.from(new Set(unexpected));
  fs.writeFileSync(
    path.join(outDir, 'electron.log'),
    electronLog.join('\n') + '\n'
  );
  summary.smoke = !(strictConsole && summary.consoleErrors.length > 0);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const buildOk = runBuild();
  if (!buildOk) {
    printSummary();
    return 1;
  }

  const testsOk = runTests();

  let smokeOk = true;
  if (process.env.VERIFY_SKIP_SMOKE === '1') {
    summary.smoke = 'skipped';
  } else {
    try {
      await runSmoke();
      smokeOk = summary.smoke === true;
    } catch (err) {
      console.error(`[verify] smoke test failed: ${err.message}`);
      summary.smoke = false;
      smokeOk = false;
    } finally {
      killElectron();
      restoreSave();
    }
  }

  printSummary();
  const testsPass = testsOk || allowTestFailures;
  return testsPass && smokeOk ? 0 : 1;
}

function printSummary() {
  const t = summary.tests;
  console.log('\n===== verify summary =====');
  console.log(`build:   ${summary.build ? 'OK' : 'FAILED'}`);
  if (t) {
    const ok = t.ok ? 'OK' : allowTestFailures ? 'FAILED (allowed)' : 'FAILED';
    console.log(
      `tests:   ${t.passed}/${t.total} passed, ${t.failed} failed ` +
        `(suites: ${t.suites}) ${ok}`
    );
    if (!t.ok) console.log(`         log: ${t.logFile}`);
  } else {
    console.log('tests:   not run');
  }
  const smoke =
    summary.smoke === 'skipped'
      ? 'skipped'
      : summary.smoke === true
      ? 'OK'
      : summary.smoke === false
      ? 'FAILED'
      : 'not run';
  console.log(`smoke:   ${smoke}`);
  if (summary.screenshot) console.log(`screenshot: ${summary.screenshot}`);
  console.log(
    `unexpected console errors: ${summary.consoleErrors.length}` +
      (strictConsole ? ' (strict)' : '')
  );
  summary.consoleErrors.slice(0, 10).forEach(e => console.log(`  - ${e.slice(0, 300)}`));
}

main().then(
  code => process.exit(code),
  err => {
    console.error(err);
    process.exit(1);
  }
);
