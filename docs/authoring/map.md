# Maps

A level's rooms are Tiled maps, stored as JSON in `levels/<level>/maps/*.json`.
The file name without `.json` is the map's name. The game opens the one called
`default` first, unless `level.json` sets `default_map`.

> Adapted in part from TwilioQuest extension-docs (MIT, © 2021 Twilio Inc.). See
> [README.md](README.md) for the licence text.

You edit maps with [Tiled](https://www.mapeditor.org/), a free map editor. The
upstream docs say TwilioQuest supports Tiled 1.8 and earlier, because 1.9
changed file formats. The vendored maps were saved by Tiled 1.6 (the template's
`"tiledversion": "1.6.0"`). I did not test newer Tiled versions with this fork
(unverified), so use 1.8 or older.

## Start from a copy, not a blank map

A blank map has none of the tilesets, layers or objects the engine expects. Copy
a working map instead. A good one is
`public/extensions/twilioquest-base/levels/challenge-questions/maps/room_template.json`.
It is 32 by 32 tiles of 24 pixels and contains a player entry point, an exit
back to the Fog Owl, three terminals, and a collision layer, all wired up.

Before you open a map in Tiled, start the game once with extensions enabled
(see [extension.md](extension.md)). That creates the `.bundled/` folder next to
your extensions, which the maps' tileset paths point at.

## What the game does with a map

(`common/tiled.js` and `DynamicLevel.js`)

1. It reads the map JSON. Invalid JSON or a missing file logs an error and the
   level does not load.
2. It resolves each tileset. A tileset embedded in the map is used as is. An
   external one (a `source` entry) must be a **JSON** tileset file; a `.tsx`
   file will fail to parse. A `source` containing `.bundled/` is looked up across
   extensions by the part after it; any other path is resolved relative to the
   map file (see [extension.md](extension.md) for the paths).
3. It loads every `tilesets/*.png` and `spritesheets/*.png` from all extensions,
   and every `objects/*/config.js`.
4. It builds the layers, then creates one game object for each Tiled object.

### Tile size and tileset names

The map's tile layers use an embedded tileset (the vendored maps embed
`TwilioQuestTileset` with `firstgid` 1). The tileset's **name** in the map must
equal the base name of a PNG in some extension's `tilesets/` folder
(`this.map.addTilesetImage(img, img)` in `DynamicLevel.js`). The tile size comes
from `tilesets/<name>.json` (`tilewidth`, `tileheight`); if there is no such
JSON the engine assumes 24 by 24 (`Game.jsx`).

## Layers

Two kinds of layer work: tile layers and object layers. Image layers and group
layers do not: the `default` branch of the layer loop in `DynamicLevel.create`
prints its warning using a variable (`type`) that is not defined there, which
throws a `ReferenceError` (from reading the code, not run). Keep to the two kinds.

Names are only conventions (`Base`, `Decoration`, `Objects`, `Top`, `Collision`
in the vendored maps). Properties are what the engine reads:

| Where | Property | Effect |
| --- | --- | --- |
| tile layer | `collision` = true | Every tile on this layer blocks the player |
| tile layer | `hidden` = true | The layer is not drawn. Use with `collision` so the blocking layer is invisible. |
| object layer | `zIndex` = number | Gives each object in the layer that `zIndex` unless it has its own. Objects sort by `zIndex`, then by their body's bottom edge. |
| the map itself | `backgroundColor` = `#rrggbb` | Stage colour (default black). Set it under Map > Map Properties. |

Drawing order follows the layer order in Tiled: the object group is created at
the first object layer, so tile layers listed below it (`Top`, `Top 2`) draw over
the objects. That is how the vendored maps hide the player behind roofs
(reading `createGroup`'s comment and the layer order; not tested).

The vendored layer list, for reference
(`challenge-questions/maps/default.json`): `Base`, `Decoration`, `Decoration 2`,
`Decoration 3`, `Objects` (objects), `CollisionObjects` (objects), `Top`,
`Top 2`, `Collision` (tile layer with `collision` and `hidden`).

Differs from upstream: the upstream page also lists a layer property
`useCollisionMasks`. Nothing in `src/js` reads it (I searched). Per-tile
collision shapes do work, but through the tileset: a tile's object group in the
tileset JSON gives the body for any object made from that tile (see
`processObjectGroupBody` in `SpriteObject.js`). The `terminal` tile in
`TwilioQuestObjects.json` has one.

## Objects

Objects live on an object layer. For each one, `EntityFactory.create` works out
what it is, and the steps matter when something does not appear:

1. **Tile objects** (placed from a tileset, so they have a `gid`) are merged
   with the tile's own data from the tileset JSON: `type`, and the custom
   `properties`. The object's own properties override the tileset's, by name.
   Empty strings in the object are ignored, so an unset Type in Tiled does not
   hide the tileset's `type`.
2. `type` is trimmed. If it is empty: a zero-size rectangle becomes a `point`,
   and anything else becomes a `tile-object`.
3. The type picks a game class from the table below. An unknown type logs
   "Entity type is not mapped" and falls back to `tile-object`, which needs a
   `gid`; without one the object is skipped with an error.
4. A sprite is created from a **config**, found by the key `name` for the five
   legacy types below, and by `type` for everything else. Configs for
   non-legacy types come from `objects/<type>/config.js` in any extension, or
   from the engine's own `public/levels/common/entities/<key>/config.json`
   folders (`arrow`, `collider`, `flame`, `laser`, `tile-object`,
   `highlight-tile`, and others).
5. Every Tiled custom property is copied onto the game object, so a property
   named `objectiveName` is `self.objectiveName` in event handlers. A property
   whose name starts with `@` instead subscribes to a path in the game's shared
   state: the first character of the value is `!` (negate) or any other
   character (such as `.`), and the rest is a path into the context
   (`MapObject.js`). A real one, in
   `public/extensions/twilioquest-api-academy/levels/lovelace_tower/maps/default.json`,
   is `@hidden` = `!completedObjectives["lovelace_tower.api-04-remote-and-local"]`:
   the object is hidden until that objective is complete.

### Object types the engine knows

From `EntityMap.js`. "Legacy" means `EntityConfigService.isTypeLegacyObject`
returns true: `player`, `npc`, `interactable`, `levelChange` and `triggerArea`.
These look up their sprite config by the object's `name` rather than its `type`.

| `type` | Class | Use it for | Notes |
| --- | --- | --- | --- |
| `player` (legacy) | Player | Spawn point. `name` is the entry point, such as `player_entry1`. | Optional `initialFacing`: `UP`, `DOWN`, `LEFT` or `RIGHT`. A wrong value hits `console.warning`, which does not exist, and throws. Only the entry matching the arriving player is created. |
| `levelChange` (legacy) | TransitionArea | Door or exit: walking into the rectangle moves the player | Properties below. |
| `triggerArea` (legacy) | TriggerArea | A rectangle that fires `triggerAreaWasEntered` and `triggerAreaWasExited` | Give it a `key` so your `events.js` can tell areas apart. |
| `interactable` (legacy) | InteractableObject | An invisible rectangle the player can press space on | Emits `playerDidInteract` with the object as `target`. `name: mission_computer` opens the Mission Computer. Nothing else happens unless your `events.js` reacts. |
| `npc` (legacy) | NonPlayerCharacter | Old-style NPC | Needs a config folder under `public/levels/common/entities/<name>/`. No vendored map uses it; use a tile object with a `conversation` property instead (below). |
| `collider` | Collider | An invisible solid rectangle, sized by resizing the object | The vendored maps use `gid` 1 with this type, 716 times. |
| `tile-object` | TileObject | Any decorated or interactive object made from a tile | The default for untyped tile objects. Config `objects/tile-object/config.js` just uses the tile as the sprite. |
| `point` | MapObject | A marker with no size, found with `world.forEachEntities('key', ...)` | The type given to zero-size untyped objects. |
| `arrow` | FloatingArrow | A bobbing arrow with "press space" text | Usually `hidden`, shown by `events.js` with `world.showEntities(key)`. See `owls_nest/maps/default.json`. |
| `flame`, `highlight-tile`, `laser` | Flame, HighlightTile, Laser | Animated decoration: a flame, a pulsing tile, a laser that plays its idle animation | Optional `startColor` and `endColor` (`#rrggbb`) for `highlight-tile`. |
| `chest`, `barrier` | HackableChest, HackableBarrier | **Do not use** | See the pitfall below. |

Every other `type` you see in the vendored maps (`terminal`, `chest-red`,
`laser-horizontal`, `door-*`, `npc-daizen`, `conversationResponder`, ...) is a
tile object whose config is a folder under `objects/` named after the type. The
list is the folders of `public/extensions/*/objects/`. A few worth knowing:

- `terminal`: a console that opens an objective, then shows a "done" frame.
- `chest-red`, `chest-blue`, ...: chests that open an objective, then open. Use
  these for optional objectives.
- `laser-horizontal`, `laser-vertical`: a barrier that blocks the player until
  its `objectiveName` is complete.
- `conversationResponder` and `npc-daizen`-style NPCs: start a conversation
  when the player presses space. They need `conversation` and
  `conversationAvatar` properties, and often `interactable: true`
  (`public/extensions/twilioquest-base/scripts/conversationOnInteract.js`).

### Making a custom object

`objects/<type>/config.js` exports an object that `EntityConfigService`
validates. Required: `properties.sprite`. Optional: `animations` (each has
`frames` and `frameRate`), `spriteSheets` (each has `fileName` and
`frameDimensions`, the image sitting in the same folder), `events` (handlers
named `on` plus an event name, signature `(self, event, world)`), `state`
(initial per-object state), `render` (called when `self.setState` runs), and
`properties.idleAnimations`. `spriteSheet` in `properties.sprite` names a key in
`spriteSheets` (for example `"terminal"` in
`public/extensions/twilioquest-base/objects/terminal/config.js`); with
`useGidAsDefaultFrameIndex: true` the tile you placed picks the frame.
A config that fails validation, or throws when loaded, is skipped with a
"Skipping Object" error in the console. Objects of that type are then created
as plain `tile-object`s without their config, and probably look wrong.

## Level changes

A `levelChange` object is a rectangle. Walking into it moves the player
(`Player.transitionToArea`), without pressing a key. Properties:

| Property | Required | Meaning |
| --- | --- | --- |
| `levelName` | yes | The level folder to go to. Use the current level's name to change maps within a level. |
| `playerEntryPoint` | no | Name of a `player` object in the destination map. Default `player_entry1`. |
| `mapName` | no | Map file name (no `.json`). Default is the destination level's `default_map`, or `default`. |
| `key` | no | For `enableTransitionAreas` and `disableTransitionAreas` in `events.js` |
| `disabled` | no | Start switched off; turn it on with `world.enableTransitionAreas(key)` |

Example from `public/extensions/twilioquest-base/levels/challenge-questions/maps/default.json`
(a mission's way back to the Fog Owl):

```json
{ "name": "exit", "type": "levelChange",
  "properties": [
    { "name": "levelName", "type": "string", "value": "fog_owl" },
    { "name": "playerEntryPoint", "type": "string", "value": "player_entry2" }
  ] }
```

The destination must have a `player` object with that name. The Fog Owl map
(`public/extensions/twilioquest-base/levels/fog_owl/maps/default.json`) has
`player_entry1`, `player_entry2` and `player_entry_bridge`. Every map needs at
least a `player_entry1`; it is what the game uses when no entry point is named.

Differs from upstream: upstream's page says an Exit has "level name, map name".
The properties in this code are `levelName`, `mapName` and `playerEntryPoint`
(`Player.js`).

## Tileset default properties

A tileset JSON can store properties on a tile, and every object placed from that
tile starts with them. In Tiled, open the tileset, select the tile, and add
custom properties. They are saved under `tiles[].properties` in the tileset
file, along with `tiles[].type`.

`public/extensions/twilioquest-base/tilesets/TwilioQuestObjects.json` uses this
heavily. Its tile 12 is:

```json
{ "id": 12, "type": "terminal",
  "properties": [
    { "name": "hackable", "type": "bool", "value": true },
    { "name": "objectiveName", "type": "string", "value": "example_objective" }
  ] }
```

So a terminal placed from that tile already has `type: terminal`,
`hackable: true` and a placeholder `objectiveName`. You only override
`objectiveName` on the object. The tileset also sets `conversation`,
`conversationAvatar`, `interactable` and `disableBody` on its NPC and door tiles.

An important detail: the tileset's and the object's properties are merged by
property name, with the object's value winning (`EntityFactory.create`). To
change a default, set that property on the object.

## Making an object hackable

An object opens an objective when all of this is true
(`TileObject.interactionEffect`):

1. It is a tile object (has a `gid`, class `TileObject` or a subclass).
2. `hackable` is true.
3. `objectiveName` is set to an objective folder in the same level.

Steps in Tiled: place a `terminal` or a `chest-*` tile from the
`TwilioQuestObjects` tileset on the object layer, and change its
`objectiveName`. That is enough. If `hackable` is true and `objectiveName` is
missing, the console shows "Object with hackable set did not have an
objectiveName listed" and nothing happens.

If an object is only `interactable`, or only has flavour text, pressing space
shows the text and does not open an objective. `hasInteractionEffect` is what
tells the player's "you can interact" prompt to appear.

To make the objective required, add a `laser-horizontal` or `laser-vertical`
with the same `objectiveName` across the path. See
[objective.md](objective.md) for what happens after a pass.

## The legacy `barrier` and `chest` types

The level `public/extensions/terminalquest-dev-skills/levels/dev_skills` uses
the old `type: "barrier"` and `type: "chest"`. They were broken in this engine
and now work, but only for this level (nothing else uses them):

- `barrier` and `chest` are in `isTypeLegacyObject`
  (`EntityConfigService.js`), so the sprite config is looked up by the object's
  `name` (`barrier-blue`, `chest`) from `public/levels/common/entities/<name>/`.
- `customSort` in `DynamicLevel.update` falls back to the sprite bounds for
  layer sprites, which have no physics body.
- `HackableBarrier` and `HackableChest` have an `interactionEffect`
  (`entities/base/openHackInterface.js`) that sets `hackObject` for the object's
  `objectiveName`. Unlike `TileObject`, they do not need `hackable: true`. When
  the objective passes, `markAsComplete` opens the barrier (body disabled, lasers
  gone, screen turns green) or the chest (frame 1).
- A `chest` with no `objectiveName` opens nothing by itself. Give it a `key`
  property and handle `playerDidInteract` (`event.target.key`) in the level's
  `events.js`: check your condition, call `target.markAsComplete()`, grant the
  reward and save a flag with `world.setState`. Re-apply the flag on
  `mapDidLoad`. `dev_skills/events.js` does this for its reward chest.

Prefer the tile-object types (`terminal`, `chest-*`, `laser-*`) for new maps.
Do not copy maps from `tasks/scaffold/mission_scaffold/` without converting
these objects: the scaffold's `entities/example_entity/` is the old layout.

Another pitfall from the same level: the `Collision` tile layer only works if it
has the layer properties `collision: true` (and normally `hidden: true`). The
dev_skills maps lacked them, so nothing collided and the collision tiles were
drawn as a red overlay.

## Workflow summary

1. Copy `room_template.json` to `<your extension>/levels/<level>/maps/default.json`.
2. Start the game once with extensions enabled so `.bundled/` exists.
3. Open the map in Tiled. Paint the tile layers. Keep `Collision` as the
   collision layer.
4. Move `player_entry1` where the player should appear. Set the `exit`
   object's `levelName` (and `playerEntryPoint`).
5. Add terminals. Set each one's `objectiveName`.
6. Save as JSON in the same place. Restart the game if you added the level,
   otherwise leave the level and enter it again.
7. Check the developer console for lines starting "Entity type is not mapped",
   "There is no registered EntityConfig for" or "Skipping Object". They say what
   the engine could not make.
