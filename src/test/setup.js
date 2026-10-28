// Tests run under Jest's jsdom environment, not inside an Electron window.
// Nothing here needs a real Electron API, so `electron` is replaced with a
// self-contained stand-in. App code loads its app metadata over IPC
// (`ipcRenderer.sendSync('tq:get-app-meta')`, see electronBridge.js) and can
// then import on startup. NOTE: there is intentionally no `remote` property -
// the deprecated remote module must not reappear (see noRemote.test.js).
jest.mock('electron', () => {
  const os = require('os');
  const path = require('path');
  const paths = {
    appData: path.join(os.tmpdir(), 'terminalquest-test', 'appData'),
    userData: path.join(os.tmpdir(), 'terminalquest-test', 'userData'),
  };
  const ipcMain = {
    on: () => undefined,
    handle: () => undefined,
  };
  const ipcRenderer = {
    sendSync: (channel, ...args) => {
      if (channel === 'tq:get-app-meta') {
        return {
          appDataPath: paths.appData,
          userDataPath: paths.userData,
          version: '0.0.0-test',
          isDev: false,
        };
      }
      if (channel === 'tq:show-message-box-sync') {
        return 0;
      }
      return undefined;
    },
    send: () => undefined,
    on: () => undefined,
    invoke: async () => undefined,
  };
  const shell = {
    openExternal: () => undefined,
    openPath: () => undefined,
  };
  return { ipcMain, ipcRenderer, shell };
});

// Some app modules extend Phaser classes at import time (e.g. StarParticle),
// and the HTML wrapper provides Phaser as a global, so do the same here.
const fs = require('fs');
const path = require('path');
window.eval(
  fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'public', 'lib', 'phaser-2.13.2.min.js'),
    'utf8'
  )
);
