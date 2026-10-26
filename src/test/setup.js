import path from 'path';
import jetpack from 'fs-jetpack';
import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

// @jest-runner/electron opens its test windows with only
// `webPreferences: { nodeIntegration: true }`. Since Electron 10,
// `enableRemoteModule` defaults to false, so `require('electron').remote` is
// undefined in the test renderer, and app code that does
// `remote.app.getPath(...)` (config.js, analytics.js) or `electron-is-dev`
// (`electron.app || electron.remote.app`) throws on import. The real game
// window sets `enableRemoteModule: true` in main.js. Stand in a minimal
// `remote.app` here so those modules can load.
jest.mock('electron', () => {
  const os = require('os');
  const path = require('path');
  const app = {
    isPackaged: false,
    getVersion: () => '0.0.0-test',
    getPath: name => path.join(os.tmpdir(), 'terminalquest-test', name),
  };
  return Object.assign({}, jest.requireActual('electron'), {
    remote: { app },
  });
});

configure({ 
  adapter: new Adapter()
});

// Bootstrap browser window environment, as we do in our HTML wrapper
[
  path.resolve(
    __dirname, '..', '..', 'public', 'lib', 'phaser-2.13.2.min.js'
  ),
  path.resolve(
    __dirname, '..', '..', 'public', 'lib', 'firebase', 'firebase-app.js'
  ),
  path.resolve(
    __dirname, '..', '..', 'public', 'lib', 'firebase', 'firebase-firestore.js'
  ),
].forEach(path => {
  const code = jetpack.read(path);
  window.eval(code);
});
