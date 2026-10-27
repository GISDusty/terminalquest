'use strict';
// Helpers for validators that compile and run Rust: find the toolchain, run a
// program with a hard timeout, and make its output safe to show as HTML.
//
// Written for Node 12 (the Node inside Electron 11): no `?.`, no `??`, no
// fs.rm. It also runs on Node 18.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const IS_WINDOWS = process.platform === 'win32';
const MAX_OUTPUT_BYTES = 64 * 1024; // per stream, counted in characters
const MAX_FEEDBACK_CHARS = 3000; // what the learner sees at most

// ---------------------------------------------------------------------------
// Output that is safe to put in helper.fail / helper.success
// ---------------------------------------------------------------------------

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Removes ANSI colour/cursor codes such as "\x1b[1m\x1b[31merror\x1b[0m".
function stripAnsi(text) {
  return String(text).replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '');
}

function truncate(text, max) {
  const s = String(text);
  if (s.length <= max) return s;
  return s.slice(0, max) + '\n... (output cut off)';
}

// Order matters: strip, then truncate, then escape. Truncating after escaping
// could cut an entity such as "&lt;" in half.
function formatOutput(text, max = MAX_FEEDBACK_CHARS) {
  return '<pre>' + escapeHtml(truncate(stripAnsi(text).trim(), max)) + '</pre>';
}

// ---------------------------------------------------------------------------
// Running a program: args array, hard timeout, kill the whole process tree
// ---------------------------------------------------------------------------

function killTree(child) {
  if (!child || !child.pid) return;
  try {
    if (IS_WINDOWS) {
      // /T kills the children too, /F forces it.
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.on('error', () => {
        try {
          child.kill();
        } catch (e) {
          /* already gone */
        }
      });
    } else {
      // The child was started with detached: true, so it leads its own
      // process group and -pid reaches cargo's children (rustc, the program).
      process.kill(-child.pid, 'SIGKILL');
    }
  } catch (e) {
    try {
      child.kill('SIGKILL');
    } catch (e2) {
      /* already gone */
    }
  }
}

/**
 * Run `file` with an args array (never a shell string). Always resolves, and
 * exactly once, with:
 *   { stdout, stderr, code, signal, timedOut, truncated, error }
 * `error` is set when the program could not be started (for example ENOENT).
 * On a timeout, or if the program prints more than maxBytes on one stream, the
 * process tree is killed and the promise resolves right away.
 */
function runProcess(file, args, options = {}) {
  const { cwd, env, timeoutMs = 20000, maxBytes = MAX_OUTPUT_BYTES } = options;

  return new Promise(resolve => {
    let settled = false;
    let timer = null;
    let child = null;
    let stdout = '';
    let stderr = '';
    let truncated = false;

    const finish = extra => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(
        Object.assign(
          {
            stdout,
            stderr,
            code: null,
            signal: null,
            timedOut: false,
            truncated,
            error: null,
          },
          extra
        )
      );
    };

    try {
      child = spawn(file, args, {
        cwd,
        env,
        detached: !IS_WINDOWS,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (error) {
      finish({ error });
      return;
    }

    const collect = which => chunk => {
      if (settled) return;
      const room = maxBytes - (which === 'out' ? stdout : stderr).length;
      const text = String(chunk);
      if (text.length > room) {
        truncated = true;
        if (which === 'out') stdout += text.slice(0, Math.max(room, 0));
        else stderr += text.slice(0, Math.max(room, 0));
        killTree(child);
        finish({ truncated: true });
        return;
      }
      if (which === 'out') stdout += text;
      else stderr += text;
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', collect('out'));
    child.stderr.on('data', collect('err'));

    child.on('error', error => finish({ error }));
    child.on('close', (code, signal) => finish({ code, signal }));

    timer = setTimeout(() => {
      killTree(child);
      finish({ timedOut: true });
    }, timeoutMs);
  });
}

// ---------------------------------------------------------------------------
// Finding rustc / cargo
// ---------------------------------------------------------------------------

function exeName(tool) {
  return IS_WINDOWS ? tool + '.exe' : tool;
}

// What the learner pasted: trim, drop quotes, expand "~".
function normalizePath(raw) {
  if (!raw) return '';
  let p = String(raw).trim().replace(/^["']|["']$/g, '');
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
    p = path.join(os.homedir(), p.slice(1));
  }
  return p;
}

// Same, for a tool: if the learner pasted the folder that holds the tool, add
// the file name.
function normalizeToolPath(raw, tool) {
  let p = normalizePath(raw);
  if (!p) return '';
  try {
    if (fs.statSync(p).isDirectory()) p = path.join(p, exeName(tool));
  } catch (e) {
    /* not there; the version check will report it */
  }
  return p;
}

// A copy of the environment with the tool's own folder at the front of PATH,
// so cargo can find rustc and rustup's proxies can find rustup.
function toolEnv(toolPath, baseEnv = process.env) {
  const env = Object.assign({}, baseEnv);
  if (!path.isAbsolute(toolPath)) return env;
  const key =
    Object.keys(env).find(k => k.toUpperCase() === 'PATH') ||
    (IS_WINDOWS ? 'Path' : 'PATH');
  env[key] = path.dirname(toolPath) + path.delimiter + (env[key] || '');
  return env;
}

/**
 * Look for `tool` ("rustc" or "cargo"), in this order:
 *   1. PATH                   (spawn resolves the bare name)
 *   2. ~/.cargo/bin/<tool>    (where rustup installs it)
 *   3. $CARGO_HOME/bin/<tool>
 *   4. options.pasted         (a path the learner typed into a field)
 * A candidate counts only if `<tool> --version` exits 0 within 5 s and prints
 * "<tool> <number>.<number>...".
 * Resolves to { path, version, tried }; `path` is null when nothing worked.
 * options.env and options.homedir exist so tests can fake an environment.
 */
async function findTool(tool, options = {}) {
  const env = options.env || process.env;
  const home = options.homedir || os.homedir();
  const exe = exeName(tool);

  const candidates = [exe, path.join(home, '.cargo', 'bin', exe)];
  if (env.CARGO_HOME) candidates.push(path.join(env.CARGO_HOME, 'bin', exe));
  const pasted = normalizeToolPath(options.pasted, tool);
  if (pasted) candidates.push(pasted);

  const tried = [];
  const seen = new Set();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);

    // An absolute path that is not there needs no process.
    if (path.isAbsolute(candidate) && !fs.existsSync(candidate)) {
      tried.push(candidate + ' (not found)');
      continue;
    }

    const result = await runProcess(candidate, ['--version'], {
      env,
      timeoutMs: 5000,
    });
    const first = result.stdout.trim().split('\n')[0];
    const pattern = new RegExp('^' + tool + ' \\d+\\.\\d+');
    if (!result.error && !result.timedOut && result.code === 0 && pattern.test(first)) {
      return { path: candidate, version: first, tried };
    }
    tried.push(
      candidate +
        (result.error
          ? ' (' + (result.error.code || result.error.message) + ')'
          : result.timedOut
          ? ' (timed out)'
          : ' (did not look like ' + tool + ')')
    );
  }
  return { path: null, version: null, tried };
}

function removeDir(dir) {
  try {
    if (fs.rmSync) fs.rmSync(dir, { recursive: true, force: true });
    else fs.rmdirSync(dir, { recursive: true }); // Node 12
  } catch (e) {
    /* the OS cleans its temp folder eventually */
  }
}

module.exports = {
  IS_WINDOWS,
  escapeHtml,
  stripAnsi,
  truncate,
  formatOutput,
  killTree,
  runProcess,
  exeName,
  normalizePath,
  normalizeToolPath,
  toolEnv,
  findTool,
  removeDir,
};
