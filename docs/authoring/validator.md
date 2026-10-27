# Validators

A validator is `validator.js` in an objective folder. When the player presses
HACK, the game loads that file, calls the function it exports with a `helper`
object, and waits for you to call `helper.success(...)` or `helper.fail(...)`.

> Adapted in part from TwilioQuest extension-docs (MIT, © 2021 Twilio Inc.) and
> twilioquest-extension-template (MIT, © 2021 Twilio, Inc.). See
> [README.md](README.md) for the licence text.

A validator runs inside the game window with full Node.js access and your
user's permissions. It is not sandboxed. Read [../security.md](../security.md).

## The contract

```js
module.exports = async helper => {
  const { answer } = helper.validationFields;

  if (!answer) {
    return helper.fail('Type your answer first.');
  }

  if (answer.toLowerCase() !== 'ferris') {
    return helper.fail('Not quite. Check the second paragraph of the objective.');
  }

  helper.success('Correct. The terminal unlocks.');
};
```

Rules, all from `src/js/app/components/hack_interface/validator/Validator.jsx`
and `runValidator.js`:

1. The file must export a function (`module.exports = ...`). If it does not,
   the player sees "The validator could not be run: No validator found at ...".
2. The function receives one argument, the helper. (The game also passes the
   internal result callback as a second argument for very old validators. Do not
   use it.)
3. Report a result by calling `helper.success(message, env)` or
   `helper.fail(message)`. Use `return helper.fail(...)` so that your code stops.
4. Make the function `async` (or return a promise) and `await` any work. Do not
   return before the work is done.

Each hack attempt calls the function fresh. Do not rely on variables kept between
attempts. (In production the module itself is cached by `require`; in
`npm start` it is reloaded every time, so you can edit and retry.)

## What the helper gives you

### Input

| Member | What it is |
| --- | --- |
| `helper.validationFields` | An object: the field `name`s from `objective.json` mapped to what the player typed. Always strings, already trimmed of leading and trailing spaces. A field the player never touched is **absent** (so `undefined`). `boolean` fields arrive as `"true"` or `"false"`. A `prompt` field has no value. |
| `helper.getNormalizedInput(key, { lowerCase = true, trim = true })` | The field as a string, `''` if it is missing. **It lower-cases by default.** Pass `{ lowerCase: false }` for case-sensitive input such as file paths and user names. |
| `helper.env` | The player's environment variables as plain strings, with the `TQ_` prefix: `helper.env.TQ_PYTHON_EXE`. These are set by earlier objectives. |
| `helper.context` | The game's whole shared state (`xp`, `inventory`, `settings`, `completedObjectives`, ...). Internal and unstable. |
| `helper.world` | A `World` object for the current level. Prefer reading, not changing. |

### Reporting

- `helper.success(message, env = [])`. `message` is HTML. `env` is an optional
  array of `{ name, value }` (and optionally `concealed: true`) that the game
  saves as `TQ_<name>` variables for later objectives. See
  [objective.md](objective.md).
- `helper.fail(error, errorCodeMessage?)`. `error` is a string, or an `Error`
  (then its `.message` is shown). If you pass an `Error` with a `code` and an
  `errorCodeMessage` object like `{ ENOENT: 'No such file.' }`, the matching text
  replaces the message. Do not call `fail()` with `undefined`; it throws.

The message is inserted as HTML (`dangerouslySetInnerHTML` in `Validator.jsx`).
Markdown is not processed, so `*word*` shows the asterisks; write
`<strong>`, `<code>`, `<em>` and `<span class="highlight">`. Line breaks in your
template string are collapsed like any HTML. Use `<br>` or `<pre>` for layout.

### Helper methods that exist

These are all the methods of `ValidationHelper`
(`src/js/app/components/hack_interface/validator/ValidationHelper.js`).

General purpose:

- `getNormalizedInput(key, options)`: described above.
- `getFilePathPartsArray(filePath)`: splits a path on the OS separator.
- `formatPathPartsForOs(...parts)`: joins with the OS separator.
- `areArrayContentsEqual(a, b, compare = (x, y) => x === y)`: same length and
  every pair equal.
- `formatByType(value)`: a string showing the value with its type (strings in
  quotes, arrays in brackets, objects as JSON). Useful in "expected X, got Y"
  messages.
- `isExecutableValid(path, args)`: resolves to `[true]` or `[false, message]`.
  **It builds a shell command string and runs it with `exec`**, so a path or
  argument with shell characters is interpreted by the shell. Do not use it
  with untrusted input. Prefer your own `execFile` call (below).

For the in-game JavaScript editor (QuestIDE, used when `show_ide` is true):

- `getQuestIdeUserCode(objective, mission?)`: the learner's saved code as a
  string. `mission` defaults to the current level.
- `pullVarsFromQuestIdeUserCodeLocalScope(names, objective, mission?)`: runs the
  learner's code and returns an object holding the named variables, so you can
  call their functions in tests. The code runs in a Node `vm` context that is
  given `require`, `process` and `window`. It is not a sandbox.
- `evalQuestIdeUserCode(objective, mission?)`: runs the learner's code with
  `eval`. Avoid it.

Twilio-specific (these need a Twilio account's credentials in the player's
variables; the API-setup missions that used them are not loaded in this fork,
so you will not need them):

- `getTwilioClient()`, `findPhoneNumber(number, client?)`,
  `createSignature(url, params, token)`, `fakeCall(...)`, `fakeMessage(...)`,
  `fakeRequest(...)`, `getTwiML(...)`.
- Properties `client`, `fakeNumber` and `analyticsId`.

Workaround kept for one lesson:

- `fetchOverride(url, init)`: used by the API Academy objective api-05. It
  answers one hard-coded URL locally and passes every other URL to `fetch`.
  Do not build on it.

## Time limits and the one-result rule

`runValidator.js` wraps every validator. These numbers are constants in that
file:

- **60 seconds** (`VALIDATOR_TIMEOUT_MS`). If no result has been reported after
  60 s, the player sees "The validator took too long to respond, so it was
  stopped." The game only ignores late results; it cannot stop your code. A
  child process you started keeps running unless you kill it.
- **10 seconds grace** (`VALIDATOR_RETURN_GRACE_MS`). If your function returns
  (the promise resolves) without having reported, the game waits 10 s more and
  then fails the attempt with "The validator finished without reporting a
  result." This catches code that calls `success` from a callback after the
  function has already returned. A callback that reports later than 10 s after
  the return is too late. Wrap callbacks in a promise and `await` it instead.
  (A validator that is not `async` and returns a non-promise is covered only by
  the 60 s limit.)
- **Throw or reject**: the player sees "Sorry! The validator hit an unexpected
  error: <message>" and the error is logged to the console. The message is
  inserted as HTML, so do not put raw learner text in thrown errors.
- **Exactly once**: the first `success` or `fail` wins. Anything after that,
  including a second call, is ignored.

So: always `await` your work, always report before you return, and always set
your own, shorter timeout on anything that can hang (a compiler, a test run, a
network call).

## Writing a validator safely

1. **Escape output.** Compiler messages and test output contain `<` and `>`
   (Rust's `-->` and generics), and learner text can contain anything. Escape
   before you put it in feedback, and wrap multi-line output in `<pre>`:

   ```js
   const escapeHtml = text =>
     String(text)
       .replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#39;');

   helper.fail(`Your program did not compile:<pre>${escapeHtml(stderr)}</pre>`);
   ```

2. **Start programs with an args array, not a shell string.** Use `execFile` or
   `spawn`. The vendored Python validators do this
   (`public/extensions/twilioquest-python/scripts/objectiveValidation.js` uses
   `spawn(pythonPath, [codePath].concat(args))`).

   ```js
   const { execFile } = require('child_process');

   function run(file, args, options = {}) {
     return new Promise(resolve => {
       execFile(
         file,
         args,
         { timeout: 10000, maxBuffer: 1024 * 1024, ...options },
         (error, stdout, stderr) => resolve({ error, stdout, stderr })
       );
     });
   }

   // in the validator:
   const { error, stdout, stderr } = await run(compilerPath, [sourcePath]);
   if (error && error.killed) return helper.fail('That took too long.');
   if (error && error.code === 'ENOENT') return helper.fail('Program not found.');
   if (error) return helper.fail(`<pre>${escapeHtml(stderr)}</pre>`);
   ```

   `timeout` makes Node kill the process; `error.killed` is then true;
   `error.code` is `'ENOENT'` when the program does not exist and the exit
   status number when it exits non-zero. This snippet was run to check those
   three cases. Keep your timeout well under 60 s.

3. **Treat learner input as untrusted.** A path they paste may be quoted or start
   with `~`; a name they type may contain spaces or shell characters. Normalise
   (see `public/extensions/terminalquest-dev-skills/levels/dev_skills/objectives/terminal_script/validator.js`,
   `normalizePath`) and never put it into a string that a shell will parse.
4. **Fail fast with a specific hint.** Check the cheap things first (empty,
   missing, wrong type), give one clear message per failure, and finish with
   `helper.success`. The upstream template says the same.
5. **Don't depend on the network.** The backend is off in this fork, and
   `twilio.com/quest/...` URLs now return an unrelated web page. A validator
   that fetches from them can never pass.

## Testing a validator outside the game

You do not need to start the game to test the logic. A validator is plain
CommonJS, so you can require it from a script and give it a fake helper. This is
how validators in this project are checked before they go in
(`LOOP_PROMPT.md`: "empty, missing, wrong type, valid, edge cases").

Save this as `test_validator.js` (anywhere, for example next to your extension):

```js
'use strict';
// Usage: node test_validator.js <path-to-validator.js>
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// A stand-in for the real ValidationHelper. It copies the three behaviours
// that matter: values are trimmed strings, a field the player never touched is
// absent, and only the first success/fail counts.
function makeHelper(fields = {}, env = {}) {
  const validationFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) validationFields[key] = String(value).trim();
  }
  const reports = [];
  return {
    validationFields,
    env,
    success: (message, newEnv = []) =>
      reports.push({ result: 'success', message, newEnv }),
    fail: (error, codes) =>
      reports.push({
        result: 'fail',
        message: typeof error === 'string' ? error : error.message,
      }),
    getNormalizedInput: (key, { lowerCase = true, trim = true } = {}) => {
      let val = validationFields[key];
      if (!val) return '';
      if (trim) val = val.trim();
      if (lowerCase) val = val.toLowerCase();
      return val;
    },
    reports,
  };
}

async function runCase(validator, fields, env) {
  const helper = makeHelper(fields, env);
  try {
    await validator(helper);
  } catch (e) {
    return { result: 'threw', message: String(e) };
  }
  if (helper.reports.length === 0) return { result: 'none' };
  return { ...helper.reports[0], count: helper.reports.length };
}

async function main() {
  const validator = require(path.resolve(process.argv[2]));
  assert.strictEqual(typeof validator, 'function', 'validator must export a function');

  // Build whatever files the cases need in a throwaway folder.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-validator-'));
  const good = path.join(dir, 'good.sh');
  fs.writeFileSync(good, '#!/bin/sh\necho "hello"\n');
  const noEcho = path.join(dir, 'no_echo.sh');
  fs.writeFileSync(noEcho, '#!/bin/sh\nls\n');
  const wrongExt = path.join(dir, 'notes.txt');
  fs.writeFileSync(wrongExt, 'just some notes\n');
  const shebangNoExt = path.join(dir, 'runme');
  fs.writeFileSync(shebangNoExt, '#!/bin/sh\necho hi\n');

  // [name, what the player typed, expected result]
  const cases = [
    ['empty string', { scriptPath: '' }, 'fail'],
    ['missing field', {}, 'fail'],
    ['only spaces', { scriptPath: '   ' }, 'fail'],
    ['wrong type: a folder', { scriptPath: dir }, 'fail'],
    ['nonexistent path', { scriptPath: path.join(dir, 'nope.sh') }, 'fail'],
    ['valid script', { scriptPath: good }, 'success'],
    ['edge: quoted path', { scriptPath: `"${good}"` }, 'success'],
    ['edge: surrounding spaces', { scriptPath: `  ${good}  ` }, 'success'],
    ['no echo line', { scriptPath: noEcho }, 'fail'],
    ['wrong extension', { scriptPath: wrongExt }, 'fail'],
    ['edge: shebang, no extension', { scriptPath: shebangNoExt }, 'success'],
  ];

  let failures = 0;
  for (const [name, fields, expected] of cases) {
    const outcome = await runCase(validator, fields);
    const ok = outcome.result === expected && (outcome.count || 1) === 1;
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${outcome.result}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(failures === 0 ? 'all cases passed' : `${failures} case(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
```

Run it against a validator:

```
mise exec -- node test_validator.js path/to/your/validator.js
```

The cases above are for
`public/extensions/terminalquest-dev-skills/levels/dev_skills/objectives/terminal_script/validator.js`, the
validator this recipe was modelled on. I ran this exact script against it and
all 11 cases passed. Change the `cases` list for your own objective. The groups
to cover every time:

| Group | Why |
| --- | --- |
| Empty string | The player pressed HACK with the box blank |
| Missing field | The player never clicked in the box, so the key is absent |
| Wrong type | A folder where a file is wanted, a word where a number is wanted |
| Valid | The happy path, including the success text |
| Edge | Quotes, spaces, upper case, `~`, Windows paths, very long input |

What this mock does not cover: the 60 s and 10 s limits, the HTML rendering,
and real `ValidationHelper` methods other than `getNormalizedInput`. If your
validator calls others (`isExecutableValid`, `pullVarsFromQuestIdeUserCodeLocalScope`),
add them to `makeHelper`, or test those parts in the game. Then do one pass in
the game with `npm start`: open the terminal, press HACK with the box empty,
wrong, and right, and watch the console.

## Where to see working validators

- Short, input-only: `public/extensions/twilioquest-base/levels/challenge-questions/objectives/balance-brackets/validator.js`
  (uses `pullVarsFromQuestIdeUserCodeLocalScope`).
- Runs an external program with `spawn` and a shared helper module:
  `public/extensions/twilioquest-python/scripts/objectiveValidation.js` and the
  validators in `public/extensions/twilioquest-python/levels/python/objectives/`.
- Looks at files on disk:
  `public/extensions/terminalquest-dev-skills/levels/dev_skills/objectives/terminal_script/validator.js`
  (this level is not loaded in the game, but the file is a good model).
- Saves a value for later objectives (and needs the network):
  `public/extensions/twilioquest-open-source/levels/open_source/objectives/01_create_github/validator.js`
  stores `GITHUB_USERNAME`.
