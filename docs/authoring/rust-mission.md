# A mission that teaches Rust

This is a worked guide. You will build a mission whose objective asks the
learner to write a Rust program, then has the game compile it with `rustc`, run
it, and check what it prints. The finished example is in
[`examples/rust-quest/`](examples/rust-quest/). Copy that folder to start.

It builds on the other authoring pages: [extension.md](extension.md),
[mission.md](mission.md), [objective.md](objective.md),
[validator.md](validator.md) and [map.md](map.md). Read
[../security.md](../security.md) first (see "Security" at the end).

It replaces the older, unverified audit in `HANDOFF.md` section 3.5.

## What was and was not tested

When this was written, Rust was **not installed** on the author's machine
(`which rustc cargo` found nothing, and `~/.cargo/bin` did not exist). I did not
install it. So:

- Verified: the find, spawn, timeout, kill, escape and temp-folder logic, using
  a stand-in script for `rustc` (`tools/fake_rustc.sh`). The same test passes
  on Node 18 and on the Node inside Electron 11 (v12.18.3) — that is where it
  was originally verified, when this guide was written in cycle 9; the game
  runtime is now Node 24 LTS / Electron 45 (Node 24.22.1).
- Verified: the extension, level and map load through the game's own loaders,
  and the level and its terminal appear in the running game.
- **(unverified)** Anything that depends on real `rustc` or `cargo` output: the
  exact compiler flags, the wording of compile errors, build times, and the
  Cargo section below. The harness runs the same seven cases against real Rust
  with no changes: run `node tools/test_validator.js` once Rust is installed.
- **(unverified)** Pressing HACK on the terminal inside the running game. I
  could not walk the player to the terminal reliably by script. The validator
  was tested with the mock helper only.

## 1. Copy the example and enable it

```
cp -r docs/authoring/examples/rust-quest ~/tq-extensions/
```

Then follow [extension.md](extension.md): Settings (`O`), Extensions, Enable,
Choose Directory `~/tq-extensions`, restart the game (levels are scanned once at
startup). The mission appears in the Mission Computer on the Fog Owl as
"Rust Intro: Hello, Ferris".

What is in the folder:

```
rust-quest/
├── package.json                          name + version (the only required file)
├── scripts/rustTools.js                  find rustc, run it with a timeout, escape output
├── levels/rust_intro/
│   ├── level.json                        a mission with one objective
│   ├── events.js                         does nothing, but see the note below
│   ├── maps/default.json                 a 16 x 12 room: spawn, exit, one terminal
│   └── objectives/rust_hello/
│       ├── objective.json                two input fields, 100 XP
│       ├── description.md                the "Objective" tab
│       ├── walkthrough.md                the "Help" tab
│       └── validator.js                  compile, run, check
└── tools/
    ├── test_validator.js                 the mock-helper test (section 6)
    └── fake_rustc.sh                     a stand-in for rustc, for testing without Rust
```

Why `events.js` is there: a level with no `events.js` still loads, but the game
logs "Error loading event hander" and a `TypeError`. I saw both when I loaded
this level without the file. See [mission.md](mission.md).

## 2. Find `rustc` and `cargo`

### What PATH does the game get?

The game's window process inherits the environment of the Electron process that
started it. I checked with the game's remote-debugging port: I launched the app,
read `process.env.PATH` in the renderer over the Chrome DevTools Protocol, and
killed it by PID. Nothing was typed into the game, and the save file was backed
up before and restored after (`cmp` showed it identical).

Launched with `mise exec -- npx electron .` from a terminal, the renderer saw
(the first entries are `node_modules/.bin` folders and are cut here):

```
.../node_modules/.bin:...:/home/dusty/.local/share/mise/installs/node/18/bin:
.../mise/installs/python/latest/bin:/home/dusty/.local/share/mise/shims:
/usr/share/omarchy/bin:/usr/local/sbin:/usr/local/bin:/usr/bin:
/home/dusty/.local/bin:/usr/bin/site_perl:/usr/bin/vendor_perl:/usr/bin/core_perl
```

As of cycle 12, both `mise` and Electron 45 run Node 24.22.1 (`~/.cargo/bin`
is still not on it, and `CARGO_HOME` is unset). To simulate a launch from a
desktop entry I started the Electron binary with only
`PATH=/usr/local/bin:/usr/bin:/bin` (plus the display variables). The renderer
saw exactly that, and that desktop-launch `PATH` finding still applies. This
machine has no desktop entry for the game, so that second launch is a
simulation, not a real one.

The lesson: `process.env.PATH` is whatever the launcher gave the game. A shell
profile that adds `~/.cargo/bin` (rustup's installer edits profile files, from
the rustup docs, not tested here) is not read by a desktop entry. Do not assume
`rustc` is on `PATH`.

### The lookup order

`findTool(tool, options)` in `scripts/rustTools.js` tries, in order:

1. `PATH`: spawn the bare name (`rustc`, or `rustc.exe` on Windows).
2. `~/.cargo/bin/<tool>`, using `os.homedir()`. This is where rustup installs.
3. `$CARGO_HOME/bin/<tool>`, if `CARGO_HOME` is set.
4. A path the learner pasted into an optional field. A pasted folder, or a path
   in quotes, or one starting with `~` is accepted.

A candidate counts only if `<tool> --version` exits 0 within 5 seconds and its
first line looks like `rustc 1.NN...` (or `cargo ...`). An absolute path that
does not exist is skipped without starting a process. The result is
`{ path, version, tried }`; when nothing works, `tried` lists every place that
was looked at, and the validator shows it:

```js
const rustc = await findTool('rustc', { pasted: helper.validationFields.rustcPath });
if (!rustc.path) return helper.fail(notFoundMessage(rustc.tried));
```

The optional field is modelled on the Python install objective,
`public/extensions/twilioquest-python/levels/python/objectives/python_basics_install/validator.js`.
That validator has the learner paste `pythonPath`, then runs `<path> --version`.
Two differences: it uses `helper.isExecutableValid`, which builds a shell
string (see [validator.md](validator.md)), and its `spawn` has no timeout. The
Rust version uses an args array and a timeout. The field is last in the order, so
a `rustc` on `PATH` wins over a pasted one. If you want the learner's choice to
win, move `pasted` to the front of the candidate list.

Tip for a mise user (unverified): a Rust installed with mise lives under
`~/.local/share/mise/installs/rust/...`, which none of the default places
cover. The paste field handles it.

`toolEnv(toolPath)` returns a copy of the environment with the tool's folder at
the front of `PATH`, so `cargo` can find `rustc`, and rustup's proxy can find
`rustup`. `rustc` also needs a linker (`cc` on Linux and macOS, the MSVC build
tools on Windows). A "linker not found" error is not a validator bug (unverified,
from the Rust docs).

### Windows

`exeName('rustc')` gives `rustc.exe` on Windows. Pasted paths use `\`, and the
`~\` form is expanded. Windows was not tested (unverified).

## 3. Run it with a timeout, and kill it

Never build a shell string. `runProcess(file, args, options)` in
`scripts/rustTools.js` uses `child_process.spawn` with an args array. It
resolves exactly once, always (it never rejects), with
`{ stdout, stderr, code, signal, timedOut, truncated, error }`.

```js
child = spawn(file, args, {
  cwd, env,
  detached: !IS_WINDOWS,            // POSIX: the child leads its own process group
  stdio: ['ignore', 'pipe', 'pipe'], // stdin closed: a program that reads it sees EOF
  windowsHide: true,
});
...
timer = setTimeout(() => {
  killTree(child);
  finish({ timedOut: true });
}, timeoutMs);
```

- **Kill the whole tree.** `killTree` on POSIX is `process.kill(-child.pid,
  'SIGKILL')`. The minus sign means "the process group", which works because the
  child was started with `detached: true`. That reaches the compiler's children,
  and `cargo`'s children (`rustc`, and the learner's program). On Windows it runs
  `taskkill /pid <pid> /T /F`, and falls back to `child.kill()`. The Windows
  branch was not run (unverified).
- **Resolve once.** `finish` sets a `settled` flag. A timeout, a `close`, an
  `error` event and an output overflow can all race, and only the first counts.
  After a timeout the promise resolves at once, without waiting for `close`,
  because a grandchild that holds the output pipes open could delay `close`.
- **Cap the output.** Each stream is limited to 64 K characters
  (`MAX_OUTPUT_BYTES`). A program that prints more is killed and `truncated` is
  set. This stops `loop { println!("x") }` from filling memory. The
  validator then fails with a specific message.
- **`ENOENT`.** If the program does not exist, `spawn` emits an `error` event.
  `runProcess` returns it as `error`, so you can tell "could not start" from
  "ran and failed".

I checked that the group kill is what matters: with `killTree` changed to
`child.kill()` only, the test's `sleep` grandchild survived and the orphan check
failed. With the group kill restored it passed.

### Budget against the game's 60 seconds

`src/js/app/components/hack_interface/validator/runValidator.js` gives a
validator 60 seconds (`VALIDATOR_TIMEOUT_MS`) to report, plus a 10 second grace
(`VALIDATOR_RETURN_GRACE_MS`) after the function returns without reporting. The
game cannot stop your code. It only ignores a late result. So you own the
timeouts and the kill.

The example's worst case is the version check (5 s) plus compile (20 s) plus run
(5 s), about 30 seconds: well under 60. If you add a step, add its timeout to
that sum. `await` everything, and `return helper.fail(...)` or
`return helper.success(...)` only after the work is done, so the validator never
returns early.

## 4. Escape the compiler output

`helper.fail` and `helper.success` text is put into the page as HTML
(`dangerouslySetInnerHTML`, `Validator.jsx` line 471). `rustc` errors are full
of `<`, `>` and `&`: `expected Vec<u8>, found &str`, `--> src/main.rs:2:5`.
Unescaped, `Vec<u8>` is parsed as a tag and disappears. See
[../security.md](../security.md).

```js
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// strip, then truncate, then escape. Truncating after escaping could cut "&lt;" in half.
function formatOutput(text, max = 3000) {
  return '<pre>' + escapeHtml(truncate(stripAnsi(text).trim(), max)) + '</pre>';
}
```

- `stripAnsi` removes colour codes. The validator also passes `--color=never` to
  `rustc`, so there should be none; the strip is a second line of defence, and
  `cargo` or a wrapper may add colour anyway.
- Truncation (3000 characters) keeps a runaway message from filling the window.
- The same rule applies to what the learner's program printed (the "wrong text"
  message shows it), and to a thrown error's message: the game inserts that as
  HTML too, so the validator catches everything and escapes it.
- `<pre>` keeps the line breaks and the alignment of the `^^^^` markers.

An alternative to full errors is `rustc --error-format=short`, which prints one
line per error. The example keeps the full text because the arrows and notes
teach well.

The harness checks this: it removes the few tags the validator uses itself and
asserts that no `<` or `>` remains in any message.

## 5. The example mission

### package.json and level.json

```json
{ "name": "rust-quest", "version": "0.0.1", "description": "..." }
```

```json
{
  "title": "Rust Intro: Hello, Ferris",
  "description": "Write, compile and run your first Rust program.",
  "is_mission": true,
  "priority": 50,
  "backgroundMusic": "hackertheme_104771b",
  "backgroundEffect": { "key": "vr", "options": {} },
  "objectives": ["rust_hello"]
}
```

`is_mission: true` puts it in the Mission Computer. `objectives` is the
manifest: list every objective, or it will not count toward XP and progress
([mission.md](mission.md)). A name in the list with no `objective.json` can
break game start-up (from reading the code, per mission.md, not run), so keep
it spelled the same as the folder.

### objective.json

Two text fields. The validator reads them by `name`:

```json
"validation_fields": [
  { "name": "sourcePath", "type": "text", "label": "Paste the full path to your `main.rs` file." },
  { "name": "rustcPath",  "type": "text", "label": "Optional: the path to `rustc`, ..." }
],
"show_ide": false,
"rewards": { "xp": 100 }
```

`show_ide` is off because the in-game editor only runs JavaScript
([objective.md](objective.md)). The learner writes Rust in their own editor and
pastes a path. Always give `rewards.xp`.

An untouched `rustcPath` field is absent from `validationFields` (`undefined`),
and `findTool` copes with that.

### description.md and walkthrough.md

Plain Markdown, run through EJS first, so avoid `<%`. The example's description
lists the requirements in a `<div class="aside">` box, as the bundled lessons do,
and its walkthrough shows the three-line solution, a way to check it from a
terminal (`rustc main.rs`, then `./main`), and what to do when `rustc` is not
found.

### validator.js

The whole file is
[`levels/rust_intro/objectives/rust_hello/validator.js`](examples/rust-quest/levels/rust_intro/objectives/rust_hello/validator.js).
Its steps, in order, each failing with one specific message:

1. `sourcePath` empty: "Paste the full path...".
2. `fs.statSync` fails: "could not find a file".
3. It is a folder: "That path is a folder".
4. The extension is not `.rs`: "does not end in `.rs`".
5. `findTool('rustc')`; not found: install hint plus the list of places tried.
6. `fs.promises.mkdtemp(path.join(os.tmpdir(), 'tq-rust-'))` makes a fresh folder.
   The binary goes there, never next to the learner's file.
7. Compile: `rustc --edition=2021 --color=never -o <tmp>/main <source>`, 20 s.
   Timeout, start failure and non-zero exit each get their own message, and a
   non-zero exit shows the escaped compiler output.
8. Run `<tmp>/main`, 5 s, stdin closed. Timeout ("still running after 5
   seconds"), too much output, and non-zero exit (a panic) each fail.
9. `stdout` must include `Hello, TerminalQuest!`; otherwise show what it printed.
10. `helper.success(...)`.

The `finally` block deletes the temp folder, whichever way the function ended
(`removeDir` uses `fs.rmSync` when it exists and `fs.rmdirSync` on Node 12). The
harness checks that no `tq-rust-*` folder is left behind.

Node 12 note (historical): as of cycle 12 the game's renderer runs Node 24.22.1 (Electron 45), so `?.`, `??` and `fs.rm` are all fine now. Keeping the helper compatible with older Node is harmless, however; the example avoids them, and the harness was also run under Electron's Node to be sure
(`ELECTRON_RUN_AS_NODE=1 <repo>/node_modules/electron/dist/electron tools/test_validator.js --fake`).

Two environment variables, `TQ_RUST_COMPILE_TIMEOUT_MS` and
`TQ_RUST_RUN_TIMEOUT_MS`, override the timeouts. They exist so the test can use
2 seconds instead of 20 and 5. A learner never sets them.

### maps/default.json

`maps/default.json` is a small generated map: 16 by 12 tiles of 24 pixels, a
floor layer, a hidden `Collision` layer that walls the room in, and an object
layer with three objects. Do not write one by hand. For your own missions, follow
[map.md](map.md): copy
`public/extensions/twilioquest-base/levels/challenge-questions/maps/room_template.json`
and open it in Tiled. The parts that matter here:

| Object | Type | Properties |
| --- | --- | --- |
| `player_entry1` | `player` (a point) | Where the player appears. Every map needs one. |
| `exit` | `levelChange` | `levelName: fog_owl`, `playerEntryPoint: player_entry2`. A gap in the left wall lets the player reach it. |
| a tile object, `gid` 10013 | (from the tileset) | `objectiveName: rust_hello` |

Gid 10013 is the `terminal` tile of `TwilioQuestObjects` (first gid 10001, tile
12). The tileset supplies `type: terminal` and `hackable: true`; the object
only names the objective. That is "making an object hackable" in
[map.md](map.md). To add a second Rust objective, add its folder, list it in
`level.json`, copy the terminal and change `objectiveName`.

Size: 189 lines, because Tiled-style JSON puts each layer's tiles in an array.
The two tilesets are the first two entries of `room_template.json`, with the
same `.bundled/tilesets/...` paths.

### Checked through the game's own code

I loaded the example with a temporary jest test (not committed) that runs the app's own code:

- `getExternalExtensionDirectories()` reports `rust-quest` valid, and
  `getAllValidExtensions()` includes it.
- `levelLoader.isValidLevel('rust_intro')` is true against the yup schema, and
  `readLevelInfo` returns `is_mission: true`, the manifest `['rust_hello']`, the
  objective's two fields, `xp` 100, and the map `default`.
- `TiledService.registerMapFile` resolves both tilesets (the `.bundled/` lookup)
  and `getTileData(10013)` returns type `terminal` with `hackable: true`.

And in the running game (Electron 11 at the time this guide was written in
cycle 9 — the runtime is now Electron 45 / Node 24; a throwaway user-data
folder, extension enabled there, never in your real settings),
`window.warp('rust_intro',
'player_entry1', 'default')` showed the room with the terminal, the player and
the VR background, and the quest title "Rust Intro: Hello, Ferris" in the HUD.
After adding `events.js`, the console showed only warnings for this level
(`Entity type is not mapped: "terminal"`, which [map.md](map.md) describes as
the normal fallback to `tile-object`; a Phaser note about Tiled 1.6 maps; a
sprite-sheet size note). I did not compare them with a bundled level.
Before I added `events.js` it also showed two errors.

## 6. Testing the validator

The method is the mock helper from [validator.md](validator.md): a fake `helper`
that records what the validator reports. `tools/test_validator.js` is that
recipe, filled in for this objective.

```
cd ~/tq-extensions/rust-quest
mise exec -- node tools/test_validator.js            # real rustc
mise exec -- node tools/test_validator.js --rustc ~/.cargo/bin/rustc
mise exec -- node tools/test_validator.js --fake     # stand-in, no Rust needed
```

It writes throwaway `.rs` files, and for each case it checks the result, that
exactly one report was made, that the message contains the expected text, and
that it is HTML-safe.

| # | Case | Expected |
| --- | --- | --- |
| 1 | empty input | fail, "Paste the full path" |
| 2 | missing file | fail, "could not find a file" |
| 3 | `notes.txt`, not `.rs` (and 3b, a folder) | fail, "does not end in" |
| 4 | compile error: `let x: Vec<u8> = "oops";` | fail, "did not compile"; message contains `Vec&lt;u8&gt;`, no ANSI codes |
| 5 | prints `Hello, World!` | fail, "did not print", shows what it printed |
| 6 | `fn main() { loop {} }` | fail, "still running"; timeout, kill, back in under 10 s |
| 7 | the correct program (7b: the path in quotes and spaces) | success |
| 8 | compiler hangs (stand-in only) | fail, "Compiling took longer" |

After the cases it looks for survivors with `pgrep -f tq-rust-` (any `rustc` or
compiled binary has that folder in its command line) and `pgrep -f 'sleep 7331'`
(the stand-in's hung compiler's child), and it checks that no `tq-rust-` folder
is left in the temp directory. `pgrep` is skipped on Windows.

### Results

Run with the stand-in (`--fake`), on Node 18 and again under Electron 11's
Node 12.18.3 (these runs were recorded on Electron 11 / Node 18, when the
guide was written in cycle 9; the runtime is now Electron 45 / Node
24 LTS). Real `rustc` was not available, so rows 4 to 7 are checked
against the stand-in's imitation of `rustc` (unverified against the real thing):

```
ok   1 empty input: fail
ok   2 missing file: fail
ok   3 not a .rs file: fail
ok   3b a folder: fail
ok   4 compile error: fail
ok   5 wrong text: fail
ok   6 infinite loop: fail, 2024 ms
ok   7 correct program: success
ok   7b quoted path with spaces: success
ok   8 compiler hangs (stand-in only): fail, 2014 ms
ok   no orphan processes (pgrep tq-rust-, sleep 7331): none
ok   no temp folders left behind: none
ok   locate: nothing found -> null, tried list
ok   locate: ~/.cargo/bin
ok   locate: CARGO_HOME
ok   locate: PATH first
ok   locate: pasted folder, quoted
ok   locate: wrong program rejected
all checks passed
```

(The "locate" lines test `findTool` with a fake home folder and a fake `PATH`.)

### Doing the kill check by hand

```
mise exec -- node tools/test_validator.js --fake   # or without --fake
pgrep -af 'tq-rust-'                                # expect no output
```

Beware: `pgrep -f` matches its own parent shell if your command line contains
the pattern. If you type the pattern in a one-liner and it reports a PID, check
that the PID is your shell, not a leftover.

## 7. Cargo projects (unverified)

None of this was run, because there is no `cargo` here. The process handling is
the same code as above (the "compiler hangs" case kills a wrapper and its
`sleep` child), so only the Cargo-specific parts are untested.

For a lesson about a multi-file project, have the learner paste the project
folder (the one that holds `Cargo.toml`), and run Cargo there:

```js
const cargo = await findTool('cargo', { pasted: helper.validationFields.cargoPath });
if (!cargo.path) return helper.fail(notFoundMessage(cargo.tried));
if (!fs.existsSync(path.join(projectDir, 'Cargo.toml'))) {
  return helper.fail('I did not find a <code>Cargo.toml</code> in that folder.');
}
const run = await runProcess(
  cargo.path,
  ['run', '--quiet', '--offline', '--color', 'never'],
  { cwd: projectDir, env: toolEnv(cargo.path), timeoutMs: 40000 }
);
```

- `cargo run --quiet` hides Cargo's own "Compiling..." lines. Compiler errors
  should still appear on `stderr`, and the program's own output is on `stdout`.
- `--offline` stops Cargo from trying the network. A project with no
  dependencies is unaffected. A project with dependencies that are not already
  in `~/.cargo/registry` will fail with an error that mentions offline mode:
  catch it and tell the learner to run `cargo build` once themselves.
- Use `cwd`, not `cd` in a shell string. Cargo runs in the learner's folder and
  writes `target/` there, which is what makes later builds fast. Do not give it
  a temp `CARGO_TARGET_DIR` unless you want a full rebuild every time.
- **Build time against the timeout.** The first build of a program with
  dependencies can take minutes, and a validator gets 60 seconds in total. The
  example caps Cargo at 40 seconds, which leaves room for the version check.
  Tell the learner in `walkthrough.md` to run `cargo build` in their own
  terminal first, so the validator's build is incremental. Keep the
  program under test small and put no heavy dependencies in a lesson.
- The kill reaches `cargo`'s children because of the process group. Check with
  `pgrep -af 'target/debug'` after a timeout (unverified for Cargo).

## 8. Security

This validator compiles and runs the learner's own code, with the learner's own
permissions, on the learner's own machine. That is acceptable here because it is
their code and their computer, and the project has accepted that model for a
personal local game. Read [../security.md](../security.md) in full.

- A validator has full Node access. Nothing here is a sandbox. A Rust program can
  read and delete your files, and so can `build.rs` in a Cargo project.
- Do not point a Rust validator at code that someone else wrote. If a learner
  pastes a path to a download, they are running it.
- Only enable extensions you wrote or read in full, including this one: read
  `validator.js` and `scripts/rustTools.js` before you copy them in.
- The example starts programs only with an args array. It builds no shell
  strings, so a path with spaces or `;` in it is just a path.
- The temp folder is created by `fs.mkdtemp`, which gives it a random name and
  owner-only permissions on POSIX. The learner's source file is read in place and
  never modified.

If someone else will run your lesson, this model is not acceptable
([../security.md](../security.md), "Out of scope").

## Checklist for the next Rust objective

1. Make `objectives/<name>/` with the four files, and list it in `level.json`.
2. Reuse `scripts/rustTools.js` (`../../../../scripts/rustTools`).
3. Put a terminal on the map with `objectiveName` set to the folder name.
4. Fail fast, in this order: empty, missing, wrong type, tool not found, compile
   error, runtime failure, wrong output.
5. Every message from a file, a program or the learner goes through
   `formatOutput` or `escapeHtml`.
6. Add the cases to `tools/test_validator.js`, including a hang and an orphan
   check.
7. Total of your timeouts under 60 seconds, with margin.
