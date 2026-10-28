/*
This file is used during development to load an electron window in the same way
as the launcher app would - it's not a perfect recreation, but probably good
enough for dev.
*/
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  MenuItem,
  shell
} = require('electron');

// On modern kernels (tested 2026-10-27) Electron 11's sandboxed GPU process is
// killed by the seccomp filter immediately at launch: SIGSYS, si_code
// SYS_SECCOMP. Every launch therefore core-dumps, Omarchy's crash watcher
// raises a "Process crashed: electron" toast, and clicking it starts a new
// diagnose agent, which relaunches the game to reproduce the crash, and the
// loop repeats. The game already runs with nodeIntegration, the remote module
// and contextIsolation off (see docs/security.md for the accepted tradeoff),
// so the renderer gains nothing it did not have; this only unbreaks the GPU
// process. Verify: the app survived a 20 s launch with no coredump.
app.commandLine.appendSwitch('no-sandbox');

// Configure a bare-bones right click context menu
require('electron-context-menu')();

// Reference to main launcher window
let mainWindow;

const isDev =
  'ELECTRON_IS_DEV' in process.env
    ? parseInt(process.env.ELECTRON_IS_DEV, 10) === 1
    : !app.isPackaged;

// Renderer replacements for the removed `remote` module -----------------------
ipcMain.on('tq:get-app-meta', event => {
  event.returnValue = {
    appDataPath: app.getPath('appData'),
    userDataPath: app.getPath('userData'),
    version: app.getVersion(),
    isDev,
  };
});

ipcMain.on('tq:show-message-box-sync', (event, options) => {
  event.returnValue = dialog.showMessageBoxSync(null, options);
});

ipcMain.handle('tq:show-open-dialog', (event, options) =>
  dialog.showOpenDialog(options)
);

ipcMain.on('tq:open-devtools', () => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (win && !win.isDestroyed()) win.webContents.openDevTools();
});

// Build the Help submenu on request from the renderer, which owns the state
// (Spector availability, user paths) needed to populate it.
ipcMain.on(
  'tq:setup-help-menu',
  (event, { spectorEnabled, userDataPath, saveFilePath }) => {
    const applicationMenu = Menu.getApplicationMenu();
    if (!applicationMenu) return;
    const helpMenuItem = applicationMenu.items.find(
      menuItem => menuItem.role === 'help'
    );
    if (!helpMenuItem || !helpMenuItem.submenu) return;

    const devToolsLabel = 'Toggle Developer Tools';
    const devToolsItem = helpMenuItem.submenu.items.find(
      item => item.label === devToolsLabel
    );

    if (!devToolsItem) {
      helpMenuItem.submenu.append(
        new MenuItem({
          label: devToolsLabel,
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('tq:menu-action', 'devtools-warning');
            }
            (BrowserWindow.getFocusedWindow() || mainWindow).webContents.toggleDevTools();
          },
        })
      );

      helpMenuItem.submenu.append(
        new MenuItem({
          label: 'Sync Bundled Assets',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send(
                'tq:menu-action',
                'sync-bundled-assets'
              );
            }
          },
        })
      );

      helpMenuItem.submenu.append(
        new MenuItem({
          label: 'Open User Data',
          click: () => {
            shell.openPath(userDataPath);
          },
        })
      );

      helpMenuItem.submenu.append(
        new MenuItem({
          label: 'Open Save File',
          click: () => {
            shell.openPath(saveFilePath);
          },
        })
      );

      if (spectorEnabled) {
        helpMenuItem.submenu.append(
          new MenuItem({
            label: 'Show Spector.js UI',
            click: () => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('tq:menu-action', 'spector-ui');
              }
            },
          })
        );

        helpMenuItem.submenu.append(
          new MenuItem({
            label: 'Capture Frame with Spector.js',
            click: () => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(
                  'tq:menu-action',
                  'spector-capture'
                );
              }
            },
          })
        );
      }
    }

    Menu.setApplicationMenu(applicationMenu);
  }
);

// Invisible code runner window ------------------------------------------------
let codeWindow = null;
let codeRunnerState = { env: null, appCodePath: '' };

function createCodeWindow(runnerHtmlPath) {
  // Close any other invisible runner.html windows left behind
  BrowserWindow.getAllWindows().forEach(window => {
    if (window.isDestroyed()) return;
    if (!window.isVisible() && window.webContents.getURL().endsWith('runner.html')) {
      window.close();
    }
  });

  codeWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // Electron 20+ sandboxes renderers by default; disable so the
      // code runner can still use Node and Electron APIs.
      sandbox: false
    },
    // Specifying the main window as the parent ensures it is closed and
    // cleaned up when the game window closes
    parent: mainWindow || undefined,
  });

  codeWindow.on('closed', () => {
    codeWindow = null;
  });

  // When the window loads, send an IPC message with any current environment
  // variables from a recent code execution. On the first load, env will be
  // null, so no code will be executed.
  codeWindow.webContents.on('did-finish-load', () => {
    if (codeWindow && !codeWindow.isDestroyed()) {
      codeWindow.webContents.send('runWithEnv', codeRunnerState);
    }
  });

  codeWindow.loadFile(runnerHtmlPath);
}

ipcMain.on('code_runner:init', (event, { runnerHtmlPath, appCodePath }) => {
  codeRunnerState = { env: null, appCodePath };
  createCodeWindow(runnerHtmlPath);
});

ipcMain.on(
  'code_runner:run',
  (event, { env, appCodePath, runnerHtmlPath }) => {
    codeRunnerState = { env, appCodePath };
    if (!codeWindow || codeWindow.isDestroyed()) {
      createCodeWindow(runnerHtmlPath);
    } else {
      codeWindow.webContents.reload();
    }
  }
);

// Broadcast code runner log messages from the runner window to all windows
// (the runner window no longer gets the remote module)
ipcMain.on('code_runner:log', (event, payload) => {
  BrowserWindow.getAllWindows().forEach(w => {
    if (!w.isDestroyed()) {
      w.webContents.send('code_runner:log', payload);
    }
  });
});

// -----------------------------------------------------------------------------

function createWindow() {
  if (isDev) {
    // Install React dev tools on launch in dev
    const {
      default: installExtension,
      REACT_DEVELOPER_TOOLS
    } = require('electron-devtools-installer');

    installExtension(REACT_DEVELOPER_TOOLS).then(name => {
      console.log(`Added Extension: ${name}`);
    }).catch(err => {
      console.log('An error occurred: ', err);
    });
  }

  mainWindow = new BrowserWindow({
    title: 'TerminalQuest',
    backgroundColor: '#232323',
    height: 800,
    width: 1280,
    minWidth: 1024,
    minHeight: 576,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // Electron 20+ sandboxes renderers by default; disable so the
      // app can still use Node and Electron APIs.
      sandbox: false
    }
  });
  mainWindow.loadFile('public/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Dereference the window after close
  mainWindow.on('closed', () => {
    mainWindow = null;
    process.exit(0);
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  app.quit();
});
