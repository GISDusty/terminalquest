'use strict';
// Validator for "Hello, TerminalQuest!": compile the learner's main.rs with
// rustc into a temp folder, run it, and check what it prints.
//
// This runs the learner's own program on their own machine. Read
// docs/security.md before you adapt it for anyone else.
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  IS_WINDOWS,
  escapeHtml,
  findTool,
  formatOutput,
  normalizePath,
  removeDir,
  runProcess,
  toolEnv,
} = require('../../../../scripts/rustTools');

const EXPECTED = 'Hello, TerminalQuest!';

// The game stops waiting after 60 s (runValidator.js). Compile plus run must
// finish well before that: 20 s + 5 s + the 5 s version check = 30 s at worst.
// The environment variable is a test hook, not something a learner sets.
const COMPILE_TIMEOUT_MS = Number(process.env.TQ_RUST_COMPILE_TIMEOUT_MS) || 20000;
const RUN_TIMEOUT_MS = Number(process.env.TQ_RUST_RUN_TIMEOUT_MS) || 5000;

const notFoundMessage = tried => `
  <p>I could not find <code>rustc</code> on this computer. Install Rust from
  <code>https://rustup.rs</code>, or paste the path to <code>rustc</code> in
  the second box (for example <code>~/.cargo/bin/rustc</code>).</p>
  ${formatOutput('Looked in:\n' + tried.join('\n'))}
`;

module.exports = async helper => {
  let workDir = null;

  try {
    // 1. Cheap checks first: is there a real .rs file?
    const sourcePath = normalizePath(helper.validationFields.sourcePath);
    if (!sourcePath) {
      return helper.fail(
        'Paste the full path to your <code>main.rs</code> file in the first box.'
      );
    }

    let stat;
    try {
      stat = fs.statSync(sourcePath);
    } catch (e) {
      return helper.fail(
        'I could not find a file at that path. Check it for typos and try again.'
      );
    }
    if (stat.isDirectory()) {
      return helper.fail(
        'That path is a folder. I need the path to the <code>.rs</code> file itself, for example <code>/path/to/hello/main.rs</code>.'
      );
    }
    if (path.extname(sourcePath).toLowerCase() !== '.rs') {
      return helper.fail(
        'That file does not end in <code>.rs</code>. Rust source files do.'
      );
    }

    // 2. Find the compiler.
    const rustc = await findTool('rustc', {
      pasted: helper.validationFields.rustcPath,
    });
    if (!rustc.path) {
      return helper.fail(notFoundMessage(rustc.tried));
    }
    const env = toolEnv(rustc.path);

    // 3. Compile into a fresh temp folder, never into the learner's folder.
    workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tq-rust-'));
    const binaryPath = path.join(workDir, IS_WINDOWS ? 'main.exe' : 'main');
    const compile = await runProcess(
      rustc.path,
      ['--edition=2021', '--color=never', '-o', binaryPath, sourcePath],
      { cwd: workDir, env, timeoutMs: COMPILE_TIMEOUT_MS }
    );

    if (compile.error) {
      return helper.fail(
        `I could not start <code>rustc</code>.${formatOutput(compile.error.message)}`
      );
    }
    if (compile.timedOut) {
      return helper.fail(
        `Compiling took longer than ${COMPILE_TIMEOUT_MS / 1000} seconds, so I stopped it. Try again, and check that nothing else is using the CPU.`
      );
    }
    if (compile.code !== 0) {
      return helper.fail(
        `Your program did not compile. Read the first error and fix that one first:${formatOutput(
          compile.stderr || compile.stdout
        )}`
      );
    }

    // 4. Run the program with a short leash.
    const run = await runProcess(binaryPath, [], {
      cwd: workDir,
      env,
      timeoutMs: RUN_TIMEOUT_MS,
    });

    if (run.error) {
      return helper.fail(
        `The program compiled but would not start.${formatOutput(run.error.message)}`
      );
    }
    if (run.timedOut) {
      return helper.fail(
        `Your program was still running after ${RUN_TIMEOUT_MS / 1000} seconds, so I stopped it. Does it have a loop that never ends?`
      );
    }
    if (run.truncated) {
      return helper.fail(
        'Your program printed far too much text, so I stopped it. Does a loop print forever?'
      );
    }
    if (run.code !== 0) {
      return helper.fail(
        `Your program exited with an error (code ${run.code}${
          run.signal ? ', signal ' + run.signal : ''
        }). A Rust panic looks like this:${formatOutput(run.stderr || run.stdout)}`
      );
    }

    // 5. Check the output.
    if (!run.stdout.includes(EXPECTED)) {
      return helper.fail(
        `Your program ran, but it did not print <code>${EXPECTED}</code>. It printed:${formatOutput(
          run.stdout || '(nothing)'
        )}`
      );
    }

    return helper.success(
      `It compiled with <code>${escapeHtml(rustc.version)}</code> and printed <code>${EXPECTED}</code>. You are a Rustacean now.`
    );
  } catch (e) {
    // The game inserts this text as HTML, so never put raw text in it.
    return helper.fail(
      `Something unexpected went wrong.${formatOutput(e && e.message ? e.message : e)}`
    );
  } finally {
    if (workDir) removeDir(workDir);
  }
};
