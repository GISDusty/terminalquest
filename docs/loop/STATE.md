# Improvement loop ledger

Orchestrator state for the loop described in `LOOP_PROMPT.md`. Read at the start of every cycle, update at the end. Tracks: A = game runs, B = content, C = docs.

## In progress

- Cycle 8 (2026-10-26):
  - [A] test migration steps 1-2: jsdom environment, Enzyme replaced by RTL 12.1.5, `@jest-runner/electron` removed (Sonnet, worktree).
  - [C] Rust mission guide plus an example extension in `docs/authoring/` (Sonnet, worktree).
- Cycle 7, continued: the dev_skills final chest becomes a plain reward chest (the user chose this on 2026-10-26), plus the first real end-to-end objective pass (pwd) and the Esc check (Sonnet, worktree).

## Backlog (ranked)

1. [A] `dev_skills` phase 2: play-test a real objective pass (pwd), then confirm the barrier opens and stays open after reload and that XP is awarded. Then the final chest, once the user decides. Also: Esc did not close the HackInterface under CDP key events; check whether that's a real bug.
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
11. [B] Mostly DONE in cycle 6 (see Done). Remaining:
   - 4 extension `README.md` files link to the 404 `github.com/twilio/twilioquest`;
   - dead links with no replacement: boredapi (flavour text), open-pixel-art.com, yourfirstpr (both optional);
   - leftover version samples (`Versions/3.7` Mac path, `Python 3.7.4` REPL banner, `git version 2.22.0`);
   - `terminal_cd` Linux gap, which is in unloaded dev_skills.
   Optional proposal: link the current Microsoft Store Python Install Manager (`apps.microsoft.com/detail/9nq7512cxl7t`) instead of the docs.python.org Windows page. Not verified.
11-old. [B] Dead links (nodejs.org arg parsing x5, `github.com/twilio/twilioquest`, others in HANDOFF 3.4); Linux gaps (`js_node_workspace`, `terminal_cd`, `js_unlock_door`); `create_repo` git identity step; Python 3.7 text. Needs vendoring.
12. [A] DONE in cycle 4 (see Done).
12a. [A] DONE in cycle 5 (see Done). Original note: **Reproducible install hazard (found in cycle 4, high priority):** root `postinstall` runs `install:app` = `cd ./public && npm install`. In a fresh worktree this ignored `public/package-lock.json`, pulled cheerio 1.2.0 (which needs `node:stream`, too new for Electron 11's Node) and rewrote the lockfile. The app then hung on "Loading" until `npm ci` restored cheerio rc.10. Fix: make `install:app` use `npm ci` (or pin cheerio), then confirm a clean clone with `npm install` gives a working game. Also, `npm install --ignore-scripts` at the root flips `dev` to `extraneous` flags on npm's bundled deps in the lockfile; this is harmless churn, so discard it.
12b. [A] Sass deprecations: 30 `@import`, 2 `lighten`/`darken` (`_Inventory.scss:5`, `_ItemPopover.scss:8`). Migrate to `@use` and `color.adjust` sometime; low priority.
13. [A] DONE in cycle 5 (see Done). Kept: `express`, `body-parser`, `jimp` and `got` (not traced fully; possibly removable), plus `@babel/runtime*` (needed by `corejs: 2`). Follow-up: test whether `legacy-peer-deps` is still needed now that `@electron/remote` is gone. Original note: Drop dead deps: `vm2`, `@electron/remote`, `@sendgrid/*`, `universal-analytics`, unused Babel plugins.
14. [A] Replace Jest 26, `@jest-runner/electron` and Enzyme; this is the prerequisite for the React and Electron upgrades. The cycle 6 audit is done (I spot-checked the setup and Enzyme claims). The plan:
   - Facts: no test needs a real Electron API, because the `setup.js` stub covers `remote.app`. Enzyme is used once, in `Button.test.js` (`shallow`, plus one class assertion). `setup.js` `window.eval`s phaser and firebase from `public/lib`, so every suite needs a window, which means jsdom.
   - (1) Swap the runner to `jest-environment-jsdom@26` and keep the electron stub. Risk: phaser `eval` under jsdom.
   - (2) Replace Enzyme with `@testing-library/react@12.1.5` (the only line that supports React 16 and Node 18; pair with `@testing-library/dom@^8`). Use a plain DOM assertion, or `@testing-library/jest-dom@5.17.0`. Then drop `enzyme`, the adapter, and the adapter lines in `setup.js`. Risk: a duplicate React if RTL resolves from the root, since React lives in `public/node_modules`.
   - (3) Jest 26 to 29.7, together with babel-jest and jest-environment-jsdom. Re-run the `runValidator` timing tests.
   - (4) Remove `@jest-runner/electron`; the Electron upgrade is then unblocked.
   - (5) Later, with React 18: RTL 14 or 16, `@testing-library/dom@10`, jest-dom 6.
15. [A] Electron 11 -> current: preload + IPC instead of `remote` (app files, `public/code_runner/runner.js`, vendored `twilioquest-python/scripts/objectiveValidation.js`).
16. [A] Node 18 -> current LTS.
17. [A] React 16 -> 18+ (after Enzyme is gone).
18. [A] Babel `corejs: 2` config.
19a. [A/C] `npm run scaffold:mission` writes to `public/levels/<name>/`, which is not loaded. Its `level.json` also has no `objectives` list, and it uses the old `entities/` layout. Point it at an extension (e.g. a user extension dir or a new in-repo `public/extensions/<name>`) and update the template. Registering a new in-repo extension takes 4 steps (unverified).
19. [C] Authoring docs: DONE in cycle 6 (except the Rust guide, which is next). Original note: Authoring docs from upstream `extension-docs` and `twilioquest-extension-template`; Rust mission guide.
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

- `e01a1c4` [B] api-05: the description had unfilled `{{DIVINATION_ENDPOINT}}`, `{{GUID_ARGUMENT}}` and `{{REPAIRED_INSCRIPTION}}` placeholders. It now states the exact URL, `https://twilio.com/quest/magic/divination?target=lovelace_secret_statue`, for GET and PATCH, and says the guid goes in the body (a `guid=` in the URL hits the validator's check path in `fetchOverride`; I checked this).
- `270b4a8` [B] 03-debugging-3: the dead `ducktypium-diagnostics` hyperlink is now inline code. The validator is unchanged.
- `7443407` [A] **Install hazard fixed.** Root cause: the root devDependency `"npm": "^6.14.8"` put npm 6 first on PATH inside npm scripts, so the nested `public/` install ran under npm 6, which ignores the v3 lockfile, re-resolved everything and pulled cheerio 1.2.0. The npm devDependency is removed. The new `tasks/install_app.js` runs `npm ci` in `public/` with the invoking npm (`npm_execpath`). Agent's clean-clone proof: `npm install` and `npm ci` both left the lockfile untouched, with cheerio rc.10 and verify passing.
- `fffdc56`, `80831c3`, `a9451b8` [A] removed dead deps: `vm2`, `@sendgrid/*`, `universal-analytics` (`analytics.js` is now a no-op with the same exports), `@electron/remote`, `i`, `babel-plugin-file-loader`, `babel-plugin-module-resolver` and `react-dev-utils`. That is 50 packages fewer in `public/` and 81 fewer at the root, with no kept package changing version. Require check over `public/extensions` and `public/code_runner`: 68 requires, 0 unresolved.
- Orchestrator re-synced the main checkout with a plain root `npm install`: lockfiles untouched, npm 6 gone from `.bin`, cheerio rc.10. `npm run verify`: build OK, 52/52, smoke OK, 0 console errors.

- `2a8b90f` [B] link fixes. Checked 208 unique lesson URLs: about 194 OK, 7 blocked to curl (403), 7 dead. Fixed: the nodejs.org argv page in 4 JS walkthroughs; the dead Microsoft Store Python 3.7 listing, now docs.python.org/3/using/windows.html; fullstackpython (missing TLD); the groundskeeper `<a ref=` typo plus its link; **sci-hub proxy links** in api-04 and book-1..4.pug, now DOI or publisher links taken from the original URLs (I checked; the DOIs answer 403/418 to curl, so they are unverified by curl); `docs.python.org/3.7` changed to `/3`.
- `2e56ca6` [B] Linux instructions in js_node_workspace, js_unlock_door, 03_install_git, python_basics_install and python_basics_hello. `9069b2e` adds a git identity note (`git config --global user.name/email`) to create_repo. `00d378c` changes "latest Python 3.7.4" to "any recent Python 3". All 23 changed files pass an EJS/pug render check.
- `eaf6499` [C] **authoring docs**: `docs/authoring/` (README, extension, mission, objective, validator, map, about 1600 lines), adapted from upstream MIT `extension-docs` and the extension template (attribution plus licence included) and checked against our code, with "Differs from upstream" notes. Path checker: 0 missing. The validator mock recipe was run (11/11). Correction to an earlier ledger note: the `objectives` manifest does not gate opening a terminal (`HackInterface` reads `objective.json` directly). It drives XP, percent and completion only.
- [A] test-stack migration audit (plan under backlog item 14).
- Orchestrator ran `npm run verify` after the merges: build OK, 52/52, smoke OK, 0 console errors.

- `667381f`..`1e591ad` [A/B] **dev_skills revived (phase 1)**. It was moved with `git mv` into the new bundled extension `public/extensions/terminalquest-dev-skills/` and registered (`public/package.json` `file:` link plus `bundledExtensionModules.json`); this is the first real run of the "new in-repo extension" steps. `level.json` got an `objectives` manifest, an object `backgroundEffect` (the `"vr"` string failed yup), and a short quest text. The dead Earth Day tree hook was dropped from events.js. Engine changes: `barrier`/`chest` are legacy types (`EntityConfigService.js:67-68`); `customSort` falls back to sprite bounds (`DynamicLevel.js:~302`); new `entities/base/openHackInterface.js`, used by `HackableBarrier`/`HackableChest` `interactionEffect()`. Also fixed the map Collision layers, which were missing `collision`/`hidden`, so barriers could be walked around. Runtime over CDP: the level loads with 0 exceptions, the Mission Computer lists "Capture The Flag", there are 4 barriers and 1 chest, and interacting with the pwd barrier opens the hack UI. I viewed the screenshot. The chest shows the toast and clears `hackObject`. Orchestrator ran a root `npm install` (lockfiles untouched, symlink created) and `npm run verify`: 52/52, 0 console errors. Not yet verified: a real objective pass and the state after it.

- `436361e`, `9032f73`, `d093c40` [B] **API Academy api-03 and api-04 are completable offline.** `src/js/app/common/apiAcademyStubs.js` is one shared CommonJS module, used by `ValidationHelper.fetchOverride` and by `public/code_runner/runner.js` (which requires the compiled `public/app/common/apiAcademyStubs`). The api-05 fake moved into it unchanged. The api-03 phrase is Ada Lovelace's 1843 line. The api-04 books are the 4 in-game papers, with DOIs, years and page counts from Crossref (36, 8, 5 and 8 pages). The api-03 and api-04 validators now use `helper.fetchOverride`. Book 4's pug link wrongly reused book 1's DOI; it now has its own (`10.1109/MS.2009.193`). Harness: 17/17 cases. A CDP runner check showed the learner's `fetch` gets the phrase and 4 books. Tests went from 52 to 91. Orchestrator ran `npm run verify`: 91/91, 0 console errors. Weakness: with only 4 books, api-04's threshold 100 gives an empty answer, and 30 and 15 give the same answer. It still passes and fails correctly, but the original data probably had more books (unknown).

## Blocked

(none)

## Decisions needed from the user

3. **ANSWERED 2026-10-26: plain reward chest** (option a); implementation is in progress. Original: **dev_skills final chest** (`maps/terminal.json` id 68) points at the missing `terminal_script_multi`. Options: (a) make it a plain reward chest that opens once the 4 barriers are done, with no new lesson (recommended); (b) write a new objective `terminal_script_multi` (new lesson content, e.g. a script with several commands); (c) leave it showing "could not be opened".

2. **ANSWERED AND DONE (see Done, `436361e`).** (A) local stand-ins. The api-03 phrase is Ada Lovelace's public-domain 1843 Analytical Engine line. api-04 uses the 4 in-game papers, with page counts from the walkthrough and Crossref. Implementation is in progress. Research notes: **Research done (cycle 7).** The original backend ("TwilioQuest-Server") is not public anywhere I could find: not in the GitHub orgs, not in code search, not in npm versions 1.0.0..3.0.3, not in the Wayback Machine. So the original api-03 phrase and the api-04 JSON are lost. Facts:
   - api-03's validator accepts any phrase (case-insensitive match against the fetched text).
   - For api-04, the 4 books in-game (`book-1..4.pug`, MIT) give titles, DOIs and authors. The walkthrough gives pageCount 36 and 8 for two of them; the other two pageCounts could come from public DOI metadata.
   - Upstream itself (api-academy 3.0.3, archived) **disabled** api-03 and api-04 by setting `hackable: false` on map objects 545 and 546 in `lovelace_tower/maps/default.json`. Note that the secret door (object 746) needs api-04 completed; check whether it gates api-05.
   - Options: (A) local fakes, with an invented phrase for api-03 and the in-game book list for api-04; (B) apply upstream's disable; (C) leave them as they are.
   Earlier:  the user wants to look for the original data in the upstream API Academy repos (same authors) rather than inventing it. Research is running. Original question: **API Academy api-03 and api-04 cannot be completed**, because their `twilio.com/quest/magic` endpoints are gone. The proposal is to add local fakes, in `ValidationHelper.fetchOverride` and `public/code_runner/runner.js`, and have the validators use them. The lesson steps would stay the same, but this means new invented content: (a) a fixed magical phrase for api-03, and (b) a small invented JSON book list for api-04, in the walkthrough's schema. Approve (a) and/or (b)? The alternative is to leave them broken or hide them.

1. **ANSWERED 2026-10-26: enable `dev_skills`**, i.e. option (b), revive it. Still open: what the final chest should do (repoint it to an existing objective, or write `terminal_script_multi`); ask once phase 1 lands. Original question: it is unreachable today and needs about 5 engine and content fixes plus a new `terminal_script_multi` objective. Options: (a) leave it dormant and play `twilioquest-dev-fundamentals` for terminal basics (recommended for now); (b) revive it as a mission in an in-repo extension, which means engine fixes plus writing or repointing the final chest objective.
