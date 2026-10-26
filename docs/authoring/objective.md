# Objectives

An objective is one challenge: a terminal the player hacks, a chest they open, a
laser barrier they must get past. Each objective is a folder inside its level:

```
levels/my_mission/objectives/balance-brackets/
├── objective.json     the "Overview" tab text, the input fields, the rewards
├── description.md     the "Objective" tab (what to do)
├── walkthrough.md     the "Help" tab (hints and links)
├── validator.js       the code that decides pass or fail (see validator.md)
└── example.js         optional: starter code for the in-game editor
```

This one is the real folder
`public/extensions/twilioquest-base/levels/challenge-questions/objectives/balance-brackets/`.

> Adapted in part from TwilioQuest extension-docs (MIT, © 2021 Twilio Inc.). See
> [README.md](README.md) for the licence text.

The folder name is the objective's identifier. The game records progress under
`<level folder>.<objective folder>`, for example
`challenge-questions.balance-brackets`. Renaming either folder after players
(including you) have completed it makes that progress disappear.

An objective is not found by scanning. Two things connect it to the game:

1. A map object carries the property `objectiveName` set to the folder name
   (see the last section of this page and [map.md](map.md)).
2. The level's `objectives` list in `level.json` names it, so it counts toward
   XP, progress and rank (see [mission.md](mission.md)).

## objective.json

Loaded by `HackInterface.jsx` (when a terminal opens) and `levelLoader.js` (at
startup, for the manifest).

```json
{
  "title": "Balance Brackets",
  "description": "Ensure a combination of brackets is balanced in an array.",
  "validation_fields": [
    {
      "name": "prompt",
      "type": "prompt",
      "placeholder": "",
      "label": "Click HACK to test your function."
    }
  ],
  "show_ide": true,
  "rewards": {
    "xp": 100
  }
}
```

| Field | Type | What it does |
| --- | --- | --- |
| `title` | string | The heading of the hack window and the name shown in prerequisite lists |
| `description` | string | HTML shown on the Overview tab, above the "Let's Do This!" button. It is inserted as raw HTML (`<strong>` and `<span class="highlight">` work). |
| `validation_fields` | array | The input boxes. **Always include this**, even with no inputs: use one `prompt` field. The interface calls `.map` on it without checking. |
| `show_ide` | boolean | Show a "Show Code Editor" button that opens QuestIDE, the in-game JavaScript editor |
| `hidden` | boolean | Leave this objective out of the Mission Computer's percent-complete figure. That is all it does. |
| `rewards` | object | `xp` (number) and `items` (array of item keys) |

Always give `rewards` with an `xp` number. Two places read `rewards.xp` without
checking that it exists (`Validator.jsx` `completeObjective`, and
`ObjectiveDescription.jsx` `renderObjectiveCleared`). Leaving `rewards` out is
likely to throw when the objective passes (from reading, not run). `items` may
be omitted. If you list an item, its key must exist in some extension's
`items/` folder, or the Overview tab and the "cleared" screen throw.

`hidden` is how the project parked `owl_plant_tree1`
(`public/extensions/twilioquest-base/levels/fog_owl/objectives/owl_plant_tree1/objective.json`),
an objective that no longer works. It does not remove the objective from the
level, and the objective still pays out XP if it is completed.

Differs from upstream: upstream marks `show_ide` as deprecated and does not
document `hidden`. In this fork `show_ide` is still used (`Validator.jsx`,
`HackInterface.jsx`) and `hidden` exists (`MissionComputer.jsx`,
`calcPercentComplete`).

The QuestIDE only runs JavaScript: it writes the learner's code to disk and runs
it in a hidden window (`common/code_runner.js`, `public/code_runner/runner.js`).
For other languages, such as Rust, leave `show_ide` off and ask the learner to
work in their own editor and give you a file path. A Rust walk-through is
planned; see [README.md](README.md).

### Validation fields

Each entry of `validation_fields`:

| Property | Meaning |
| --- | --- |
| `name` | The key your validator reads: `helper.validationFields.<name>` |
| `type` | `prompt`, `textarea`, `boolean`, or any HTML `<input>` type such as `text`, `number` or `password` |
| `label` | Text above the field. It is processed as Markdown (backticks and links work), then inserted as HTML. |
| `placeholder` | Grey hint text inside the field. Plain text. |
| `sensitive` | If true, the field is shown as a password input and hidden in the "Copy debug info" output |

How each type behaves (`Validator.jsx`, `render`):

- `prompt`: shows only the label, no input. The validator gets nothing for it.
- `textarea`: a multi-line text box.
- `boolean`: two radio buttons, True and False. The validator receives the
  string `"true"` or `"false"`, not a boolean, and `undefined` if the player
  chose neither.
- anything else (`text`, `number`, ...): a single-line input of that HTML type.

Whatever the type, the validator receives strings, with leading and trailing
spaces already trimmed (`ValidationHelper` constructor). A field the player
never touched is not in `validationFields` at all, so test for `undefined` as
well as `''`. Pressing Enter in a field also starts the hack.

Differs from upstream: the upstream page lists only `prompt`, `textarea` and
"any input type" and does not mention `boolean` or `sensitive`; both exist here.

Real examples with each: `owls-nest-extension/levels/owls_nest/objectives/fire_extinguisher_objective/objective.json`
has three `boolean` fields, and
`twilioquest-api-academy/levels/inside_perimeter/objectives/obtain_wand/objective.json`
has two `text` fields with Markdown links in the labels and a reward of
`"items": ["wand"]`.

## description.md and walkthrough.md

Both are Markdown (GitHub flavour, with code highlighting, via `showdown`) and
both are first run through the EJS template engine. Plain HTML inside them is
passed through, which is how the vendored objectives make their boxed
"Requirements" lists:

```md
<div class="aside">
<h3>Requirements</h3>
<ul>
  <li>Create a function called `balanceBrackets`.</li>
</ul>
</div>
```

The game shows `walkthrough.md` on the Help tab and adds a "Need more help?"
footer of its own after it (`ObjectiveDescription.jsx`).

### EJS variables

These names are available inside `<% %>`, `<%= %>` and `<%- %>`:

| Name | Value |
| --- | --- |
| `env` | The player's environment variables, as saved by earlier objectives. It is the raw map, so a value is `env.TQ_NAME.value`. |
| `levelState` | The saved state written with `world.setState` (the whole object, all keys) |
| `context` | The game's whole shared state (for example `context.extensions.directory`, `context.systemInfo`) |
| `resolveAbsolutePath(relativePath)` | Async path lookup across extensions |
| `formatPathPartsForOs(...parts)` | Joins path parts with `\` on Windows and `/` elsewhere |

The real use in the repo is
`public/extensions/twilioquest-open-source/levels/open_source/objectives/04_git_clone/walkthrough.md`,
which shows the learner their own GitHub URL:

```
git clone https://github.com/<%= env.TQ_GITHUB_USERNAME.value %>/open-pixel-art.git
```

Two traps:

- If the template throws, for example because `env.TQ_GITHUB_USERNAME` was never
  set, the game logs a warning and shows your raw Markdown, with the `<%= ... %>`
  text visible. It does not crash. Guard anyway:
  `<%= env.TQ_NAME ? env.TQ_NAME.value : '(not set yet)' %>`.
- `env` here is not the same shape as `helper.env` in a validator. In a
  validator, `helper.env.TQ_NAME` is the plain string.

EJS blocks are JavaScript and run with full permissions; see
[../security.md](../security.md).

### Where `env` values come from

A validator can save values for later objectives by passing a list to
`helper.success`:

```js
helper.success('Found it.', [{ name: 'GITHUB_USERNAME', value: username }]);
```

The game stores each entry as `TQ_<name>` (it adds the `TQ_` prefix unless the
name already starts with it), shows it in Settings under Variables, and lists
the new variables on the "Objective Clear" screen. `concealed: true` on an entry
hides the value in the Settings list.

### example.js

If `show_ide` is true, the QuestIDE opens with `example.js` from the objective
folder as the learner's starting code. The learner's saved code goes to
`QuestIDE/<level>/<objective>/user_code.js` under the app data folder
(`config.codeStoragePath`).

## Attaching an objective to a map object

Place an object on the map in Tiled and give it two custom properties:

| Property | Type | Value |
| --- | --- | --- |
| `hackable` | bool | `true` |
| `objectiveName` | string | The objective's folder name, for example `balance-brackets` |

When the player stands next to that object and presses space, the game opens the
hack interface for
`levels/<this map's level>/objectives/<objectiveName>/` (`TileObject.js`,
`interactionEffect`). The level is the level that owns the map, so two levels
can each have an objective with the same folder name.

You rarely type those properties by hand, because the tileset gives them as
defaults. In `public/extensions/twilioquest-base/tilesets/TwilioQuestObjects.json`,
the `terminal` tile and every `chest-*` tile come with `hackable: true` and
`objectiveName: "example_objective"`. You place the tile and change
`objectiveName` on that one object. For example, a terminal in
`public/extensions/twilioquest-base/levels/challenge-questions/maps/default.json`
has only `{"objectiveName": "difference-max-min"}`; the game merges in
`hackable` from the tileset. See [map.md](map.md) for the merge rules and
object types.

After a pass:

- the hack window shows the "Objective Clear" screen with XP, items and any new
  variables;
- the terminal, chest or laser barrier reacts, because its config listens for
  `objectiveCompleted` events with a matching `objectiveName`
  (`public/extensions/twilioquest-base/scripts/objectiveCompletionResponder.js`);
- your level's `events.js` receives `objectiveCompleted` (the first time) or
  `objectiveCompletedAgain`.

A laser barrier is the usual way to make an objective required: the barrier
object has the same `objectiveName`, so it opens when that objective is done.
A chest is the usual way to make one optional.

## Checklist for a new objective

1. Make the folder with all four files, even if `walkthrough.md` is short.
2. In `objective.json` set `title`, `description`, a `validation_fields` array,
   and `rewards.xp`.
3. Add the folder name to `objectives` in `level.json`.
4. Put a terminal (or chest) on the map and set its `objectiveName`.
5. Test the validator outside the game first (see [validator.md](validator.md)),
   then in the game. In the hack window, "Copy debug info" copies the location,
   fields and last error to the clipboard.
