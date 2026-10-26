# Improvement loop ledger

Orchestrator state for the loop described in `LOOP_PROMPT.md`. Read at the start of every cycle, update at the end. Tracks: A = game runs, B = content, C = docs.

## In progress

(nothing; cycle 1 finished)

## Backlog (ranked)

1. [A] `dev_skills`: BLOCKED on a user decision (see below).
3. [A] Add `npm run verify` (build + tests + launch smoke + screenshot), reusing the CDP/hyprctl helpers. First make the 3 broken suites load (mock `electron-is-dev` in the test setup, or similar).
4. [B] Hide Twilio-account missions: API Setup, Voice, Messaging (decision 3). Audit finding: all three are in `twilioquest-twilio-vr` (`basic_training`, `programmable_voice`, `twilio_messaging`). That package is NOT in `bundledExtensionModules.json`, so it is probably never loaded, which would mean they are already hidden. Still to do: confirm at runtime that the Mission Computer does not list them, and record in docs how they would be re-enabled. Voice and Messaging have the prereq `basic_training.basic4`. No mission-level `hidden` flag exists; only objectives have `hidden`.
5. [B] Uncompletable objectives: `twilioquest-javascript/green-keycard` stub, `skills_plant_tree1` dead backend, `open-source/04_git_clone` 404 repo, `07_sync_master` branch name, api-academy/base `/quest/magic` endpoints. Needs vendoring.
6. [A] `Validator.jsx` timeout so a validator that never calls back cannot hang the UI.
7. [A] `HackInterface.loadObjective` must clear `hackObject` on error (keyboard freeze).
8. [A] Dead-backend features fail quietly offline: cloud sync, unlock codes, teams, live events, plant-a-tree.
9. [A] Fix `local_config.template.js`: stale keys (`initialLevelName` -> `defaultLevelName` plus the `*Prologue` variants) and the dead `apiBaseUrl` (drop it; dev rewrites to the dev host anyway).
9b. [A] Retire or rewrite `tasks/update_bundled_extensions.js` (it runs `npm install <name>@latest` in `public/`, which would undo the vendoring). Check that `tasks/create_release.js` follows the `public/node_modules` symlinks (unverified).
10. [C] `docs/security.md`: security model, only enable extensions you wrote or read (decision 4).
11. [B] Dead links (nodejs.org arg parsing x5, `github.com/twilio/twilioquest`, others in HANDOFF 3.4); Linux gaps (`js_node_workspace`, `terminal_cd`, `js_unlock_door`); `create_repo` git identity step; Python 3.7 text. Needs vendoring.
12. [A] Swap `node-sass` for `sass`; drop Python pin if possible.
13. [A] Drop dead deps: `vm2`, `@electron/remote`, `@sendgrid/*`, `universal-analytics`, unused Babel plugins.
14. [A] Replace Jest 26 / `@jest-runner/electron` / Enzyme (prereq for React and Electron upgrades).
15. [A] Electron 11 -> current: preload + IPC instead of `remote` (app files, `public/code_runner/runner.js`, vendored `twilioquest-python/scripts/objectiveValidation.js`).
16. [A] Node 18 -> current LTS.
17. [A] React 16 -> 18+ (after Enzyme is gone).
18. [A] Babel `corejs: 2` config.
19. [C] Authoring docs from upstream `extension-docs` and `twilioquest-extension-template`; Rust mission guide.
20. [C] CI running `npm run verify` on the fork.

## Test baseline (2026-10-25, revival @ 22a60ee)

`mise exec -- npm test` exits 1. `Test Suites: 3 failed, 1 passed, 4 total`, `Tests: 1 passed, 1 total`, about 7 s. Only `Button.test.js` runs. `analytics`, `assetLoader` and `extensions` suites fail to load with `TypeError: Cannot read property 'app' of undefined` at `node_modules/electron-is-dev/index.js:4` (`electron.app || electron.remote.app`). Probable cause (unverified): the jest-runner/electron renderer has no `remote`, since Electron 10+ defaults `enableRemoteModule` to false. The 37 other cases in those suites are not running. Noise: a haste-map name collision between `package.json` and `public/package.json` named `terminalquest`, plus a `contextIsolation` deprecation warning.

## Done

- `170ecac` vendor the 7 bundled packages into `public/extensions/` (byte-identical to the npm copies: 2226 files, hash matched before and after), plus a provenance and licence README.
- `02c9b30` point `public/package.json` at them with `file:` deps and regenerate the lockfile (v1 to v3). Verified: the symlinks are in place, every non-builtin require resolves, `build:all` passes, `npm test` is no worse than the baseline, and the level scan finds 12 levels (identical before and after). At runtime in the main checkout, the game reached `owls_nest` and Chiara's opening conversation (orchestrator screenshot).
- Docs: CLAUDE.md and HANDOFF.md updated for vendoring and the dev_skills findings. The ledger was created.
- `npm test` baseline recorded (above).

## Findings: dev_skills runtime test (cycle 1)

Run with a git-ignored `local_config.js`, with keystrokes injected over CDP. Save file `~/.config/terminalquest/config.json` was backed up and restored byte-identical.
- **The level is unreachable in the shipped game.** `levelLoader` only scans `levels/` under extension roots. `public/` is not an extension root, so `public/levels/common/dev_skills` is never loaded ("Initial mission does not exist!"). Only 12 levels load, all from extensions. The earlier `terminal_script` fix (24a3962) is in this unreachable level.
- Once it is forced to load through a fake extension root, these break in turn:
  1. `HackableBarrier.js:11` throws, because `'barrier'` is missing from the legacy list in `EntityConfigService.isTypeLegacyObject` (`EntityConfigService.js:60`, which I checked). That aborts the whole object loop.
  2. With `'barrier'` patched in, `DynamicLevel.js` `customSort` throws every frame on bodyless sprites.
  3. `HackableBarrier`/`HackableChest` have no `interactionEffect`, so no hack can open.
  4. `terminal_script_multi` is missing.
  5. `events.js` requires `../common/events/trees`, a wrong relative path (the symlinked layout may have contributed to this one).
- `twilioquest-dev-fundamentals` already teaches the same ground (`fs-01-path` .. `fs-08-hidden`: pwd, ls, cd, mkdir, touch, rm).
- `local_config.template.js` keys `initialLevelName`/`initialPlayerEntry` are read nowhere. The real keys are `defaultLevelName`/`defaultPlayerEntry` plus the `*Prologue` variants, and the `*Prologue` variants win until the prologue is completed. In dev, `config.js` rewrites the prod `apiBaseUrl` to the dev host anyway.

## Verification tooling (cycle 1)

- `wtype` does NOT reach the game window: Electron 11 runs under XWayland.
- Hyprland 0.56 uses Lua dispatch syntax: `hyprctl dispatch 'hl.dsp.focus({ window = "address:0x..." })'` and `hl.dsp.send_shortcut({ mods = "", key = "space", window = "address:0x..." })`. These work for single key presses.
- For held keys (movement), launch with `--remote-debugging-port=9222` and send CDP `Input.dispatchKeyEvent`. Helpers are in the session scratchpad (`cdp2.js`, `keys.js`) and should be moved into the repo when `npm run verify` is built.
- Use PIDs, not `pkill -f`, which matched the agent's own shell.
- **Match the game window by `class == "terminalquest"`, never by title.** VS Code's title contains "terminalquest". In cycle 1 the orchestrator sent one stray space into the user's unsaved VS Code buffer that way; the user was told.
- Back up `~/.config/terminalquest/config.json` before a run and restore it afterwards.
- Coredump at 23:17:59: Electron SIGTRAP, pid 578352, during the dev_skills test run, probably from the in-memory patching (unverified, not diagnosed).

## Blocked

- `dev_skills` revival: waiting on the user (see decisions).

## Decisions needed from the user

1. **`dev_skills`**: it is unreachable today and needs about 5 engine and content fixes plus a new `terminal_script_multi` objective. Options: (a) leave it dormant and play `twilioquest-dev-fundamentals` for terminal basics (recommended for now); (b) revive it as a mission in an in-repo extension, which means engine fixes plus writing or repointing the final chest objective.
