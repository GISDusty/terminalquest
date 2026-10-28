# Authoring TerminalQuest content

These pages explain how to add your own missions, objectives and maps to
TerminalQuest. They are written for someone who has played the game and wants
to build a lesson, and they are checked against this repository's code, not
against the original TwilioQuest docs. When this fork behaves differently from
upstream, the page says so in a "Differs from upstream" note. Anything I could
not confirm from the code is marked "(unverified)".

> Adapted in part from TwilioQuest extension-docs
> (<https://github.com/TwilioQuest/extension-docs>, MIT, © 2021 Twilio Inc.) and
> the TwilioQuest extension template
> (<https://github.com/TwilioQuest/twilioquest-extension-template>, MIT,
> © 2021 Twilio, Inc.). The licence text is at the bottom of this page.

## Read this first: security

Everything you write here runs with your full user permissions. Validators,
`events.js`, object configs, `.pug` conversations and `<% %>` blocks in
markdown are all code. Read [../security.md](../security.md) before you enable
anyone else's extension. The short version: only run extensions you wrote or
have read in full.

## The pages

| Page | What it covers |
| --- | --- |
| [extension.md](extension.md) | The smallest valid extension, how to enable it, override order, the `.bundled` folder |
| [mission.md](mission.md) | `level.json`, missions vs destinations, `events.js`, music, conversations |
| [objective.md](objective.md) | `objective.json`, `description.md`, `walkthrough.md`, linking an objective to a map object |
| [validator.md](validator.md) | The `validator.js` contract, the helper, timeouts, a mock-helper test recipe |
| [map.md](map.md) | Tiled maps, layers, object types, level changes, making an object hackable |
| [rust-mission.md](rust-mission.md) | A worked guide to a mission that compiles and runs the learner's Rust code, with a copyable example extension in [examples/rust-quest/](examples/rust-quest/) |

## The mental model

```
extension            a folder with a package.json (an npm package)
└── levels/
    └── <level>/     one level = one explorable area
        ├── level.json        title, description, music, mission or nav-map flags,
        │                     and the list of objectives
        ├── events.js         optional: reacts to things that happen in the level
        ├── maps/*.json       one or more Tiled maps (the level's rooms)
        ├── conversations/*.pug   NPC dialogue
        └── objectives/<objective>/
            ├── objective.json    title, input fields, XP and item rewards
            ├── description.md    the "Objective" tab
            ├── walkthrough.md    the "Help" tab
            ├── validator.js      the code that decides pass or fail
            └── example.js        optional: starter code for the in-game editor
```

How the pieces connect:

1. The game scans every extension for `levels/<name>/level.json` at startup.
   A level with `"is_mission": true` appears in the Mission Computer on the Fog
   Owl. A level with a `navMap` entry appears as a destination on the nav map.
2. A level's map (`maps/default.json` unless you say otherwise) places objects.
   An object that has `hackable` and an `objectiveName` property opens the hack
   interface for `objectives/<objectiveName>/` when the player presses space.
3. The hack interface shows `objective.json`, `description.md` and
   `walkthrough.md`. When the player presses HACK, the game runs
   `validator.js` with the text the player typed.
4. The validator calls `helper.success(...)` or `helper.fail(...)`. On success
   the game saves the objective as complete and grants the XP and items from
   `objective.json`, and `events.js` receives an `objectiveCompleted` event.

Assets are looked up by a path relative to an extension root (for example
`levels/my_level/level.json`), searched across every extension. That is why one
extension can add to, or replace, files from another. See
[extension.md](extension.md).

## Where to put your own content

There are two places. Use the first.

1. **An external extension folder, enabled in Settings (recommended).** Make a
   folder anywhere on your disk, put your extension inside it, then in the game
   open Settings (the `O` key), choose Extensions, enable them and pick the
   folder. Your work stays out of the game's git history, you can keep it in its
   own repository, and a broken extension cannot damage the bundled lessons.
   External extensions are loaded before bundled ones.
2. **`public/extensions/` in this repository.** This is where the bundled
   lessons live (`twilioquest-base` and seven others). You only need this to fix a
   bundled lesson or ship content with the game. A new extension here also has
   to be registered in `public/package.json`,
   `src/js/app/config/bundledExtensionModules.json` and the install step (see
   [extension.md](extension.md)). Edit `public/extensions/<name>/`, never
   `public/node_modules/`, which is a generated copy.

Do not put new missions in `public/levels/`. That folder is not an extension
root, so nothing in it is loaded. To start a mission, run
`npm run scaffold:mission -- <name> --extension <your extension folder>`, which
writes a working level into an extension (see [mission.md](mission.md)).

A good first step: read
`public/extensions/twilioquest-base/levels/challenge-questions/` as a model for
a mission with several objectives.

## Testing as you go

- Run the game with `mise exec -- npm start`. In this mode (`isDev`), the game
  re-requires `validator.js`, `events.js` and object `config.js` files each
  time they are used (`requireFromExtension` in
  `src/js/app/common/assetLoader.js`), so you can edit a validator and press
  HACK again without restarting.
- The list of levels is read once at startup, so restart after adding a level
  or changing `level.json` (`importLevels` runs once, in
  `src/js/app/components/context_provider/ContextProvider.jsx`). Map files and
  the level's own `level.json` are re-read when you enter the level
  (`Game.jsx` calls `readLevelInfo`), but the Mission Computer text is cached
  from startup.
- Console helpers defined by the game: `window.warp(level, entry, map)` and
  `window.getPointsOfInterest()` (both in `Game.jsx`) jump you into a level;
  `window.completeCurrentObjective()` and `window.removeCurrentObjective()`
  (in `Validator.jsx`) work while a hack interface is open. How to open the
  developer console is not documented in this repo (unverified).
- Test validators outside the game with a mock helper: see
  [validator.md](validator.md).

## Licence of adapted material

The upstream repositories are MIT licensed. Their copyright lines are
"Copyright 2021 Twilio Inc." (extension-docs, `LICENSE.txt`) and
"Copyright (c) 2021 Twilio, Inc." (twilioquest-extension-template, `LICENSE`).
The licence text that applies to the adapted portions of these pages:

```
MIT License

Copyright (c) 2021 Twilio, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
