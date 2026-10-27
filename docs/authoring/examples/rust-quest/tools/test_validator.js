'use strict';
// Test the rust_hello validator without starting the game.
//
//   node tools/test_validator.js                 uses the real rustc it finds
//   node tools/test_validator.js --fake          uses tools/fake_rustc.sh (no Rust needed)
//   node tools/test_validator.js --rustc <path>  uses that rustc
//
// Run it from the rust-quest folder. POSIX only for the process checks
// (it uses pgrep); on Windows those checks are skipped.
const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const validatorPath = path.join(
  root,
  'levels/rust_intro/objectives/rust_hello/validator.js'
);
const tools = require(path.join(root, 'scripts/rustTools.js'));

const args = process.argv.slice(2);
const useFake = args.includes('--fake');
const rustcFlag = args.includes('--rustc') ? args[args.indexOf('--rustc') + 1] : '';
const fakeRustc = path.join(__dirname, 'fake_rustc.sh');
const rustcPath = useFake ? fakeRustc : rustcFlag;

// Short timeouts so the hang cases finish quickly.
process.env.TQ_RUST_RUN_TIMEOUT_MS = '2000';
process.env.TQ_RUST_COMPILE_TIMEOUT_MS = '2000';

// --- a stand-in for the game's ValidationHelper (see docs/authoring/validator.md)
function makeHelper(fields) {
  const validationFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) validationFields[k] = String(v).trim();
  }
  const reports = [];
  return {
    validationFields,
    env: {},
    reports,
    success: message => reports.push({ result: 'success', message }),
    fail: error =>
      reports.push({
        result: 'fail',
        message: typeof error === 'string' ? error : error.message,
      }),
  };
}

async function runCase(fields) {
  const helper = makeHelper(fields);
  const started = Date.now();
  let threw = null;
  try {
    await require(validatorPath)(helper);
  } catch (e) {
    threw = e;
  }
  return { helper, threw, ms: Date.now() - started };
}

// The feedback is inserted as HTML. After removing the tags we use ourselves,
// no raw < or > may remain.
function assertSafeHtml(message) {
  const rest = message.replace(/<\/?(pre|p|code|strong|br)\s*\/?>/g, '');
  assert.ok(!/[<>]/.test(rest), 'unescaped < or > in feedback: ' + rest.slice(0, 200));
}

function survivors(pattern) {
  if (process.platform === 'win32') return [];
  try {
    return execFileSync('pgrep', ['-f', pattern], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch (e) {
    return []; // pgrep exits 1 when nothing matches
  }
}

function tempLeftovers() {
  return fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('tq-rust-'));
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tqtest-'));
  const write = (name, text) => {
    const p = path.join(dir, name);
    fs.writeFileSync(p, text);
    return p;
  };
  const good = write('good.rs', 'fn main() {\n    println!("Hello, TerminalQuest!");\n}\n');
  const wrong = write('wrong.rs', 'fn main() {\n    println!("Hello, World!");\n}\n');
  const bad = write('bad.rs', 'fn main() {\n    let x: Vec<u8> = "oops";\n    println!("{:?}", x);\n}\n');
  const spin = write('spin.rs', 'fn main() {\n    loop {}\n}\n');
  const hang = write('hang.rs', '// hang_compiler\nfn main() {}\n');
  const notes = write('notes.txt', 'not rust\n');

  const rustc = rustcPath ? { rustcPath } : {};
  const before = tempLeftovers();
  let failures = 0;
  const check = (name, ok, detail) => {
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`);
  };

  // [name, fields, expected result, text the feedback must contain, extra check]
  const cases = [
    ['1 empty input', { sourcePath: '' }, 'fail', 'Paste the full path'],
    ['2 missing file', { sourcePath: path.join(dir, 'nope.rs') }, 'fail', 'could not find a file'],
    ['3 not a .rs file', { sourcePath: notes }, 'fail', 'does not end in'],
    ['3b a folder', { sourcePath: dir }, 'fail', 'is a folder'],
    ['4 compile error', { sourcePath: bad, ...rustc }, 'fail', 'did not compile', m => {
      assert.ok(m.includes('Vec&lt;u8&gt;'), 'expected escaped Vec&lt;u8&gt;');
      assert.ok(!m.includes('\u001b'), 'ANSI codes were not stripped');
    }],
    ['5 wrong text', { sourcePath: wrong, ...rustc }, 'fail', 'did not print', m =>
      assert.ok(m.includes('Hello, World!'), 'should show what it printed')],
    ['6 infinite loop', { sourcePath: spin, ...rustc }, 'fail', 'still running', (m, r) =>
      assert.ok(r.ms < 10000, 'took ' + r.ms + ' ms')],
    ['7 correct program', { sourcePath: good, ...rustc }, 'success', 'Hello, TerminalQuest!'],
    ['7b quoted path with spaces', { sourcePath: `  "${good}"  `, ...rustc }, 'success', 'Hello'],
  ];
  if (useFake) {
    cases.push(['8 compiler hangs (stand-in only)', { sourcePath: hang, ...rustc }, 'fail', 'Compiling took longer']);
  }

  const needsRustc = n => /^[4-8]/.test(n);
  for (const [name, fields, expected, text, extra] of cases) {
    if (needsRustc(name) && !rustcPath) {
      const found = await tools.findTool('rustc');
      if (!found.path) {
        console.log(`skip ${name}: no rustc found (use --fake or --rustc <path>)`);
        continue;
      }
    }
    const r = await runCase(fields);
    const reports = r.helper.reports;
    let ok = !r.threw && reports.length === 1 && reports[0].result === expected;
    let detail = r.threw ? 'threw ' + r.threw : reports.length ? reports[0].result : 'no report';
    try {
      if (ok) {
        assert.ok(reports[0].message.includes(text), `message lacks "${text}"`);
        assertSafeHtml(reports[0].message);
        if (extra) extra(reports[0].message, r);
      }
    } catch (e) {
      ok = false;
      detail += ' (' + e.message + ')';
    }
    check(name, ok, `${detail}, ${r.ms} ms`);
    if (!ok && reports[0]) console.log('     message: ' + reports[0].message.replace(/\s+/g, ' ').slice(0, 300));
  }

  // No process may survive, and every temp folder must be gone.
  const left = survivors('tq-rust-').concat(survivors('sleep 7331'));
  check('no orphan processes (pgrep tq-rust-, sleep 7331)', left.length === 0, left.join(',') || 'none');
  const leftovers = tempLeftovers().filter(n => !before.includes(n));
  check('no temp folders left behind', leftovers.length === 0, leftovers.join(',') || 'none');

  // Locate logic, with a fake home and PATH so the result does not depend on this machine.
  if (useFake && process.platform !== 'win32') {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tqhome-'));
    const placeFake = (...parts) => {
      const bin = path.join(home, ...parts);
      fs.mkdirSync(bin, { recursive: true });
      fs.copyFileSync(fakeRustc, path.join(bin, 'rustc'));
      fs.chmodSync(path.join(bin, 'rustc'), 0o755);
      return path.join(bin, 'rustc');
    };
    const emptyEnv = { PATH: '' };
    let r = await tools.findTool('rustc', { env: emptyEnv, homedir: home });
    check('locate: nothing found -> null, tried list', r.path === null && r.tried.length >= 2, r.tried.join(' | '));
    const inHome = placeFake('.cargo', 'bin');
    r = await tools.findTool('rustc', { env: emptyEnv, homedir: home });
    check('locate: ~/.cargo/bin', r.path === inHome, r.path);
    tools.removeDir(path.join(home, '.cargo'));
    const cargoHome = path.join(home, 'elsewhere');
    const inCargoHome = placeFake('elsewhere', 'bin');
    r = await tools.findTool('rustc', { env: { PATH: '', CARGO_HOME: cargoHome }, homedir: home });
    check('locate: CARGO_HOME', r.path === inCargoHome, r.path);
    r = await tools.findTool('rustc', { env: { PATH: path.dirname(inCargoHome) }, homedir: path.join(home, 'none') });
    check('locate: PATH first', r.path === 'rustc', r.path);
    r = await tools.findTool('rustc', { env: emptyEnv, homedir: path.join(home, 'none'), pasted: `"${path.dirname(inCargoHome)}"` });
    check('locate: pasted folder, quoted', r.path === inCargoHome, r.path);
    r = await tools.findTool('rustc', { env: emptyEnv, homedir: path.join(home, 'none'), pasted: '/bin/echo' });
    check('locate: wrong program rejected', r.path === null, r.tried.join(' | '));
    tools.removeDir(home);
  }

  tools.removeDir(dir);
  console.log(failures === 0 ? 'all checks passed' : `${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
