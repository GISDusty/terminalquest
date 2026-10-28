# Extensions

An extension is a folder that contains a `package.json` file and some game
content. All of TerminalQuest's lessons are extensions: the bundled ones live in
`public/extensions/` (see `public/extensions/README.md`), and you can add your
own in a folder of your choice.

> Adapted in part from TwilioQuest extension-docs (MIT, © 2021 Twilio Inc.) and
> twilioquest-extension-template (MIT, © 2021 Twilio, Inc.). See
> [README.md](README.md) for the licence text.

## The smallest valid extension

```
my-extensions/            <- the folder you choose in Settings
└── my-first-extension/
    └── package.json
```

`package.json` is checked by `isExtensionValid` in
`src/js/app/common/extensions.js`. The schema is:

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | A string. It is not compared with the folder name. |
| `version` | yes | A string, for example `"0.0.1"`. |
| `description` | no | A string. |
| `engines.twilioquest` | no | If present it must be a string. The game never compares it with a version, so it has no effect. |

Anything else in the file (for example `dependencies`) is ignored by the
check. This is the whole file for a minimal extension, and it is the same as the
test fixture `src/test/fixtures/extensions/bbb-minimal-config-extension/package.json`:

```json
{
  "name": "my-first-extension",
  "version": "0.0.1"
}
```

An extension that fails the check is listed as "failed" in red in Settings >
Extensions and is not loaded. The reason is printed to the developer console.
Plain files in the extensions folder (like `.DS_Store`) are ignored, and so is a
folder named `.bundled` (see below).

An extension that only has a `package.json` loads but adds nothing. To add a
mission, add `levels/<level_name>/level.json` plus a map; see
[mission.md](mission.md).

Differs from upstream: the upstream template sets `engines.twilioquest` to
`"3.1.44"` and says it may be used in future to gate versions. In this fork it
is only type-checked.

## What an extension can contain

Every folder below is optional. The game looks each one up across all
extensions.

| Folder | Used for | Loaded by |
| --- | --- | --- |
| `levels/<name>/` | Levels: `level.json`, `maps/`, `objectives/`, `conversations/`, `events.js` | `levelLoader.js` |
| `objects/<key>/config.js` | Custom map objects (sprite, animation, event handlers) | `Game.jsx`, `EntityConfigService.js` |
| `tilesets/` | Tiled tileset `.json` files and the `.png` images the map layers use | `Game.jsx`, `common/tiled.js` |
| `spritesheets/*.png` | Shared 32 by 32 sprite sheets | `Game.jsx` |
| `images/` | Mission icons, nav-map planet sprites, conversation portraits (`images/conversations/`) | `levelLoader.js`, `Conversation.jsx` |
| `items/<key>/` | Inventory items that objectives can reward. `index.json` has a `name` (the item key; keep it equal to the folder name, because the icon is looked up at `items/<name>/icon.png`), plus `icon.png` | `loadItemsFromDisk.js` |
| `scripts/` | Your own helper modules that your `config.js` or `events.js` `require` | you |

Not extension-loaded (important): background music files, sound effects and the
default flavour text are read from the game's own `public/levels/common/`
folder (`common/audio/index.js` and `InteractionTextService.js`). An extension
can choose among the existing tracks with `backgroundMusic` but cannot add one.
See [mission.md](mission.md).

### Dependencies

Node resolves `require("...")` from the file that calls it. A validator in an
external extension therefore cannot `require("fs-jetpack")` just because the
game uses it. Either use Node's built-in modules (`fs`, `path`,
`child_process`), or run `npm install <package>` inside your extension folder,
as the upstream template does for `ramda`. The bundled lessons under
`public/` get game packages by luck of folder position. I did not test a
dependency in an external extension at runtime (unverified).

## Enabling an external extension

1. Make a folder to hold your extensions, for example `~/tq-extensions`, and put
   your extension folder inside it.
2. Start the game, press `O` to open Settings, and choose the Extensions tab
   (`Settings.jsx`).
3. Click Enable Extensions. A warning explains that extensions can run code on
   your computer; see [../security.md](../security.md).
4. Click Choose Directory and pick `~/tq-extensions` (the folder that contains
   your extension folders, not the extension folder itself).
5. The page lists "External Extensions" and "Bundled Extensions" with
   loaded/failed beside each one. Restart the game after adding a level, because
   levels are scanned once at startup. The settings page says the same.

The two settings are stored as `extensions.enabled` and `extensions.directory`
(`common/context/schema.js`, saved to disk).

## Override precedence

All content lookups go through `resolveAbsolutePath` in
`src/js/app/common/assetLoader.js`. It walks the extension list in order and
returns the first extension that has the file. The order is set in
`getAllValidExtensions` (`extensions.js`):

1. External extensions, sorted by folder name (`localeCompare`), only when
   extensions are enabled and a directory is chosen.
2. Bundled extensions (the names in
   `src/js/app/config/bundledExtensionModules.json`), sorted by name.

So a file in your extension wins over a file with the same relative path in a
bundled one. For example, `my-extension/levels/fog_owl/level.json` replaces the
Fog Owl's level file. If two external extensions have the same file, the one
whose folder name sorts first wins.

Directory listings are different: `readDirectory` merges the listings of every
extension and removes duplicates. That is why a new `levels/my_level/` appears
next to the bundled levels, and why `maps/` and `objects/` from several
extensions combine. The consequence is that overriding is per file, and a level
can end up built from several extensions. If you override `level.json` but not
`maps/default.json`, you get your `level.json` and the bundled map.

This is the same behaviour as upstream. The tests in
`src/test/app/common/assetLoader.test.js` ("should return overridden file from
first extension") exercise it, using the fixtures under
`src/test/fixtures/extensions/`.

## The `.bundled` folder (caveat)

When extensions are enabled, every start-up the game deletes and recreates a
folder called `.bundled` inside your extensions directory
(`syncBundledAssets` in `assetLoader.js`, called from `ContextProvider.jsx` once
the context is ready). It copies the `tilesets/` and `objects/` folders of the
bundled extensions there. It does not copy your extensions, and nothing in it is
read by the game at run time. Its purpose is to give the Tiled map editor a
stable place to open tilesets from. Maps in this repo point at it, for example
in `public/extensions/twilioquest-base/levels/challenge-questions/maps/default.json`:

```
"source": "../../../../.bundled/tilesets/TwilioQuestObjects.json"
```

That path goes from `<extensions dir>/<ext>/levels/<level>/maps/` up four
folders to `<extensions dir>/.bundled/`. When the game loads the map, a tileset
whose `source` contains `.bundled/` is resolved by taking the part after it
(`tilesets/TwilioQuestObjects.json`) and looking that up across extensions
(`processTilesets` in `common/tiled.js`).

What to remember:

- Never put your own files in `.bundled`. They are deleted on the next start.
- If extensions are not enabled, there is no `.bundled`, and Tiled cannot open
  the bundled tilesets. Start the game once with extensions enabled before you
  edit maps.
- Reference your own tilesets with an ordinary relative path from the map, for
  example `../../../tilesets/MyCustomObjects.json` (the upstream template does
  this). The game finds the owning extension from the path and loads it, but
  logs a warning that the tileset is "not referencing .bundled data"; the
  warning is harmless for your own tilesets.
- Because `.bundled` is rebuilt from the bundled extensions on each start, a
  change to a bundled tileset in `public/extensions/` shows up there after a
  restart.

## Putting an extension inside the repository

You only need this to ship content with the game. The steps, from how the
bundled ones are wired:

1. Create `public/extensions/<name>/` with a valid `package.json`.
2. Add `"<name>": "file:extensions/<name>"` to `dependencies` in
   `public/package.json`.
3. Add `"<name>"` to `src/js/app/config/bundledExtensionModules.json`.
4. Run `npm install` inside `public/` so that `public/node_modules/<name>`
   becomes a link to your folder, and commit the updated
   `public/package-lock.json`. Note that `mise exec -- npm install` at the root
   runs `npm ci` there instead (`tasks/install_app.js`), which will not add a
   new dependency.

These four steps were verified end to end in cycle 7, when the
`terminalquest-dev-skills` extension was added under
`public/extensions/terminalquest-dev-skills`. They are also consistent with
`public/package.json`, `bundledExtensionModules.json` and
`getBundledExtensionDirectories`, which builds each path as
`public/node_modules/<name>`.

The twilio-account lessons (`twilioquest-twilio-vr`: API setup, voice and
messaging) are not vendored and not in the bundled list, so they are not loaded.
The package is still installed via `public/package.json`, which puts it at
`public/node_modules/twilioquest-twilio-vr`. To re-enable it without touching
its lessons, add `"twilioquest-twilio-vr"` to
`src/js/app/config/bundledExtensionModules.json` and rebuild (`npm run
build:js`). To also edit and vendor it in-repo, copy it into
`public/extensions/` and follow steps 1 to 4.

## A starting point

The upstream template is at <https://github.com/TwilioQuest/twilioquest-extension-template>
(MIT). It has a VR mission, a nav-map destination, two sample objectives, two
custom objects and a `MyCustomObjects` tileset. It was written for TwilioQuest
3.1; the layout matches this fork, but check each file against these pages
before relying on it. In particular its `scripts/` and `objects/` use the same
helper pattern as `public/extensions/twilioquest-base/scripts/`.
