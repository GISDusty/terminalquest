// Tests run under Jest's jsdom environment, not inside an Electron window.
// Nothing here needs a real Electron API, so `electron` is replaced with a
// self-contained stand-in. App code that does `remote.app.getPath(...)`
// (config.js, analytics.js) or `electron-is-dev`
// (`electron.app || electron.remote.app`) can then load on import.
jest.mock('electron', () => {
  const os = require('os');
  const path = require('path');
  const app = {
    isPackaged: false,
    getVersion: () => '0.0.0-test',
    getPath: name => path.join(os.tmpdir(), 'terminalquest-test', name),
  };
  return { remote: { app } };
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
