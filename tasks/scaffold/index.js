const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const chalk = require('chalk');
const { ncp } = require('ncp');
const { stripIndents } = require('common-tags');
const commandLineArgs = require('command-line-args');

/**
 * Creates a mission inside an external extension.
 *
 * The game only loads levels from `<extension>/levels/<name>/`, so the
 * output goes into an extension folder, not into `public/levels/`.
 *
 * If this is executed as an npm script, arguments to this script must be
 * passed preceded with `--`. For more info:
 * https://docs.npmjs.com/cli/run-script
 *
 * Examples:
 *   npm run scaffold:mission -- my_mission
 *   npm run scaffold:mission -- my_mission --extension ~/tq-extensions/my-lessons
 */
const optionDefinitions = [
  { name: 'missionName', type: String, defaultOption: true },
  { name: 'extension', alias: 'e', type: String },
];

const DEFAULT_EXTENSION_DIR = path.join(
  os.homedir(),
  'tq-extensions',
  'my-extension'
);

/**
 * npm-run-script sets INIT_CWD to the directory npm was started in. Relative
 * paths on the command line are resolved against it.
 */
const invocationDir = process.env.INIT_CWD || process.cwd();

// Level folder names are used in warp commands, saved progress keys and
// `levelChange` objects, so keep them simple.
const MISSION_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

function fail(message) {
  console.error(chalk`{red {bold ${message}}}`);
  process.exitCode = 1;
}

function expandHome(p) {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function titleFromName(name) {
  return name
    .split(/[_-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch (e) {
    return false;
  }
}

async function run() {
  const options = commandLineArgs(optionDefinitions);

  if (!options.missionName) {
    fail('No mission was provided! This command requires a mission name.');
    console.error(
      stripIndents(chalk`
        {blue Example:}
          npm run scaffold:mission -- my_mission
          npm run scaffold:mission -- my_mission --extension ~/tq-extensions/my-lessons

        {blue Options:}
          --extension, -e  the extension folder to write into
                           (default: ${DEFAULT_EXTENSION_DIR})
      `)
    );
    return;
  }

  if (!MISSION_NAME_PATTERN.test(options.missionName)) {
    fail(
      `"${options.missionName}" is not a valid mission name. Use letters, digits, "_" and "-", starting with a letter or digit.`
    );
    return;
  }

  const extensionDir = path.resolve(
    invocationDir,
    expandHome(options.extension || DEFAULT_EXTENSION_DIR)
  );
  const missionPath = path.join(extensionDir, 'levels', options.missionName);

  if (await exists(missionPath)) {
    fail(
      `This mission already exists! "${options.missionName}" is already in ${path.join(
        extensionDir,
        'levels'
      )}. Nothing was changed.`
    );
    return;
  }

  const createdExtension = await ensureExtension(extensionDir);
  await copyMissionDirectory(missionPath);
  await fillInTemplate(missionPath, options.missionName);

  console.log(
    chalk`{green Done creating mission {bold ${options.missionName}} in ${missionPath}}`
  );
  if (createdExtension) {
    console.log(
      chalk`{green Created a new extension at ${extensionDir} (package.json).}`
    );
  }
  printNextSteps(extensionDir, options.missionName);
}

/**
 * Makes sure `extensionDir` is a valid extension. `isExtensionValid` in
 * src/js/app/common/extensions.js needs a package.json with a string `name`
 * and a string `version`. An existing package.json is never changed.
 *
 * @returns {Promise<boolean>} true if package.json was created
 */
async function ensureExtension(extensionDir) {
  const packageJsonPath = path.join(extensionDir, 'package.json');

  if (await exists(packageJsonPath)) {
    return false;
  }

  await fs.mkdir(extensionDir, { recursive: true });

  const packageName =
    path
      .basename(extensionDir)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[-._]+/, '') || 'my-extension';

  await fs.writeFile(
    packageJsonPath,
    JSON.stringify({ name: packageName, version: '0.0.1' }, null, 2) + '\n'
  );

  return true;
}

async function copyMissionDirectory(targetPath) {
  const missionScaffoldDir = path.resolve(
    __dirname,
    'mission_scaffold'
  );

  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  return new Promise((resolve, reject) => {
    ncp(missionScaffoldDir, targetPath, err => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

async function fillInTemplate(missionPath, missionName) {
  const levelJsonPath = path.join(missionPath, 'level.json');
  const levelJson = await fs.readFile(levelJsonPath, 'utf8');

  await fs.writeFile(
    levelJsonPath,
    levelJson.replace(/__TITLE__/g, titleFromName(missionName))
  );
}

function printNextSteps(extensionDir, missionName) {
  const extensionsParent = path.dirname(extensionDir);
  const missionPath = path.join(extensionDir, 'levels', missionName);

  console.log(
    [
      '',
      chalk.bold('Next steps'),
      '1. Start the game, press O to open Settings and choose the Extensions tab.',
      '2. Click Enable Extensions, then Choose Directory and pick:',
      `     ${chalk.cyan(extensionsParent)}`,
      `   (the folder that CONTAINS "${path.basename(extensionDir)}", not the extension itself).`,
      `3. Restart the game. Levels are scanned once at startup, then "${titleFromName(
        missionName
      )}" appears in the Mission Computer on the Fog Owl.`,
      '   To jump straight in from the developer console:',
      `     ${chalk.cyan(`warp('${missionName}', 'player_entry1', 'default');`)}`,
      `4. Edit ${chalk.cyan(missionPath)}.`,
      '   The sample objective is "sample_objective"; its terminal is in maps/default.json.',
      '',
      'Authoring docs: docs/authoring/README.md in the TerminalQuest repository.',
    ].join('\n')
  );
}

run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
