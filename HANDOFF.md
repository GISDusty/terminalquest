# TerminalQuest revival: handoff

Written 2026-10-25 for a later review (e.g. by Opus). The repo is a fork of TwilioQuest, an Electron + React 16 + Phaser 2 RPG for learning to code. Nobody has maintained it for a while. The goal is to revive it as a personal learn-to-code game.

Provenance: sections 1 and 2 were done and checked directly in this session. Section 3 comes from three read-only Haiku subagent audits. Those were not independently re-verified, and anything marked (unverified) was unverified by the auditors too. Treat section 3 as leads to confirm, not facts.

> **Update (improvement loop, 2026-10-25):** the live state is now `docs/loop/STATE.md`, and it supersedes this file where they disagree. Key corrections: the content packages are vendored into `public/extensions/` (so the "edits there do not survive" caveat in 3.4 no longer applies; fix lessons in `public/extensions/`). `dev_skills` is never loaded by the game, because `public/` is not an extension root, and it also has engine bugs, so the `terminal_script` fix (24a3962) is not playable. The `npm test` baseline: 3 of 4 suites fail to load.

## 1. Status: it runs

The game builds and launches on this machine (Arch/Omarchy, Wayland). A screenshot confirmed the title screen ("PRESS SPACEBAR TO START" / "MISSION BRIEFING") renders. I have not played past the title screen, so gameplay, missions and saves are untested.

Machine defaults are Node 26 and Python 3.15, which are too new. I used `mise` to run with Node 18 and Python 3.9 without changing system defaults and without adding any files to the repo:

```
mise exec node@18 python@3.9 -- env npm_config_legacy_peer_deps=true npm install
mise exec node@18 python@3.9 -- npm run build:all
mise exec node@18 python@3.9 -- npx electron .      # or: npm start (build + watch + launch)
```

Things learned:
- Plain `npm install` fails with ERESOLVE. `@electron/remote@2.0.9` wants electron >= 13 but the repo pins electron ^11.5.0. The repo was written for npm 6, which ignored peers, so `--legacy-peer-deps` restores the old behaviour. The nested `public/` install triggered by `postinstall` inherits the env var.
- `.nvmrc` says `12`, while README says Node 18. Node 18 worked. Whether Python 3.9 was actually needed is untested, since node-sass probably used a prebuilt binary.
- The launch log shows an `electron-devtools-installer` error (`cross-unzip` exit code 9). It is non-fatal and only affects the React DevTools extension download in dev. `unzip` is installed, so the cause is not yet known.
- Fontconfig warnings about `48-guessfamily.conf` are system noise, unrelated to the project.
- `npm install` reports 283 root and 162 `public/` vulnerabilities. They come from old pinned packages, and nothing was fixed.
- Build output is git-ignored (`public/index.*`, `public/app/`), and `git status` stayed clean after install and build apart from the new `CLAUDE.md` commit.

Since then: `mise.toml` (Node 18, Python 3.9), `.npmrc` (`legacy-peer-deps=true`) were added and `.nvmrc` was corrected to `18`, so inside the repo `mise` picks the right toolchain and plain `npm install` works. The `local_config.template.js` dead-host trap in 3.2 is still not fixed.

## 2. Commits so far

- `24005ff` add CLAUDE.md (on `main`). It was committed with a one-off `-c user.email=...` because the repo has no git user.email configured.
- Everything after that lives on the `revival` branch, which the user will update with their say-so. `main` is untouched. See `LOOP_PROMPT.md` for how the improvement loop uses the branch.
- Remotes (2026-10-25): `origin` is the user's fork `GISDusty/terminalquest` (public), and `upstream` is `TerminalQuest/terminalquest`, which has been dormant since February 2024. `revival` is pushed to `origin`. The user's five big-issue decisions are recorded in `LOOP_PROMPT.md`.

## 3. Findings: what is stale

### 3.1 Dependencies and tooling (Haiku audit)

Versions are from `npm view` on 2026-10-25.
- **electron ^11.5.0**: very old (latest is 45). The upgrade is large. Renderer code uses `remote` directly (see 3.3), and `electron-devtools-installer`, `electron-context-menu` and `electron-is-dev` would also need changes.
- **node-sass ^8**: deprecated in favour of `sass`. The swap is small, since it only affects the `build:css` and `watch:css` scripts. Watch for `@import` and `/` division deprecation warnings (unverified). (done: swapped for sass, see docs/loop/STATE.md)
- **jest/babel-jest 26** with `jest-environment-jsdom` 26 and `@testing-library/react` 12 (React 16 line): Enzyme and `@jest-runner/electron` are gone, so tests no longer depend on the Electron version. Jest 29 and RTL 14+ are still to do, together with React 18.
- **react/react-dom 16.8.6**, styled-components 5, electron-store 6, uuid 3, express 4, jimp 0.16, twilio 3: all stale. None is blocking right now.
- **aws-sdk v2** and **firebase-admin 8**: used only by `tasks/` (voice-over generation, mission sync, release). They matter only if those tasks are revived. firebase-admin latest needs Node >= 22.
- **vm2** is declared in `public/package.json` but is not imported anywhere, so it is likely removable.
- **The twilioquest-\* bundled content packages are all still published on npm.** `twilioquest-base` 8.1.0 is the pinned version. `twilioquest-dev-fundamentals` 2.4.0 was last published 2022. Whether their licenses allow redistribution in a fork was not checked.
- Babel 7 with `transform-runtime corejs:2` is likely a blocker for Babel 8 (unverified).

### 3.2 External services and content (Haiku audit)

All backend calls go to `twilioquest-prod.firebaseapp.com/quest/` (see `src/js/app/config/config.js`). The server code is not in this repo, and **no endpoint was probed, so liveness is unknown.**
- Likely to fail if the backend is dead:
  - The hidden Plant-a-Tree objective (`public/levels/common/dev_skills/objectives/skills_plant_tree1/validator.js`) POSTs to the backend and fails the objective on network error.
  - Unlock codes (`UnlocksTab.jsx`) and team join codes (`common/teams.js`, `common/operations.js`) both depend on the backend.
- Degrades quietly: Firestore live events (`Validator.jsx` has a promise chain with no `.catch`), cloud user-sync (`common/context/sync.js`, errors are only logged), the tree counter, and iframe overlays.
- Analytics is effectively off: the hit bodies in `common/analytics.js` are commented out, and Google's Universal Analytics was sunset in 2023.
- **Config trap:** `src/js/app/config/local_config.template.js` sets `apiBaseUrl` to `https://www.dev.twilio.com/quest/`. `config.js` only rewrites the prod URL, so a copied template keeps the dead host.
- Twilio branding and content: stale 2021 Earth Day event (`public/levels/common/events/trees.js`), Twilio/SendGrid dialogue in `public/levels/common/dev_skills/conversations/` (`kevin.pug` includes a `kw@twilio.com` mailto), `twil.io` short links in Help and the tree objective, and Twitter links in `Credits.jsx`. Roughly 90 Twilio-product images in `public/images/` (flex_intro, programmable_wireless, studio, whatsapp, sendgrid, programmable_sms) had no references in `src/` or `public/` outside `lib`. They may be used by npm extensions (unverified).
- Unused deps in `public/package.json`: `@sendgrid/*` has no imports. `twilio` is used only by `ValidationHelper.js`.
- External learning links in the dev_skills objective docs (kiddle, techterms, educative, shapeshed, docs.microsoft.com and others) were not link-checked.

### 3.3 Code health (Haiku audit)

- **Electron upgrade blockers:** `remote` from `electron` is used in about 7 files in `src/js` (`index.js`, `analytics.js`, `code_runner.js`, `App.jsx`, `Extensions.jsx`, `Settings.jsx` (unused import), `config.js`) plus `public/code_runner/runner.js`. `@electron/remote` is declared in `package.json` but never initialized, so it is a dead dependency. `nodeIntegration: true` is set in `main.js` and in the hidden code-runner window, and `contextIsolation` is not set anywhere. `electron-is-dev` is used in 8 files.
- **Possible existing bug (unverified, not reproduced):** `public/code_runner/runner.js:41` uses `require('electron').remote`, but the runner window doesn't set `enableRemoteModule`.
- **Security posture:** user code runs with full Node access (`vm.runInThisContext`, `require` injected). Validators use Node's built-in `vm`, which is not a security boundary. There are 11 `dangerouslySetInnerHTML` sites (sanitization unverified), and extensions load via plain `require`. This is acceptable for a single-user local learning game, but it is not safe to treat as sandboxed.
- **Tests:** 4 files and 39 cases (`assetLoader` 24, `extensions` 13, `analytics` 1, `Button` 1). Coverage is thin: `ValidationHelper`, `code_runner`, `context` and the game code are untested. The test suite has not been run in this session. **There is no CI:** commit `fadb7e4` removed all workflows.
- **Dead code and TODOs:** `evalQuestIdeUserCode` in `ValidationHelper.js` (no callers), unused `public/lib/phaser-2.11.0.min.js`, and overdue 2020 TODOs in `context/schema.js` and `ContextProvider.jsx`. There are 42 class-component files against 14 using hooks. No removed React lifecycle APIs were found.
- **Phaser 2.13.2:** loaded via a script tag, used in about 24 files, and central to `components/game/` (31 files) plus `common/tiled.js`. Replacing it would be a rewrite, not an upgrade.

### 3.4 Lesson content currency (three Haiku audits, round 2)

Same caveat as above: not independently re-verified, except the two items marked "checked by me". Link checks were `curl -I` (HEAD) only, so 403/405 results are not confirmed dead.

Where the content lives matters. The `dev_skills` level is in the repo (`public/levels/common/dev_skills`). Everything else is in npm packages under `public/node_modules/` and is wiped by a reinstall. Edits there do not survive. An external extension takes precedence over bundled ones for the same relative path (`assetLoader.js`), so fixes to bundled lessons can live in an external extension instead (see 3.5).

Objectives that cannot be completed:
- `dev_skills/terminal_script`: **checked by me.** `objective.json` asks for a `scriptPath`, but `validator.js` and `walkthrough.md` were byte-identical copies of `terminal_safety`'s and never read it. **Fixed (uncommitted, not yet tried in the game):** the new validator checks that the pasted path is a file, looks like a script (`.sh`/`.bash`/`.zsh`/`.ps1`/`.bat`/`.cmd` or a shebang) and contains an `echo`/`Write-Host`/`Write-Output` line. It strips surrounding quotes and expands `~`. It does not run the script. Tested with a mock helper against 8 cases (empty, missing, folder, good, quoted, no echo, wrong extension, shebang). The walkthrough was rewritten to teach scripts (Mac/Linux and Windows), and the placeholder now shows both path styles.
- **Possible new issue, unverified:** the final chest in the `dev_skills` map (`maps/terminal.json`, id 68) uses `objectiveName: terminal_script_multi`, and no such objective directory exists. The barrier chain is pwd, safety, cd, script, then this chest. What the chest does with a missing objective has not been tested.
  - **Investigated by reading code (not run):** `TileObject.interactionEffect` is the only code in `src/js` that sets `hackObject`, and only when the object has `hackable` set. `HackableBarrier` and `HackableChest` (the legacy `barrier`/`chest` map types in `EntityMap.js`) extend `SpriteObject`, define no `interactionEffect`, and the `dev_skills` map objects have no `hackable` property. So pressing interact on these may do nothing, for the first barrier as well as the chest. This is separate from the missing objective. Nothing outside `dev_skills` uses `barrier`/`chest` types (checked across all bundled levels); other levels use object configs under each extension's `objects/` directory (e.g. `chest-autumn`, built by `twilioquest-base/scripts/createChestConfig.js`).
  - If a hack does open for the missing objective, `HackInterface.loadObjective` throws "Tried to open an objective that didn't exist!" inside an async call. `hackObject` stays set, which pauses game keyboard input (`Game.jsx` `handleGlobalStateChanges`), and only `HackInterface.close()` clears it. That would plausibly soft-lock the player until restart. Also not run.
  - Needs a runtime test: start in `dev_skills` (copy `local_config.template.js` to `local_config.js`, set `initialLevelName: 'dev_skills'`, and fix its `apiBaseUrl`), then interact with the first barrier.
- `twilioquest-javascript/green-keycard`: **checked by me.** The validator is an empty stub that never calls `success` or `fail`. The walkthrough describes a Twilio SID and token, but the objective has a single `keyCard` prompt.
- `dev_skills/skills_plant_tree1` (hidden objective) POSTs to the likely-dead Firebase backend. The donation promo link redirects to a generic Twilio blog post.
- `twilioquest-api-academy` api-03 to 05 and `twilioquest-base` `03-debugging-3` depend on `twilio.com/quest/magic` and `/quest/ducktypium-diagnostics`. HEAD requests to them redirect to `github.com/TerminalQuest`. GET behaviour is unverified, so the validators may or may not work.
- `twilioquest-open-source/04_git_clone` clones `open-pixel-project`, which returns 404 (`open-pixel-art` is the name used elsewhere). `07_sync_master` hardcodes `branches/master` on `twilio-labs/open-pixel-art` (upstream default branch unverified).

Outdated or incomplete advice:
- Python lessons (`twilioquest-python`) say the latest Python is 3.7.4 and link `docs.python.org/3.7` (3.7 is EOL). pip and venv are never mentioned. No Python 3.12+ breakage was found in lesson or validator code (not executed).
- The Python validators have a 5 s hard timeout (`executePythonCode`) and a 30 s timer whose message says "five seconds". `scripts/objectiveValidation.js` uses `require('electron').remote`, another Electron-upgrade blocker.
- Several lessons skip Linux: `js_node_workspace`, `terminal_cd` (`description.md:20`) and `js_unlock_door` mention only Mac and Windows. `create_repo` runs `git commit` without a `git config user.name`/`user.email` step. `js_node_env_setup` only checks that `node --version` runs, with no version floor.
- Heroku suggestion in `sms1`, 2021/2022 event content (Earth Day, "first 10,000 players"), and the api-04 walkthrough links to a piracy site (reported by the auditor, not checked).
- Twilio-account lessons (`twilioquest-twilio-vr`, `twilioquest-api-academy` keys) need paid or third-party accounts. Python, dev-fundamentals, `dev_skills`, `twilioquest-base` challenge questions and most of JavaScript appear to work offline.

Dead links (verified by HEAD): nodejs.org "how to parse command line arguments" (404, in five JS walkthroughs), `github.com/twilio/twilioquest` (404, README links), `yourfirstpr.github.io`, `open-pixel-art.com`, `twimlillionaire.com/.net`, `boredapi.com`, a truncated Wikipedia PATH link, three twilio.com blog or how-to pages, and a `fullstackpython` link with no TLD. About 70 more links only redirect (help.github.com, docs.microsoft.com, MDN, docs.python.org anchors).

Not audited: the full text of lessons for factual correctness beyond the above, and how well the lessons teach (pedagogy).

### 3.5 Rust mission feasibility (Haiku audit)

Feasible, no architectural blockers. The bundled Python extension is the template. Details to check against the code before building:
- Validators run in the renderer with Node access, so `child_process` works. There is no compile/run helper, so a Rust validator must supply its own spawn, timeout and `kill()`. Use `execFile`/`spawn` with an args array (as in the Python validators), not the shell-string approach in `ValidationHelper.isExecutableValid`.
- No streaming: a validator calls back once, so buffer compiler output and report at the end. If a validator never calls back, the UI stays stuck in the "hacking" state.
- Feedback is rendered with `dangerouslySetInnerHTML`, and `rustc` errors contain `<`/`>`, so HTML-escape and wrap them in `<pre>`.
- Unverified: whether Electron sees `~/.cargo/bin` on its `PATH` (depends on how it is launched), and whether `cargo` build time fits a short timeout. Use the Python install validator (`<path> --version`) as the pattern for finding the toolchain.
- Authoring: `npm run scaffold:mission -- <name>` writes into `public/levels/` and refuses to overwrite. Minimum to appear as a mission (inferred, not run): `level.json` (title, `is_mission: true`), an objective with `objective.json` (include `validation_fields`), `validator.js`, `description.md`, and `maps/default.json` with a `player_entry1` object. Levels that fail validation are silently dropped.
- Where to put it: personal content belongs in an **external extension** (a folder with a `package.json` containing `name` and `version`, enabled in Settings, runs arbitrary JS). It survives `npm install` and can also override bundled lesson files. Do not put content in `<ext>/.bundled`, which is wiped at startup.

## 4. Suggested next steps (for review and prioritisation)

User's stated direction (2026-10-25): play and learn first; keep everything up to date because they are learning from it; may add content later, possibly Rust. This favours content correctness and a reproducible setup over upgrading Electron or replacing Phaser. The recommended order below reflects that. The original, broader list follows it.

Recommended order:
1. Play-test the first missions end to end (dev_skills terminal missions, `twilioquest-dev-fundamentals`, JS basics) and record what actually breaks. Confirm or refute the leads above.
2. Create an external extension for personal content and fixes, with an override for each broken or outdated file in 3.4 that the user plans to play (start with `terminal_script`, dead links, Linux instructions, Python 3.7 text). Decide which bundled content to hide (Twilio-account missions).
3. Make failures from dead backends non-blocking or remove those objectives (plant-a-tree, unlock codes, team join).
4. Run `npm test` and decide whether the test setup is worth keeping.
5. When ready for Rust: prototype one Rust mission in the external extension using the Python mission as the template.
6. Only if needed: dependency modernisation (node-sass to sass, drop unused deps, Electron and React upgrades). Large and not needed to play.

Original list:

1. **Play-test.** Walk through title, onboarding, `dev_skills` level and a few objectives to see what actually breaks. This is the cheapest way to turn the unverified leads in section 3 into facts. `local_config.js` (copy the template, but fix its `apiBaseUrl`) can set `initialLevelName` to jump straight to a level.
2. **Run `npm test`** (via `mise exec`) to see whether the Electron-based jest setup still works.
3. **Make the dev setup reproducible:** add a `mise.toml` (node 18, python 3.9) or fix `.nvmrc`, add `legacy-peer-deps=true` to a project `.npmrc`, and update the README.
4. **Neutralize dead backends.** Decide whether the learner-facing features (plant-a-tree, unlock codes, teams, live events) stay, are stubbed locally, or are removed. At minimum, make failures non-blocking.
5. **Decide the scope for the upgrade.** The options in rough order of effort:
   - Keep the stack frozen and only fix content (cheap).
   - Swap node-sass for sass and drop unused deps (small).
   - Upgrade Electron, which means replacing `remote` and adding a preload script (large).
   - Replace Phaser or React (very large).
6. **Content pass:** decide what to do with the Twilio-branded NPC dialogue, links and images, and whether the `twilioquest-*` packages remain the content source. That includes checking their licenses.

## 5. Open questions for the user

Answered: the goal is to play and learn, keep content current, and possibly add Rust later (see section 4).

Still open:
- Is the Twilio-account content wanted (`twilioquest-twilio-vr`, API Academy keys), or should those missions be hidden?
- Should fixes to bundled lessons live in an external extension (survives reinstall, but runs arbitrary JS and must be enabled in Settings) or in a fork of the npm packages?
- Which languages does the user most want to learn first, so the content review can start there?
