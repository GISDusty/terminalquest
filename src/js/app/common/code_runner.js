import EventEmitter from 'events';
import * as jetpack from 'fs-jetpack';
import { staticFilePath } from './fs_utils';
import { getAppMeta } from './electronBridge';

// Necessary electron goodies
const { ipcRenderer } = require('electron');

// Paths for code execution
const basePath = `${getAppMeta().userDataPath}/QuestIDE`;
const appCodePath = `${basePath}/script.js`;
const runnerHtmlPath = staticFilePath('code_runner/runner.html');

// Run IDE code in an invisible browser window instance. The window itself is
// created and managed by the main process over IPC; the renderer just tells it
// when to initialize and when to run new code.
class CodeRunner extends EventEmitter {
  constructor() {
    super();

    // Tear down any old runner window and create a fresh invisible one
    ipcRenderer.send('code_runner:init', {
      runnerHtmlPath,
      appCodePath,
    });

    this.env = null;

    // Listen for IPC events that will be broadcast by the code runner window
    ipcRenderer.on('code_runner:log', (event, payload) => {
      this.emit('log', payload);
    });
  }

  // Exceute the given code in an invisible Electron window
  runCode(code, env) {
    // Save current environment info as an instance var
    this.env = env;

    const self = this;
    (async function() {
      try {
        // Write the latest code out to disk
        await jetpack.writeAsync(appCodePath, code);

        // Have the main process reload the invisible code runner window,
        // which should make it try to load and run the code again
        ipcRenderer.send('code_runner:run', {
          env,
          appCodePath,
          runnerHtmlPath,
        });
      } catch (e) {
        console.error('Code runner execution error:');
        console.error(e);
        self.emit('console.error', e.message);
      }
    })();
  }

  // Terminate any running code by reloading the code runner window with dummy
  // code on disk
  terminate() {
    this.runCode('console.log("Terminated.")', {});
  }
}

// Export a singleton
const codeRunnerInstance = new CodeRunner();
export default codeRunnerInstance;
