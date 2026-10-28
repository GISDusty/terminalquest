import path from 'path';
import { getAppMeta, isDev } from '../common/electronBridge';
import bundledExtensionModules from './bundledExtensionModules.json';

const { appDataPath: rawAppDataPath, userDataPath: rawUserDataPath } =
  getAppMeta();
const appDataPath = path.resolve(rawAppDataPath, 'TerminalQuest');
const userDataPath = path.resolve(rawUserDataPath);
const PRODUCTION_API_BASE_URL =
  'https://twilioquest-prod.firebaseapp.com/quest/';
const DEV_API_BASE_URL = 'https://twilioquest-dev.firebaseapp.com/quest/';
const saveFileName = 'config.json';

// Default configuration
let config = {
  defaultLevelName: 'fog_owl',
  defaultPlayerEntry: 'player_entry1',
  defaultMapName: 'default',
  prologueMissionStateKey: 'com.terminalquest.owls_nest',
  defaultLevelNamePrologue: 'owls_nest',
  defaultPlayerEntryPrologue: 'player_entry1',
  defaultMapNamePrologue: 'default',
  appDataPath,
  codeStoragePath: path.join(appDataPath, 'QuestIDE'),
  codeStorageFileName: 'user_code.js',
  // The backend is unmaintained; set true in local_config.js to re-enable
  // cloud sync, unlock codes, teams and live events.
  backendEnabled: false,
  // Load the Spector.js WebGL debugger from a CDN (dev builds only)
  enableSpector: false,
  apiBaseUrl: PRODUCTION_API_BASE_URL,
  bundledExtensionModules,
  userDataPath,
  saveFileName,
  saveFilePath: path.join(userDataPath, saveFileName),
};

// Attempt to load local config in the dev environment, if present
if (isDev) {
  try {
    const localConfig = require('./local_config');
    config = Object.assign(config, localConfig);
  } catch (e) {
    console.log('Error loading local config:');
    console.log(e);
  }

  if (config.apiBaseUrl === PRODUCTION_API_BASE_URL) {
    config.apiBaseUrl = DEV_API_BASE_URL;
  }
}

export default config;
