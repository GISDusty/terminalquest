# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

TerminalQuest is an Electron + React + Phaser 2 RPG (a fork of TwilioQuest) that teaches software development. Game content (levels, missions, objectives, tilesets, music) is delivered through "extensions" — packages like `twilioquest-base`. The seven bundled ones are vendored (committed) under `public/extensions/<name>/` and `public/package.json` links them into `public/node_modules` with `file:` deps. Fix lessons in `public/extensions/`, never in `public/node_modules`. See `public/extensions/README.md`.

## Commands

`mise.toml` pins Node 18, so run commands through `mise exec -- <cmd>` (or let mise activate in this directory). The machine's default Node is newer and too new for this project. `.nvmrc` also says 18. Python is not needed: nothing in root or `public/` compiles native code with node-gyp (`node-sass` was the reason for the old Python 3.9 pin and is gone). `.npmrc` sets `legacy-peer-deps=true`, because the repo predates npm 7's peer-dependency enforcement: a plain install fails with ERESOLVE (`@electron/remote` wants electron >= 13, the repo pins 11).

Sass is compiled with Dart Sass (the `sass` npm package), pinned exactly to 1.99.0. Later releases require Node >= 20.19 and crash on Node 18, so raise the pin only together with the Node version. The CSS build prints known, unmigrated Sass deprecation warnings (`@import`, `lighten`/`darken`).

Known issues and history are in `HANDOFF.md`. The live backlog, test baseline and verification tooling notes are in `docs/loop/STATE.md`. `LOOP_PROMPT.md` is the orchestrator prompt for the ongoing improvement loop. Work happens on the `revival` branch, not `main`.

- `npm install` — installs root deps; the `postinstall` hook then runs `npm ci` inside `public/` (the game bundle has its own `package.json`, `package-lock.json` and dependencies, including the bundled extensions), so `public/package-lock.json` is authoritative and a root install never modifies it. A fresh `npm install` or `npm ci` at the root therefore gives the exact locked `public/` tree (e.g. `cheerio` 1.0.0-rc.10; newer cheerio needs `node:stream`, which Electron 11's Node lacks, and the app hangs on "Loading"). To change a `public/` dependency deliberately, run `cd public && npm install <pkg>` and commit the updated `public/package-lock.json`. `postinstall` runs `tasks/install_app.js` (also `npm run install:app`), which runs `npm ci` with the same npm that launched the root install (`npm_execpath`) rather than whatever `npm` is first on `PATH`. Reason: npm scripts prepend every ancestor `node_modules/.bin` to `PATH`, and the root `package.json` used to depend on `npm@6` (a checkout nested inside another one also inherits its `.bin`). npm 6 ignores the v3 lockfile, so a nested `npm install` re-resolved everything and rewrote the lockfile. Do not add `npm` as a dependency.
- `npm start` — builds JS/CSS/HTML, then launches Electron (`main.js`) with Babel/Sass/Pug watchers running in parallel.
- `npm run build:all` — one-off build (`build:js`, `build:css`, `build:html`).
- `npm test` — runs `jest src/test/*` under `@jest-runner/electron`, so tests run inside an Electron renderer. Single test: `npx jest src/test/app/common/extensions.test.js`, or add `-t "<test name>"`. `src/test/setup.js` mocks `electron.remote.app`, because the test renderer has no `remote` module.
- `npm run verify` — build, full test run, then a launch smoke test (`tasks/verify.js`). It starts Electron with a CDP port, waits for the app to render, collects console errors, saves `verify-output/smoke.png`, and backs up and restores the save file. Run it before calling anything fixed. Env knobs are documented at the top of the script.
- `npm run scaffold:mission -- <name>` — creates a new mission under `public/levels/` from `tasks/scaffold/mission_scaffold`.
- `npm run audit-items`, `generateVoiceOvers`, `sync:missions`, `release` — scripts in `tasks/`. Most need Firebase/AWS credentials (see `.env.template`).

Prettier config: single quotes, semicolons, 2-space indent, ES5 trailing commas.

## Architecture

### Source vs. generated output
Source lives in `src/` and is compiled into `public/`:
- `src/js` → Babel → `public/` (so `src/js/app/...` becomes `public/app/...` and `src/js/index.js` becomes `public/index.js`)
- `src/scss/main.scss` → `public/index.css`
- `src/templates/index.pug` → `public/index.html`

`public/index.*`, `public/app/` and `public/test/` are git-ignored build artifacts. Edit `src/`, never those. By contrast, the rest of `public/` (`extensions/`, `levels/`, `lib/`, `fonts/`, `images/`, etc.) is committed, hand-authored content.

### Runtime
`main.js` is a dev-only Electron launcher that loads `public/index.html`. It uses `nodeIntegration` and `@electron/remote`, so renderer code uses Node APIs (`fs`, `path`) and Electron's `remote` directly. The renderer entry is `src/js/index.js`, which mounts `App.jsx`.

- **React UI** is in `src/js/app/components/` (menus, mission computer, hack interface, nav map, onboarding, etc.). The Phaser game itself is in `components/game/` (`Game.jsx`, `DynamicLevel.js`, and `entities/` for player, NPCs, barriers, triggers, etc.).
- **Global state** is a React context (`components/context_provider/ContextProvider.jsx`) with a yup schema (`common/context/schema.js`). Fields marked `saveToDisk` in the schema are persisted via `electron-store`. Non-component code reads state through `getContext()` from `common/context`. Save data migrations are in `context_provider/migrations.js`.
- **Config**: `app/config/config.js` holds defaults. In dev it merges the git-ignored `app/config/local_config.js`, created by copying `local_config.template.js` (e.g. `defaultLevelName`/`defaultPlayerEntry`, plus the `*Prologue` variants, which win until the prologue is done). `backendEnabled` (default `false`) gates every call to the dead TwilioQuest backend through `common/backend.js` `isBackendEnabled()`, so the game makes no network requests at startup. New code that talks to the backend must check it.. The list of bundled extensions is `app/config/bundledExtensionModules.json`.

### Extensions and asset resolution
This is the part that spans several files. All game assets are looked up *relative to an extension root*, not a fixed path:
- `common/extensions.js` discovers extensions: external (user-installed) ones in the app data directory plus the bundled ones in `public/node_modules`. Invalid extensions are filtered out.
- `common/assetLoader.js` (`readFile`, `readDirectory`, `resolveAbsolutePath`, ...) resolves a relative path such as `levels/<name>/level.json` across all extensions, so an extension can add or override files from another extension (including base). On startup it syncs bundled assets into a `.bundled` directory.
- `common/levelLoader.js` loads levels through this layer, using each level's `level.json` (validated by a yup schema) plus its `events.js`, `maps/`, and `objectives/`. `levelLifecycleManager.js`, `gameEvents.js`, and `world.js` drive per-level events.

Because of this, only levels inside an extension root are loaded. `public/levels/common/dev_skills` is NOT loaded by the game, because `public/` is not an extension root (verified at runtime 2026-10-25). All playable content comes from the vendored packages in `public/extensions/`. `twilioquest-twilio-vr` is still an npm dependency, but it is not in `bundledExtensionModules.json`, so it is not loaded. Tests mock these with fixtures in `src/test/fixtures/public/node_modules` and `src/test/fixtures/extensions`.

### Levels, objectives, validators
A level directory contains `level.json` (metadata; `is_mission: true` makes it a mission), `events.js` (a `module.exports = function(event, world)` handler for events like `levelDidLoad`), `conversations/*.pug`, `maps/` (Tiled maps), and `objectives/<objective_name>/` with `description.md`, `walkthrough.md`, and `validator.js`. A validator exports `async helper => {...}` and calls `helper.success(...)` or `helper.fail(...)`, reading user input from `helper.validationFields`. Validators run in the app's Node environment, in the Electron renderer. User-code execution goes through `common/code_runner.js` and `public/code_runner/`. Extensions, validators, `events.js`, Pug conversations and EJS in objective markdown all run with full Node access, with no sandbox; see `docs/security.md`.

### Tasks (`tasks/`)
Node scripts for content tooling and release. They share the bundled-extension list (`tasks/utils/bundledExtensions.js`) and read levels from the extensions (`tasks/utils/readLevels.js`). `sync_missions` pushes mission/objective metadata to Firestore. `create_release.js` builds release bundles and needs the env vars from `.env.template`.

### Other directories
`design/` holds source art (Aseprite/Pyxel) and isn't used at runtime. `music/` holds source audio. Artwork and music are CC BY 4.0, and code is MIT.
