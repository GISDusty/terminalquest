// Namespace for all code runner related modules and data - we are going to
// use eval for now to execute the developer's code, so we'll keep our stuff
// obfuscated in the global scope
const ___cr___ = {
  // Capture original console log functions so we can override them later
  console: {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  },

  // failsafe to ensure we only duck punch the console methods once
  methodsDuckPunched: false,

  // Override console log methods
  duckPunch() {
    console.log = function() {
      ___cr___.console.log.apply(console, arguments);
      ___cr___.log('log', arguments);
    };

    console.info = function() {
      ___cr___.console.info.apply(console, arguments);
      ___cr___.log('info', arguments);
    };

    console.warn = function() {
      ___cr___.console.warn.apply(console, arguments);
      ___cr___.log('warn', arguments);
    };

    console.error = function() {
      ___cr___.console.error.apply(console, arguments);
      ___cr___.log('error', arguments);
    };
  },

  // helper function to send a log message back to the main process, which will
  // broadcast it to every open window
  log(logLevel, args) {
    require('electron').ipcRenderer.send('code_runner:log', {
      logLevel,
      arguments: Array.prototype.slice.call(args),
    });
  },

  // Handle uncaught errors
  uncaught(e) {
    // Get an error object from an unhandled promise rejection
    if (e.reason) {
      e = e.reason;
    }

    // Get an error message if one is provided
    let message = e.message;
    if (!message) {
      message =
        typeof e === 'string'
          ? e
          : 'Uncaught exception encountered - check your async code.';
    }

    // Use our duck-punched error handler
    console.error({
      message,
      stack: e.stack || '',
    });
  },
};

// Handle any uncaught errors we can
process.on('uncaughtException', ___cr___.uncaught);
window.addEventListener('onerror', ___cr___.uncaught);
window.addEventListener('unhandledrejection', ___cr___.uncaught);

// Eval code that's been written to disk by the IDE
require('electron').ipcRenderer.on('runWithEnv', (event, payload) => {
  // If env is null, don't run (this happens when code runner window is
  // initialized)
  if (!payload.env) {
    return;
  }

  // Only override the console methods once
  if (!___cr___.methodsDuckPunched) {
    ___cr___.duckPunch();
    ___cr___.methodsDuckPunched = true;
  }

  // Override process.env values with values provided
  Object.assign(process.env, payload.env);
  // Injecting "require" into the global object, which the vm instance uses as context
  // and makes accessible to users via the QuestIDE
  Object.assign(global, { require });

  // Read in contents of requested file and run it! YOLO!
  const code = require('fs-jetpack').read(payload.appCodePath);

  // Local stand-ins for the dead twilio.com/quest/magic API (API Academy
  // api-03, api-04, api-05). Shared with the validators: the data and routing
  // are in src/js/app/common/apiAcademyStubs.js, loaded here from its compiled
  // copy. Every other URL goes to the real fetch. The window is reloaded for
  // each run, so this installs once per run.
  try {
    if (!___cr___.fetchPatched) {
      const { createFetchOverride } = require('../app/common/apiAcademyStubs');
      window.fetch = createFetchOverride(window.fetch.bind(window));
      ___cr___.fetchPatched = true;
    }
  } catch (e) {
    console.error(
      'Could not load the API Academy fetch stand-ins; fetch will use the network:',
      e.message
    );
  }

  // Hard coding polyfill of String.replaceAll, since the version of electron we're using (as of 11/16/2022)
  // doesn't have a new enough version of Node to natively support it
  const extendedUserCode = `
      /**
       * String.prototype.replaceAll() polyfill
       * https://gomakethings.com/how-to-replace-a-section-of-a-string-with-another-one-with-vanilla-js/
       * @author Chris Ferdinandi
       * @license MIT
       */
      if (!String.prototype.replaceAll) {
        String.prototype.replaceAll = function(str, newStr) {
          // If a regex pattern
          if (
            Object.prototype.toString.call(str).toLowerCase() ===
            '[object regexp]'
          ) {
            return this.replace(str, newStr);
          }

          // If a string
          return this.replace(new RegExp(str, 'g'), newStr);
        };
      }
      
      ${code};
    `;
  try {
    require('vm').runInThisContext(extendedUserCode, {
      filename: 'script.js',
    });
  } catch (e) {
    console.error('There was a problem executing your code:', {
      message: e.message,
      stack: e.stack,
    });
  }
});
