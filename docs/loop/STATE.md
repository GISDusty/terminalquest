# Improvement loop ledger

Orchestrator state for the loop described in `LOOP_PROMPT.md`. Read at the start of every cycle, update at the end. Tracks: A = game runs, B = content, C = docs.

## In progress

- Cycle 5 (2026-10-26):
  - [A] install hazard: make the nested `public/` install lockfile-authoritative, and prove it from a clean clone;
  - [B] api-05 endpoint hint and `03-debugging-3` dead link (text-only fixes);
  - [A] remove dead deps (`vm2`, `@sendgrid/*`, `universal-analytics`, `@electron/remote`, unused Babel plugins).
  All three are Sonnet agents in worktrees.

## Backlog (ranked)

1. [A] `dev_skills`: BLOCKED on a user decision (see below).
4. [B] DONE, verified at runtime in cycle 3: the Twilio-account missions are hidden. Over CDP, the 12 loaded levels do not include `basic_training`, `programmable_voice` or `twilio_messaging`, and the Mission Computer and nav map don't list them. To re-enable them, add `twilioquest-twilio-vr` to `bundledExtensionModules.json`; write that down in the authoring docs. Original note: API Setup, Voice, Messaging (decision 3). Audit finding: all three are in `twilioquest-twilio-vr` (`basic_training`, `programmable_voice`, `twilio_messaging`). That package is NOT in `bundledExtensionModules.json`, so it is probably never loaded, which would mean they are already hidden. Still to do: confirm at runtime that the Mission Computer does not list them, and record in docs how they would be re-enabled. Voice and Messaging have the prereq `basic_training.basic4`. No mission-level `hidden` flag exists; only objectives have `hidden`.
5. [B] Cycle 4 findings. Every `twilio.com/quest/*` URL now returns 200 with the HTML page `github.com/TerminalQuest`.
   - `owl_plant_tree1`: already unreachable (not in any `objectives` manifest or map), marked `hidden` in the cycle 4 commit.
   - api-03-fetch: NOT completable, offline or online. The learner and the validator both fetch `twilio.com/quest/magic` for a phrase. Needs decision 2.
   - api-04-remote-and-local: NOT completable. It fetches `/magic/divination` with no `target`, which `fetchOverride` doesn't cover. Needs decision 2.
   - api-05-get-patch: completable by code reading (not executed), because `fetchOverride` covers it. But the `?target=lovelace_secret_statue` hint is only in `example.js`, and the `description.md` example has unreplaced `{{DIVINATION_ENDPOINT}}` placeholders. NEXT: instruction fix (allowed).
   - 03-debugging-3: completable offline (string comparison only). Its description link to `twilio.com/quest/ducktypium-diagnostics` is dead. NEXT: link fix (allowed).
   Earlier note (cycle 3 list):
   - `twilioquest-base/levels/fog_owl/objectives/owl_plant_tree1/validator.js:3-4` POSTs to `/quest/tracking/trees`. It is in a LOADED level and fails offline with "Something went wrong". Check whether it is already `hidden`; if not, hide it (allowed without approval).
   - `twilioquest-base/levels/challenge-questions/objectives/03-debugging-3/validator.js:76` uses `twilio.com/quest/ducktypium-diagnostics`.
   - `twilioquest-api-academy/scripts/config.js:5-6` uses `twilio.com/quest/magic` and `/magic/divination` (used by api-03, api-04 and api-05). `ValidationHelper.fetchOverride` already fakes `/quest/magic/divination` locally; check how far that covers these.
   Uncompletable objectives that remain: api-academy and base `/quest/magic` and `/quest/ducktypium-diagnostics` endpoints (03-debugging-3, api-03..05). `skills_plant_tree1` is moot, because it is in the unloaded dev_skills level.
   - Cycle 2 audit, `green-keycard`: the objective is **unreferenced**. No map, level.json objective list or events file refers to it, so it is dead code that cannot block the player. Its validator is an empty stub and its walkthrough is a copy of Twilio account setup. Recommendation: leave it, or hide or remove it with approval. Keycard gating is actually done by `objects/keycard-terminal`, and the scientist conversation grants `green`.
   - Cycle 2 audit, `07_sync_master`: `twilio-labs/open-pixel-art` exists, its default branch is `master` (checked with `git ls-remote`), and it did not look archived. The validator is completable as written.
   - Lead to play-test (from code, unverified): on the JS `visitor-signin` map, 3 keycard terminals (ids 203, 204, 206) need `blue`. Nothing grants `blue`, and they have no `targetKey`, so they look like intentionally locked props. The green terminals 191 and 205 seem to rely on tileset default properties (`accessLevel: green`); I haven't confirmed the engine merges those. Confirm in a JS mission play-test.
6. [A] Needs a play-test: drive a real objective through the hack UI to see the validator timeout and fail paths, and confirm game input resumes after a failed objective load.
8. [A] DONE in cycle 3 (see Done). Original note: cloud sync (verify shows `user-sync` 404 on every launch), unlock codes, teams, live events. Also check why the dev build loads `spectorcdn.babylonjs.com/spector.bundle.js` (a cert error on every launch).
7b. [A] DONE in cycle 4 (see Done). Original note: **The QuestIDE code runner may be broken (from code, unverified at runtime):** the hidden runner window (`common/code_runner.js:26-30`) sets only `nodeIntegration`, without `enableRemoteModule`, but `public/code_runner/runner.js:41` calls `require('electron').remote.BrowserWindow` in `log()`. On Electron 11, `remote` is off by default, so a learner's `console.log` may throw. Needs a runtime check (run code in the in-game editor) and then a fix. The Electron upgrade will replace this with IPC anyway.
8b. [A] DONE in cycle 3. Original note: Declare `ws` in root `devDependencies`; `tasks/verify.js` uses it, and it is only a transitive dependency today.
9. [A] DONE in cycle 3. Original note: stale keys (`initialLevelName` -> `defaultLevelName` plus the `*Prologue` variants) and the dead `apiBaseUrl` (drop it; dev rewrites to the dev host anyway).
9b. [A] DONE in cycle 3 (the task was retired). Still open: whether `tasks/create_release.js` handles the `public/node_modules` symlinks (node-tar, unverified). Original note: Retire or rewrite `tasks/update_bundled_extensions.js` (it runs `npm install <name>@latest` in `public/`, which would undo the vendoring). Check that `tasks/create_release.js` follows the `public/node_modules` symlinks (unverified).
10. [C] DONE in cycle 3. Original note: security model, only enable extensions you wrote or read (decision 4).
11. [B] Dead links (nodejs.org arg parsing x5, `github.com/twilio/twilioquest`, others in HANDOFF 3.4); Linux gaps (`js_node_workspace`, `terminal_cd`, `js_unlock_door`); `create_repo` git identity step; Python 3.7 text. Needs vendoring.
12. [A] DONE in cycle 4 (see Done).
12a. [A] **Reproducible install hazard (found in cycle 4, high priority):** root `postinstall` runs `install:app` = `cd ./public && npm install`. In a fresh worktree this ignored `public/package-lock.json`, pulled cheerio 1.2.0 (which needs `node:stream`, too new for Electron 11's Node) and rewrote the lockfile. The app then hung on "Loading" until `npm ci` restored cheerio rc.10. Fix: make `install:app` use `npm ci` (or pin cheerio), then confirm a clean clone with `npm install` gives a working game. Also, `npm install --ignore-scripts` at the root flips `dev` to `extraneous` flags on npm's bundled deps in the lockfile; this is harmless churn, so discard it.
12b. [A] Sass deprecations: 30 `@import`, 2 `lighten`/`darken` (`_Inventory.scss:5`, `_ItemPopover.scss:8`). Migrate to `@use` and `color.adjust` sometime; low priority.
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
- `6a7e991` [B] open-source `04_git_clone`: the walkthrough cloned the non-existent `open-pixel-project` (404). It now uses the learner's fork URL, `<%= env.TQ_GITHUB_USERNAME.value %>/open-pixel-art.git`, through the same EJS templating as descriptions (`ObjectiveDescription.jsx:54-100`). Also fixed the typo "omn". Validator mock: 4/4 cases as expected.

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

- `7949a41` [A] all 4 test suites load. Cause: `@jest-runner/electron` opens its window without `enableRemoteModule`, so `remote` is undefined; `src/test/setup.js` now mocks `remote.app`. Also restored the missing fixture `aaa-exhaustive-config-extension/node_modules/foo` (it had been hidden by `.gitignore`).
- `c845874` [A] `npm run verify` (`tasks/verify.js`): build, tests, and a CDP launch smoke test with a screenshot and save-file backup and restore.
- `7eec3ac` [A] validator timeout: `runValidator.js` reports exactly once. A run past 60 s is stopped with "took too long". A validator that returns without reporting fails after a 10 s grace period. Throws and rejections are shown to the player. Late results are ignored, and the Firestore `.catch` is added. Has 10 unit tests. Tradeoff I accepted: the 10 s grace exists because `js_node_env_setup` returns before its spawn reports. A validator that returns early and then reports more than 10 s later would now fail. None was found, but I did not audit them all.
- `0809b5f` [A] `HackInterface` failing to load an objective now logs, shows the toast "Sorry, this terminal could not be opened." and calls `close()`. Runtime check over CDP: `hackObject` cleared within 2.5 s and the toast was shown.
- `722ba7a` [A] jest ignores `.claude/` worktrees, which were polluting the main-checkout test runs.
- **Test baseline is now: 5 suites, 49 tests, all passing.** Orchestrator ran `npm run verify` in the main checkout: build OK, 49/49, smoke OK, and the screenshot shows the title screen.

- `docs/security.md` (cherry-picked from `ec838b4`) [C]: the security model in plain English, the rule about which extensions to trust, an authoring checklist, accepted risks, and a pointer from CLAUDE.md. Verified against code: 11 `dangerouslySetInnerHTML` sites, none sanitized; Pug and EJS templates execute JS.

- `86aa2e5` [A] `local_config.template.js` now shows the real `default*` keys and the prologue precedence (`levelLoader.js:90-95`, `Game.jsx:101-107`), and drops the dead `apiBaseUrl`.
- `93917ac` [A] `ws` declared in root devDependencies (lockfile +2/-1).
- `1c39b61` [A] retired `tasks/update_bundled_extensions.js`, which would have undone the vendoring.
- `2395245`, `edc97f0`, `1ddcffe` [A] offline mode: `config.backendEnabled` defaults to false, through `common/backend.js` `isBackendEnabled()`. With it off: no user-sync, team and operation joins and unlock codes show "Online features are not available in this version.", and there are no live-event Firestore calls. `gameEvents` and analytics were already no-ops.
- `b0cfb25` [A] the Spector.js WebGL debugger loaded from a CDN on every dev launch. It now loads only with `enableSpector`.
- Runtime check by the agent over CDP: 53 requests in 20 s, all `file://`, so zero remote requests. Orchestrator ran `npm run verify` on the merged branch: build OK, tests 52/52 (6 suites), smoke OK, **0 console errors** (it was 2).
- FYI: the Mission Computer lists only one mission, "Raid the Dark Ducktypium Forge". The other content shows up as nav-map destinations: Tower of Infinite Knowledge, API Academy, JavaScript Test Lab, Forest of Open Source and Pythonic Temple.

- `c08becd` [B] `owl_plant_tree1` marked `hidden`. It was already unreachable: `fog_owl/level.json` has no `objectives` manifest, and no map object refers to it.
- `d9fd991` [A] **QuestIDE `console.log` was broken, confirmed at runtime.** Before the fix, `runner.js:41` threw `TypeError: Cannot read property 'BrowserWindow' of undefined` for every console call, and the main window received no `code_runner:log`. The runner window now has `enableRemoteModule: true` (`code_runner.js`). After the fix, `hello from runner` reached the main window with no exception. This affects 23 `show_ide` objectives, e.g. API Academy turing_initiation, api-01 and api-02. The agent's verify: 52/52, 0 console errors.

- `8817712` [A] `node-sass` replaced by `sass`, pinned exactly to 1.99.0, the last release that runs on Node 18 (1.100+ needs Node >= 20.19, because chokidar 5 is ESM). No SCSS changes were needed. Compared with node-sass, the CSS differs only cosmetically (formatting, `black` printed as `rgb(0,0,0)`, sub-1/255 colour rounding). Root lockfile: 161 packages removed, 22 added. The watch script was tested.
- `1f75ef3` [A] dropped the Python pin from `mise.toml`: nothing needs node-gyp any more. Docs updated (CLAUDE.md, README, HANDOFF 3.1). Caveat: an install without Python was only reasoned through statically, not tested. Note that `LOOP_PROMPT.md` (the user's prompt) still says Python 3.9; I left it for the user.
- Orchestrator ran `npm run verify` on the merged branch after `npm install --ignore-scripts`: build OK, 52/52, smoke OK, 0 console errors, and the title screen is unchanged.

## Blocked

- `dev_skills` revival: waiting on the user (see decisions).

## Decisions needed from the user

2. **API Academy api-03 and api-04 cannot be completed**, because their `twilio.com/quest/magic` endpoints are gone. The proposal is to add local fakes, in `ValidationHelper.fetchOverride` and `public/code_runner/runner.js`, and have the validators use them. The lesson steps would stay the same, but this means new invented content: (a) a fixed magical phrase for api-03, and (b) a small invented JSON book list for api-04, in the walkthrough's schema. Approve (a) and/or (b)? The alternative is to leave them broken or hide them.

1. **`dev_skills`**: it is unreachable today and needs about 5 engine and content fixes plus a new `terminal_script_multi` objective. Options: (a) leave it dormant and play `twilioquest-dev-fundamentals` for terminal basics (recommended for now); (b) revive it as a mission in an in-repo extension, which means engine fixes plus writing or repointing the final chest objective.
