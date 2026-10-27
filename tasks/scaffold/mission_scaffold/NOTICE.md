# Notice

`maps/default.json` is adapted from
`public/extensions/twilioquest-base/levels/challenge-questions/maps/room_template.json`
in the TerminalQuest repository (a fork of TwilioQuest). The map layout and the
tilesets it references are creative assets licensed under Creative Commons
Attribution 4.0 International (CC BY 4.0,
<https://creativecommons.org/licenses/by/4.0/>), copyright Twilio Inc. and
contributors. Changes: removed the NPC, two terminals, a collider and the
JavaScript tileset, and pointed the one remaining terminal at `sample_objective`.

The tilesets are not copied here. The map points at
`../../../../.bundled/tilesets/`, which the game fills in from the bundled
extensions. Keep your extension folder directly inside the folder you choose in
Settings so that path resolves.

Delete this file if you replace the map with your own art.
