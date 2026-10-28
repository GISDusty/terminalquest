import React from 'react';
import ReactDOM from 'react-dom';
import App from './app/components/App';
import audioManager from './app/common/audio/index';
import { isDev } from './app/common/electronBridge';
import { syncBundledAssets } from './app/common/assetLoader';
import extendYup from './app/common/extendYup';
const { shell, ipcRenderer } = require('electron');
import config from './app/config/config';

extendYup();

window.confirm = function(message) {
  const buttonIdx = ipcRenderer.sendSync('tq:show-message-box-sync', {
    type: 'question',
    buttons: ['OK', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    detail: message,
    message: '',
  });
  return buttonIdx === 0;
};

window.alert = function(message) {
  const buttonIdx = ipcRenderer.sendSync('tq:show-message-box-sync', {
    type: 'warning',
    buttons: ['OK'],
    defaultId: 0,
    cancelId: 0,
    detail: message,
    message: '',
  });
};

const DEVTOOLS_WARNING = `
*** DANGER ***

Danger! Wee-ooo, wee-ooo!

For real though - do NOT execute code given to you by strangers! Executing code in this window can harm your computer. Proceed with caution, or better yet, close this window unless you know precisely what you are doing.

*** DANGER ***
`;

setTimeout(() => console.warn(DEVTOOLS_WARNING), 1500);

function downloadJSON(blob, fileName = 'download') {
  let anchor = document.querySelector('#download-anchor');

  if (!anchor) {
    anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.id = 'download-anchor';

    document.body.appendChild(anchor);
  }

  const dataStr =
    'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(blob));

  anchor.setAttribute('href', dataStr);
  anchor.setAttribute('download', `${fileName}.json`);
  anchor.click();
}

// Capture link clicks to web resources and open in system default browser
document.addEventListener(
  'click',
  e => {
    if (e.target.matches('a[href^="http"]')) {
      e.preventDefault();
      const targetUrl = new URL(e.target.href);
      const newQuery = new URLSearchParams(targetUrl.searchParams.toString());
      const newUrl = [
        targetUrl.origin,
        targetUrl.pathname,
        `?${newQuery.toString()}`,
        targetUrl.hash,
      ].join('');
      console.log('Opening external link:', newUrl);
      shell.openExternal(newUrl);
    }
  },
  false
);

// Load Spector.js debugger (a WebGL inspector fetched from a CDN, so only when
// explicitly enabled with `enableSpector` in local_config.js)
const spectorEnabled = isDev && config.enableSpector;
let spector;
if (spectorEnabled) {
  const script = document.createElement('script');
  script.onload = () => {
    spector = new window.SPECTOR.Spector();
    spector.onCaptureStarted.add(() => {});
    spector.onCapture.add(result => {
      downloadJSON(result, 'spector-capture');
    });
    spector.onError.add(console.error);
  };
  script.src = 'https://spectorcdn.babylonjs.com/spector.bundle.js';
  document.head.appendChild(script);
}

// Ask the main process to add the game menu items once the game launches; the
// main process builds the Help submenu, and dispatches actions back here.
ipcRenderer.send('tq:setup-help-menu', {
  spectorEnabled,
  userDataPath: config.userDataPath,
  saveFilePath: config.saveFilePath,
});

ipcRenderer.on('tq:menu-action', async (event, action) => {
  switch (action) {
    case 'devtools-warning':
      console.warn(DEVTOOLS_WARNING);
      break;
    case 'sync-bundled-assets':
      console.log('Syncing bundled assets...');
      await syncBundledAssets();
      console.log('Bundled assets synced!');
      break;
    case 'spector-ui':
      if (spector) {
        spector.displayUI();
      }
      break;
    case 'spector-capture':
      if (spector) {
        console.log('Spector.js capture starting...');
        spector.startCapture(document.querySelector('canvas'));
      }
      break;
  }
});

const appDependencies = {
  dom: {
    loaded: false,
  },
  audio: {
    loaded: false,
  },
};

function areDependenciesLoaded() {
  return Object.values(appDependencies).every(dependency => dependency.loaded);
}

function attemptAppRender() {
  if (areDependenciesLoaded()) {
    // Mount React app on named DOM element
    const appNode = document.getElementById('app');

    ReactDOM.render(<App />, appNode);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  appDependencies.dom.loaded = true;

  attemptAppRender();
});

audioManager.loadMusic();
audioManager.loadSfx();
audioManager.onload = () => {
  appDependencies.audio.loaded = true;

  attemptAppRender();
};
