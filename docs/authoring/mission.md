# Levels and missions

A level is one explorable area: a folder `levels/<level_name>/` inside an
extension. The folder name is the level's identifier. It is what
`world.warp(...)`, `levelChange` objects and the saved progress keys use, so
choose it carefully and do not rename it later.

> Adapted in part from TwilioQuest extension-docs (MIT, © 2021 Twilio Inc.). See
> [README.md](README.md) for the licence text.

```
levels/my_mission/
├── level.json
├── events.js              include it, even if empty (see below)
├── maps/default.json      the map the game loads first (more maps allowed)
├── conversations/*.pug    optional
└── objectives/<name>/     see objective.md
```

There are three kinds of level, decided by `level.json`:

| Kind | How you set it | How the player gets there |
| --- | --- | --- |
| Mission | `"is_mission": true` | Listed in the Mission Computer on the Fog Owl, then LAUNCH MISSION |
| Destination | a `navMap` entry | Chosen on the Fog Owl's nav map |
| Plain level | neither | Only through a `levelChange` object or `world.warp` from another level |

A level can be both a mission and a destination. Missions and destinations both
start the player at `player_entry1` on the map called `default`
(`Game.jsx`: `level.playerEntryPoint || defaultPlayerEntry`, and
`levelMapName || level.json default_map || 'default'`).

## level.json

The loader (`src/js/app/common/levelLoader.js`) checks `level.json` against a yup
schema. A level that fails the check is skipped, with an error in the console
and no other message. Only `title` is required.

### Fields checked by the schema

| Field | Type | Meaning |
| --- | --- | --- |
| `title` | string, required | Name shown in the Mission Computer and nav map |
| `description` | string | Text shown with the title |
| `is_mission` | boolean, default false | Show in the Mission Computer |
| `prereqs` | array of strings | Objectives that must be done first, as `"<level>.<objective>"` |
| `flavorTextOverrides` | object or null | Per-level text for map objects, see below |
| `backgroundMusic` | string | A track name, see below |
| `backgroundEffect` | `{ "key": string, "options": object }` or null | `"starfield"` or `"vr"` |

The schema does not reject unknown keys, and it does not stop you writing
`"is_mission": "false"`. The game later tests the raw JSON value, so the string
`"false"` counts as true. Write real JSON booleans.

### Fields the game reads that the schema does not check

| Field | Meaning |
| --- | --- |
| `objectives` | Array of objective folder names. See "The objectives manifest". |
| `navMap` | Puts the level on the nav map: `x` and `y` (percent from the top left, clamped to 0 to 100), `sprite` (a path under `images/`), and optional `tileWidth`, `tileHeight` (default 48 each) and `scale` (default 1.5) |
| `priority` | A number. Lower comes first. See "Order" below. |
| `mission_icon` | Icon for the Mission Computer, a path under `images/` (default `images/mission_icon.png`) |
| `questTitle`, `questDescription` | First text shown in the quest log for this level; they fall back to `title` and `description` (`Game.jsx`) |
| `default_map` | Name of the map file (without `.json`) to open first, instead of `default` |

Some vendored `level.json` files contain `defaultGoal` and `disableFogOwlButton`.
Nothing in `src/js` reads them (I searched). Leave them out of new levels.

### A mission, from the vendored content

`public/extensions/twilioquest-base/levels/challenge-questions/level.json`
(the list of objectives is shortened here):

```json
{
  "title": "Raid the Dark Ducktypium Forge",
  "description": "Practice your programming skills ...",
  "questTitle": "Raid the Dark Ducktypium Forge",
  "questDescription": "Practice your programming skills ...",
  "mission_icon": "challenge-questions/Icon_Forgex4.png",
  "is_mission": true,
  "priority": 4,
  "backgroundMusic": "hackertheme_104771b",
  "backgroundEffect": { "key": "vr", "options": {} },
  "objectives": ["difference-max-min", "ducktypium-chest", "balance-brackets"]
}
```

`mission_icon` resolves to
`public/extensions/twilioquest-base/images/challenge-questions/Icon_Forgex4.png`.

### A destination

`public/extensions/twilioquest-python/levels/python/level.json` has
`"navMap": { "x": 55, "y": 65, "sprite": "nav_map/pythonic_temple.png" }` and
`"is_mission": false`. The sprite is looked up as `images/nav_map/pythonic_temple.png`
in any extension, and falls back to `images/default_planet_sprite.png` if that
file is missing (`getMissionInfo` in `levelLoader.js`). The sprite sheet is cut
into `tileWidth` by `tileHeight` frames. The first row is used: frame 0 when the
planet is not selected and frame 1 when it is (`nav_map/components/Planet.js`).

### The objectives manifest

`objectives` lists the objective folders under `objectives/` that belong to the
level:

```json
"objectives": ["example_objective", "example_objective2"]
```

What the list does:

- At startup the loader reads `objectives/<name>/objective.json` for every
  entry (`getMissionInfo` and `populateObjectives` in `levelLoader.js`, around
  lines 370 to 379 and 499 to 505). The XP total, the Mission Computer's
  percent-complete figure, the player's rank, and `world.isLevelCompleted` are
  all computed from this list.
- If an entry has no `objective.json`, `readObjectiveInfo` throws. The throw
  happens inside the start-up block of `ContextProvider.jsx`, which only logs
  it, before `contextInitialized` is set. From reading the code, one misspelt
  name here can leave the whole game stuck on its loading screen, not just your
  level (unverified at runtime). Check the console first if the game never
  starts after you edit a manifest.
- Without a manifest entry the level still works for opening a terminal:
  `HackInterface.jsx` reads the objective file straight from
  `levels/<level>/objectives/<objectiveName>/objective.json`. But the objective
  is then left out of the totals above. List every objective you use.

Differs from what you might expect: it is easy to read the loader as "an
objective must be listed to load". In this fork it must be listed to be
counted, not to open a terminal. The scaffold
(`tasks/scaffold/mission_scaffold/level.json`) has no `objectives` key at all.

### Prerequisites

```json
"prereqs": ["basic_training.basic3", "basic_training.basic4"]
```

Each entry is `<level folder>.<objective folder>`. The Mission Computer shows
the list with checkboxes and hides the LAUNCH button until all are complete
(`MissionComputer.jsx`). The titles come from each objective's `objective.json`,
so a prereq naming a missing objective throws in the same start-up block
described above. No vendored level currently uses `prereqs` (the levels that
did were the unloaded Twilio-account missions), so this is read from the code
and not tried in the game.

### Order

`priority` sorts levels. The loader sorts by priority, then by title
(`compareLevels`). The Mission Computer treats a missing priority as 9999, so
unprioritised missions go last. The nav map sorts by `priority` only, and its
first entry is selected when it opens. Use small numbers (the vendored
destinations use 0 to 3).

### Music and effects

`backgroundMusic` is the base name of a file in the game's own
`public/levels/common/music/`. The tracks present are:

`fascinatingarea_108253b`, `fogowl_629966b`, `hackertheme_104771b`,
`overture_b`, `safearea_337937b`, `takeabow_1615732b`, `tq_christmas`,
`unsettlingarea_59895b`.

That folder is read directly (`loadMusic` in `common/audio/index.js`), not
through extensions. An extension cannot add a track. If `backgroundMusic` is
omitted the level plays no music (`DynamicLevel.playBackgroundMusic`).

`backgroundEffect` fills transparent tiles in the map:

- `{ "key": "vr", "options": {} }` is the green VR grid.
- `{ "key": "starfield", "options": { "direction": "topToBottom", "baseSpeed": 0.03, "starCount": 200 } }`.
  `direction` is one of `topToBottom`, `bottomToTop`, `leftToRight`,
  `rightToLeft`. Defaults in `StarfieldEmitter.js` are `topToBottom`, `0.1` and
  `200`.

Differs from upstream: upstream documents the `starCount` default as 400 and a
different default direction; the code says 200 and `topToBottom`.

### Flavour text

When the player presses space beside a map object with no conversation or
objective, the game looks up a line of text. Each object gets a key from its
`flavorText` Tiled property, or its `key` property, or a lookup by tile id in
the game's `public/levels/common/flavorText.json`. `flavorTextOverrides` in
`level.json` replaces the text for a key in this level only; HTML is allowed:

```json
"flavorTextOverrides": {
  "bookshelf": "There's nothing like a good book."
}
```

(from `public/extensions/twilioquest-base/levels/fog_owl/level.json`, which has
many more). If the key is not in the override map, the default list in
`flavorText.json` is used (`InteractionTextService.getText`). The default list
is not extension-loaded either.

## events.js

`levels/<level>/events.js` exports one function. Treat it as required. A level
without the file still loads, but entering it logs "Error loading event hander"
and a `TypeError` (`isPathFromBundledExtension`) to the console; I saw both
when I loaded an example level with no `events.js`. From reading
`levelLifecycleManager.setLevel`, the previous level's handler also stays in
place after that error (unverified). A do-nothing `module.exports = function
(event, world) {};` avoids all of it.

```js
module.exports = function (event, world) {
  if (event.name === 'levelDidLoad') {
    world.showNotification('Welcome to my mission.');
  }
};
```

The function is called for every event that happens while the player is in this
level, with an `event` object (always has `name`) and the `world` API. The
return value is ignored, so an `async` handler is allowed but the game does not
wait for it. Only the handler of the level the player is currently in receives
events (`LevelLifecycleManager`). Map objects with an `events` entry in their
`config.js` get the same events through handlers named `on` plus the event name,
for example `onObjectiveCompleted(self, event, world)` (see
`public/extensions/twilioquest-base/scripts/objectiveCompletionResponder.js`).

### Events

All of these are emitted somewhere in `src/js/app`; the right-hand column is the
file that emits them.

| `event.name` | Extra properties | When | Emitted in |
| --- | --- | --- | --- |
| `levelDidLoad` | none | The player arrives in this level from a different level. Not again when moving between maps of the same level. | `Game.jsx` |
| `levelWillUnload` | none | The player leaves this level for a different one. | `Game.jsx` |
| `mapDidLoad` | `mapName` | A map of this level finished loading, including the first one. | `Game.jsx` |
| `playerDidInteract` | `target` (the NPC or object) | The player pressed space next to something. | `Player.js` |
| `conversationDidEnd` | `npc` (has `conversation` and `name`) | A conversation was closed. | `Conversation.jsx` |
| `triggerAreaWasEntered`, `triggerAreaWasExited` | `target` (has `key` and `name`) | The player walked into or out of a `triggerArea`. | `TriggerArea.js` |
| `objectiveDidOpen`, `objectiveDidClose` | `target` (has `objectiveName`) | The hack interface opened or closed. | `HackInterface.jsx` |
| `objectiveFailed` | `objective` (name) | A validator failed. This includes timeouts and thrown errors. | `Validator.jsx` |
| `objectiveCompleted` | `objective` | An objective passed for the first time. | `Validator.jsx` |
| `objectiveCompletedAgain` | `objective` | An already completed objective passed again. | `Validator.jsx` |
| `timerDidTrigger` | whatever you passed to `scheduleTimerEvent` | A scheduled timer fired. | `world.js` |
| `playerUsedTool`, `playerStoppedUsingTool` | `toolId` | After `world.useTool` or `world.stopUsingTool`. | `Player.js` |
| `overlayComponentDidShow`, `overlayComponentDidHide` | `componentKey` on show | An overlay (nav map, iframe, ...) opened or closed. | `Overlay.jsx` |

Differs from upstream: the last three rows are not in the upstream event list.

`event.target` is the live game object, so you can read its Tiled properties
(`event.target.objectiveName`, `event.target.key`). Be careful when you change
it.

### The world API

Everything below is returned by `World.generateAPI` in
`src/js/app/common/world.js`. Methods that take `timeout` use `setTimeout` with
that many milliseconds (default 0).

State and progress

- `getState(key)` and `setState(key, value)`: read and write your own saved
  data. Values live in the game's `levelState`, which is saved to disk, so keep
  them JSON-friendly. The key is shared with every level, so use a unique one,
  for example `'com.you.my_mission'`.
- `isObjectiveCompleted(objective, mission?)`: boolean. `mission` defaults to the
  current level.
- `isLevelCompleted(level?)`: async, resolves true when every objective in the
  level's manifest is complete. Not in the upstream docs.
- `removeObjective(mission, objective)`: clears a completion. Useful when you
  rewrite an objective.
- `grantItems(keys)` and `removeItems(keys)`: arrays of item keys.
- `updateQuestStatus(levelName, title, description, complete = false)`:
  changes the quest log entry.
- `getContext(property)` and `setContext(object)`: the game's whole shared state.
  Internal and unstable.

Conversations and messages

- `startConversation(conversationName, avatarFileName, timeout)`: plays
  `conversations/<conversationName>.pug`. `avatarFileName` is a file under
  `images/conversations/`, including the extension (for example
  `'cedricNeutral.png'`, as in
  `public/extensions/owls-nest-extension/levels/owls_nest/events.js`). It is
  stored as the speaker's `name`, and the portrait is looked up as
  `images/conversations/<name>` unless the statement sets `expression`.
- `showNotification(html, timeout)`: a toast at the bottom of the screen.

Entities (objects on the map). `keyOrFilter` is either a string, which matches
each object whose Tiled `key` property equals it, or a function
`({ instance, collections, group, guid }) => boolean`.

- `showEntities`, `hideEntities`, `destroyEntities(keyOrFilter, timeout)`.
- `forEachEntities(keyOrFilter, fn, timeout)`: calls `fn(instance)` for each
  match. Caution: if you pass a `timeout`, the code runs the loop once after the
  delay and also once immediately (`world.js`), which is probably not what you
  want. Leave `timeout` out.
- `enableTransitionAreas`, `disableTransitionAreas(keyOrFilter, timeout)`:
  switch `levelChange` areas on and off.
- `entityService`: the underlying service. Unstable.

Player and camera

- `disablePlayerMovement(opts)` and `enablePlayerMovement(opts)`: by default they
  turn both movement and the action button off or on.
- `useTool(toolId)` and `stopUsingTool()`: play the tool animation and emit the
  tool events above.
- `tweenCameraToPosition({ x, y }, { duration = 750, easing })` and
  `tweenCameraToPlayer(options)`: both return a promise.
- `wait(ms)`: a promise that resolves after `ms`.
- `screenShake(amount, timeout)`.

Moving around and sound

- `warp(levelName, playerEntryPoint, levelMapName)`: move the player.
- `getCurrentLevelName()` and `getCurrentMapName()`.
- `playBackgroundMusic(trackName)`.
- `showOverlayComponent(keyOrObject, timeout)`: keys are `navMap`,
  `fogOwlFlying`, `devFundamentalsElevator` and `iframe`
  (`Overlay.jsx`). Pass `{ key: 'iframe', props: { url: '...' } }` to give props.
  `devFundamentalsElevator` is not in upstream.

Other

- `scheduleTimerEvent(payload, timeout)`: after `timeout` ms, your handler gets
  `{ ...payload, name: 'timerDidTrigger' }`.
- `emitter`, `levelLoader`, `levelsDirectoryPath`, `__internals`: internals.
  `levelsDirectoryPath` points at `public/levels`, the folder that is not
  loaded, so it is not useful for finding your own files. Upstream marks it
  deprecated.

Differs from upstream: upstream's own example calls `world.setState(state)` with
one argument. Here the signature is `(key, value)`; with one argument the data is
stored under a key made from the object, and the next `getState` returns
nothing. `updateQuestStatus` has no `ignoreLevelInfo` argument.

### A small real handler

`tasks/scaffold/mission_scaffold/events.js` is a commented starting point that
keeps per-mission state under a unique key and has a `DEBUG_MODE` switch that
resets it when the level loads. The real, longer example is
`public/extensions/twilioquest-base/levels/challenge-questions/events.js`, which
unlocks laser barriers when a set of objectives is complete:

```js
world.forEachEntities("room3-loot-laser", (ob) => {
  ob.setState({ ...ob.state, isCompleted: true });
});
```

## Conversations

An NPC conversation is a Pug file, `conversations/<name>.pug`. The game renders
it with `pug.renderFile`, passes in variables (`lastResponse`, `getState`,
`setState`, `completedObjectives`, `inventory`, `env`, `xp`, `settings`,
`loadout`), then reads the resulting tags (`Conversation.jsx`,
`ConversationBuilder`). Because Pug can run JavaScript, treat a conversation
file as code.

The tags are:

- `conversation(display_name="Cedric")`: the root.
- `statement#id`: which statement to show now. Put the text either inline, or in
  `statements > statement#id > text`. An optional `expression` attribute picks a
  different portrait.
- `responses` with `response#id` children: the buttons. The id of the chosen
  response arrives as `lastResponse` when the file is rendered again.
- The game appends an `<end conversation>` choice itself.

The portrait is `images/conversations/<avatar>`, where `<avatar>` is the
statement's `expression`, or else the NPC's avatar name. The working example is
`public/extensions/twilioquest-base/levels/challenge-questions/conversations/cedricDefault.pug`.
To start one from a map, give an object the Tiled properties `conversation`
(file name without `.pug`) and `conversationAvatar` (see [map.md](map.md)).
Voice-over files, if any, go in `conversations/vo/`.

## Creating a mission: the scaffold command

`npm run scaffold:mission -- <name>` copies `tasks/scaffold/mission_scaffold/`
into `public/levels/<name>/` (`tasks/scaffold/index.js`, which resolves
`public/levels` under the project root).

That folder is not loaded. `levelLoader.importLevels` reads `levels/` only
through the extension list (`readDirectory(LEVEL_DIR_NAME)` in
`levelLoader.js`), and `public/` is not an extension root. (The loader also
stores `staticFilePath('levels')` in a `levelsDir` field, but nothing reads that
field; I searched `src/js`.) So the scaffold's output is not playable as it
stands. The scaffold is also out of date in two other ways: its `level.json` has
no `objectives` list, and it ships an `entities/example_entity/config.json` in
the old legacy layout.

To use it anyway, run it, then move the new folder to
`<your extension>/levels/<name>/`, add `"objectives": ["example_objective"]` to
its `level.json`, and delete the `entities` folder. The scaffold's sample
objective is an unrelated JavaScript array quiz; replace it.

The simpler path is to copy an existing mission folder, such as
`public/extensions/twilioquest-base/levels/challenge-questions/`, into your
extension and edit it.
