// Guards against the deprecated Electron `remote` module (and its replacement-
// era helpers) creeping back into the codebase. The renderer now talks to the
// main process over explicit IPC; see src/js/app/common/electronBridge.js.
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getAppMeta, isDev, Store } from '../../../js/app/common/electronBridge';

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');

function listFiles(dir, extensions) {
  const result = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        // Babel output and test fixtures live here in an archived tree; only
        // scan source trees.
        if (entry.name === 'node_modules') {
          continue;
        }
        stack.push(entryPath);
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        result.push(entryPath);
      }
    }
  }
  return result;
}

describe('no remote module usage anywhere', () => {
  const remotes = [
    'enableRemoteModule',
    '.remote',
    "import { remote",
    "const { remote",
  ];
  const srcFiles = listFiles(path.join(repoRoot, 'src', 'js'), ['.js', '.jsx']);
  const otherFiles = [
    path.join(repoRoot, 'main.js'),
    path.join(repoRoot, 'public', 'code_runner', 'runner.js'),
    path.join(
      repoRoot,
      'public',
      'extensions',
      'twilioquest-python',
      'scripts',
      'objectiveValidation.js'
    ),
    path.join(
      repoRoot,
      'public',
      'extensions',
      'twilioquest-javascript',
      'scripts',
      'objectiveValidation.js'
    ),
  ];

  test("'remote' never appears in src/js/", () => {
    expect(srcFiles.length).toBeGreaterThan(0);
    for (const file of srcFiles) {
      const contents = fs.readFileSync(file, 'utf8');
      for (const pattern of [
        ...remotes,
        'electron-store',
        'electron-is-dev',
      ]) {
        expect(contents.includes(pattern)).toBe(false);
      }
    }
  });

  test("'remote' never appears in main.js or the code runner windows", () => {
    for (const file of otherFiles) {
      const contents = fs.readFileSync(file, 'utf8');
      for (const pattern of ['enableRemoteModule', '.remote', "import { remote", "const { remote"]) {
        expect(contents.includes(pattern)).toBe(false);
      }
    }
  });
});

describe('electronBridge', () => {
  test('getAppMeta and isDev come over IPC and are cached', () => {
    const { ipcRenderer } = require('electron');
    const meta = getAppMeta();

    expect(meta).toEqual({
      appDataPath: path.join(os.tmpdir(), 'terminalquest-test', 'appData'),
      userDataPath: path.join(os.tmpdir(), 'terminalquest-test', 'userData'),
      version: '0.0.0-test',
      isDev: false,
    });
    expect(isDev).toBe(false);

    // The metadata call is cached, so a second call does not re-ask main
    const sendSyncOriginal = ipcRenderer.sendSync;
    let sendSyncCalls = 0;
    ipcRenderer.sendSync = (...args) => {
      sendSyncCalls += 1;
      return sendSyncOriginal.apply(ipcRenderer, args);
    };
    try {
      getAppMeta();
      expect(sendSyncCalls).toBe(0);
    } finally {
      ipcRenderer.sendSync = sendSyncOriginal;
    }
  });

  test('Store reads, writes and deletes entries in the temp test dir', () => {
    const store = new Store({ name: 'noRemoteTest' });

    const storedPath = path.join(getAppMeta().userDataPath, 'noRemoteTest.json');
    expect(store.path).toBe(storedPath);

    expect(store.has('quest')).toBe(false);
    store.set('quest', 'fog_owl');
    expect(store.get('quest')).toBe('fog_owl');

    // Values persist in a fresh instance (written to disk)
    const secondStore = new Store({ name: 'noRemoteTest' });
    expect(secondStore.get('quest')).toBe('fog_owl');

    store.delete('quest');
    expect(secondStore.has('quest')).toBe(false);

    store.clear();
  });
});
