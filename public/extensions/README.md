# Bundled extensions (vendored)

These directories are the lesson-content packages that ship with TerminalQuest
(the list in `src/js/app/config/bundledExtensionModules.json`). They were
copied verbatim from their npm tarballs and are now maintained in this
repository. `public/package.json` points at them with `file:extensions/<name>`,
so `npm install` links them into `public/node_modules` instead of downloading
and overwriting them.

The content is no longer updated from npm. The old task that ran `npm install <name>@latest` was removed, because it would replace these links with registry copies.

**Lesson fixes go here, in `public/extensions/<name>/`. Never edit
`public/node_modules`; it is a generated install directory.**

| Package | npm version copied | Upstream repository |
| --- | --- | --- |
| `twilioquest-base` | 8.1.0 | https://github.com/TwilioQuest/twilioquest-base |
| `owls-nest-extension` | 1.0.10 | none listed in package.json |
| `twilioquest-javascript` | 1.1.7 | none listed in package.json |
| `twilioquest-open-source` | 2.0.1 | none listed in package.json |
| `twilioquest-python` | 1.0.7 | none listed in package.json |
| `twilioquest-api-academy` | 3.0.2 | none listed in package.json |
| `twilioquest-dev-fundamentals` | 2.4.0 | none listed in package.json |

Omitted from the copies: any nested `node_modules/` (dependencies are now
declared by each package's `package.json` and installed by npm) and the
`.github/` directories.

`twilioquest-twilio-vr` is not vendored. It is not in the bundled list, so it
is not loaded.

## Licensing

The code in each package is MIT licensed, copyright Twilio Inc.; each package's
`LICENSE` file is kept alongside it. Artwork, music and other creative assets
are licensed under [Creative Commons Attribution 4.0
International](https://creativecommons.org/licenses/by/4.0/) (CC BY 4.0), as
described in the repository `README.md`.
