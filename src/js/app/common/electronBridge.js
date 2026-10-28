// Replaces the store and dev-flag helpers the renderer previously loaded from
// external packages, which today feed through Electron's deprecated `remote`
// module. App metadata and dialogs now travel over explicit main-process IPC.
import path from 'path';
import Conf from 'conf';
const { ipcRenderer } = require('electron');

let cachedMeta = null;

export function getAppMeta() {
  if (!cachedMeta) {
    cachedMeta = ipcRenderer.sendSync('tq:get-app-meta');
  }
  return cachedMeta;
}

export const isDev = Boolean(getAppMeta().isDev);

export class Store extends Conf {
  constructor(options = {}) {
    const defaultCwd = getAppMeta().userDataPath;
    const opts = {
      name: 'config',
      ...options,
    };
    if (opts.cwd) {
      opts.cwd = path.isAbsolute(opts.cwd)
        ? opts.cwd
        : path.join(defaultCwd, opts.cwd);
    } else {
      opts.cwd = defaultCwd;
    }
    opts.configName = opts.name;
    delete opts.name;
    super(opts);
  }
}

export default Store;
