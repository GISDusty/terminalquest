# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

TerminalQuest is an Electron + React + Phaser 2 RPG (a fork of TwilioQuest) that teaches software development. Game content (levels, missions, objectives, tilesets, music) is delivered through "extensions" — npm packages like `twilioquest-base`, which are bundled in `public/node_modules`.

## Commands

Requires Node 18 (`.nvmrc`) and Python 3.9 (needed by `node-sass`/native deps; 3.11 is known to break the build).

- `npm install` — installs root deps; the `postinstall` hook also runs `npm install` inside `public/` (the game bundle has its own `package.json` and its own dependencies, including the bundled extensions).
- `npm start` — builds JS/CSS/HTML, then launches Electron (`main.js`) with Babel/Sass/Pug watchers running in parallel.
- `npm run build:all` — one-off build (`build:js`, `build:css`, `build:html`).
- `npm test` — runs `jest src/test/*` under `@jest-runner/electron`, so tests run inside an Electron renderer. Single test: `npx jest src/test/app/common/extensions.test.js`, or add `-t "<test name>"`.
- `npm run scaffold:mission -- <name>` — creates a new mission under `public/levels/` from `tasks/scaffold/mission_scaffold`.
- `npm run audit-items`, `generateVoiceOvers`, `sync:missions`, `release` — scripts in `tasks/`. Most need Firebase/AWS credentials (see `.env.template`).

Prettier config: single quotes, semicolons, 2-space indent, ES5 trailing commas.

## Architecture

### Source vs. generated output
Source lives in `src/` and is compiled into `public/`:
- `src/js` → Babel → `public/` (so `src/js/app/...` becomes `public/app/...` and `src/js/index.js` becomes `public/index.js`)
- `src/scss/main.scss` → `public/index.css`
- `src/templates/index.pug` → `public/index.html`

`public/index.*`, `public/app/` and `public/test/` are git-ignored build artifacts. Edit `src/`, never those. By contrast, the rest of `public/` (`levels/`, `lib/`, `fonts/`, `images/`, etc.) is committed, hand-authored content.

### Runtime
`main.js` is a dev-only Electron launcher that loads `public/index.html`. It uses `nodeIntegration` and `@electron/remote`, so renderer code uses Node APIs (`fs`, `path`) and Electron's `remote` directly. The renderer entry is `src/js/index.js`, which mounts `App.jsx`.

- **React UI** is in `src/js/app/components/` (menus, mission computer, hack interface, nav map, onboarding, etc.). The Phaser game itself is in `components/game/` (`Game.jsx`, `DynamicLevel.js`, and `entities/` for player, NPCs, barriers, triggers, etc.).
- **Global state** is a React context (`components/context_provider/ContextProvider.jsx`) with a yup schema (`common/context/schema.js`). Fields marked `saveToDisk` in the schema are persisted via `electron-store`. Non-component code reads state through `getContext()` from `common/context`. Save data migrations are in `context_provider/migrations.js`.
- **Config**: `app/config/config.js` holds defaults. In dev it merges the git-ignored `app/config/local_config.js`, created by copying `local_config.template.js` (e.g. to set `initialLevelName`). The list of bundled extensions is `app/config/bundledExtensionModules.json`.

### Extensions and asset resolution
This is the part that spans several files. All game assets are looked up *relative to an extension root*, not a fixed path:
- `common/extensions.js` discovers extensions: external (user-installed) ones in the app data directory plus the bundled ones in `public/node_modules`. Invalid extensions are filtered out.
- `common/assetLoader.js` (`readFile`, `readDirectory`, `resolveAbsolutePath`, ...) resolves a relative path such as `levels/<name>/level.json` across all extensions, so an extension can add or override files from another extension (including base). On startup it syncs bundled assets into a `.bundled` directory.
- `common/levelLoader.js` loads levels through this layer, using each level's `level.json` (validated by a yup schema) plus its `events.js`, `maps/`, and `objectives/`. `levelLifecycleManager.js`, `gameEvents.js`, and `world.js` drive per-level events.

Because of this, `public/levels/common/dev_skills` in this repo is the in-repo example of a level, but most game content comes from the `twilioquest-*` packages listed in `public/package.json`. Tests mock these with fixtures in `src/test/fixtures/public/node_modules` and `src/test/fixtures/extensions`.

### Levels, objectives, validators
A level directory contains `level.json` (metadata; `is_mission: true` makes it a mission), `events.js` (a `module.exports = function(event, world)` handler for events like `levelDidLoad`), `conversations/*.pug`, `maps/` (Tiled maps), and `objectives/<objective_name>/` with `description.md`, `walkthrough.md`, and `validator.js`. A validator exports `async helper => {...}` and calls `helper.success(...)` or `helper.fail(...)`, reading user input from `helper.validationFields`. Validators run in the app's Node environment, in the Electron renderer. User-code execution goes through `common/code_runner.js` and `public/code_runner/`.

### Tasks (`tasks/`)
Node scripts for content tooling and release. They share the bundled-extension list (`tasks/utils/bundledExtensions.js`) and read levels from the extensions (`tasks/utils/readLevels.js`). `sync_missions` pushes mission/objective metadata to Firestore. `create_release.js` builds release bundles and needs the env vars from `.env.template`.

### Other directories
`design/` holds source art (Aseprite/Pyxel) and isn't used at runtime. `music/` holds source audio. Artwork and music are CC BY 4.0, and code is MIT.
