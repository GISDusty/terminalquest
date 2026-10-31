# Security model

TerminalQuest is a local, single-user game. Lesson content, extensions,
validators and the code you type into the in-game editor all run with your
user account's full permissions. They can read and delete your files, run
programs and use the network. **Nothing here is a sandbox.** That is a
deliberate, accepted trade-off for a personal learning game (see "Accepted
risks"), so the safety rule below matters.

## What runs with full access

`main.js` creates both the main window and the hidden code-runner window
(`public/code_runner/runner.html`) with `nodeIntegration: true`,
`contextIsolation: false` and `sandbox: false`; `main.js` itself is launched
with `--no-sandbox` (`src/js/app/common/code_runner.js`). Anything that runs
in them can `require` any Node module, including `fs` and `child_process`.

- **Extensions.** `.js` files are loaded with plain `require`
  (`requireFromExtension` in `src/js/app/common/assetLoader.js`).
- **Validators.** Each objective's `validator.js` is required and run in the
  game window with full Node access. Node's `vm` module is not a security
  boundary.
- **`events.js`.** A level's event handler is required the same way when the
  level loads.
- **Object and script files.** Map object configs under `objects/` and
  helper files in `scripts/` are plain JavaScript modules.
- **Conversation templates.** `conversations/*.pug` files are rendered with
  `pug.renderFile`. Pug can run arbitrary JavaScript, so a template is code.
- **Objective markdown.** `description.md` and `walkthrough.md` are processed
  as EJS templates before being turned into HTML. EJS `<% %>` blocks are
  JavaScript.
- **Your own code.** Code from the in-game editor is written to disk and run
  by the hidden runner with `vm.runInThisContext`, with `require` injected
  (`public/code_runner/runner.js`). It is your user, not a jail.
- **Spawned programs.** Validators and scripts start Python, Git, Node and
  other tools with `child_process`. Those programs run as you, too.

## The rule

**Only enable or install extensions that you wrote yourself or have read in
full.** The same goes for anything you copy into `public/extensions/` or point
the Settings > Extensions folder at. An external extension is loaded before
the bundled ones, so it can replace any bundled lesson file with the same
relative path.

Before you enable an extension, read:

- every `validator.js`
- every `events.js`
- everything in `scripts/` and `objects/`
- `conversations/*.pug` and any `<% %>` blocks in `*.md`
- its `package.json` (and its dependencies, if any)

Red flags:

- network calls (`fetch`, `http`, `https`, `net`, `axios`)
- `child_process`, `exec`, or `eval` / `new Function`
- reads or writes outside the extension or project folder (your home
  directory, `~/.ssh`, browser profiles, shell config)
- obfuscated or minified code, long encoded strings, `Buffer.from(..., 'base64')`
- `<script>`, `onerror=` or `<iframe>` inside text that is shown to you

If you cannot read it all, do not enable it.

## What this means for authoring

- A validator that runs learner code or tools should start a process with an
  args array (`execFile` or `spawn`), not a shell string. The Python
  validators do this (`public/extensions/twilioquest-python/scripts/objectiveValidation.js`).
  `ValidationHelper.isExecutableValid` builds a shell string and does not.
- Always set a timeout and kill the process when it fires. If a validator
  never calls back, the UI stays stuck.
- Feedback from `helper.success` and `helper.fail`, and conversation text, is
  rendered as HTML. HTML-escape anything that came from a program, a file or
  the learner (compiler errors contain `<` and `>`), and wrap it in `<pre>`.

## Accepted risks

Decision by the project owner, 2026-10-25: accept this model for a personal
local game and document it. The accepted risks are:

- no context isolation, with `nodeIntegration: true`
- unsanitized HTML from content: 11 `dangerouslySetInnerHTML` sites render
  markdown, conversation text, item descriptions, toasts and validator
  feedback without sanitizing it
- no sandbox for extensions, validators or learner code

Network: the game has no required network calls for play.
`config.backendEnabled` defaults to `false`
(`src/js/app/common/backend.js`), which gates cloud sync, unlock codes,
teams, operations and live events offline. Some disabled code paths would
still try to reach a configured API URL (for example, progress sync after
each save, and team or operation join codes) and Firebase (unlock codes).
Progress sync catches its errors. Analytics and objective-complete event
sends are commented out. Extensions can make any request they like.

Note on the Electron upgrade (cycles 11–12): Electron is now on 45 and the
`remote` module / `enableRemoteModule` have been removed in favour of
explicit IPC (`main.js`, `src/js/app/common/electronBridge.js`).
`nodeIntegration: true` and `contextIsolation: false` remain **by design**
for local validators and extensions.

## Out of scope

Multi-user or distributed use. If other people will run your copy, or you
share a build, this model is not acceptable: you would need context
isolation, a sandbox for extensions and learner code, sanitized HTML and
signed or reviewed extensions.
