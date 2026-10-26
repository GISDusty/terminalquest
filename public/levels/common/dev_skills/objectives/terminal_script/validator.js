const os = require('os');
const jetpack = require('fs-jetpack');

const SCRIPT_EXTENSIONS = /\.(sh|bash|zsh|ps1|bat|cmd)$/i;
const SHEBANG = /^#!/;
const ECHO_LINE = /^\s*(echo|write-host|write-output)\b/im;

// Pasted paths often arrive wrapped in quotes ("Copy as path" on Windows) or
// starting with ~ (which the shell expands, but Node does not)
function normalizePath(rawPath) {
  const unquoted = rawPath.replace(/^["']|["']$/g, '');
  return unquoted.replace(/^~(?=$|[\\/])/, os.homedir());
}

module.exports = async helper => {
  const { scriptPath } = helper.validationFields;

  if (!scriptPath) {
    return helper.fail(`
      Please paste the full path to your script file!
    `);
  }

  const path = normalizePath(scriptPath);

  try {
    const info = await jetpack.inspectAsync(path);

    if (!info) {
      return helper.fail(`
        Hmm, there is no file at that path. Make sure you saved your script, and
        that you pasted the <strong>full path</strong> to it (for example
        <code>/home/you/quest/my_script.sh</code>).
      `);
    }

    if (info.type !== 'file') {
      return helper.fail(`
        That path points to a folder. Paste the path to the script
        <strong>file</strong> you created, including its name.
      `);
    }

    const contents = await jetpack.readAsync(path);

    if (!SCRIPT_EXTENSIONS.test(path) && !SHEBANG.test(contents || '')) {
      return helper.fail(`
        That file doesn't look like a script. Name it
        <code>my_script.sh</code> on Mac/Linux, or <code>my_script.ps1</code> on
        Windows.
      `);
    }

    if (!ECHO_LINE.test(contents || '')) {
      return helper.fail(`
        Your script file exists, but it doesn't contain an <code>echo</code>
        command. Add a line like <code>echo "Hello, Operator"</code> to your
        script, save it, and try again.
      `);
    }
  } catch (e) {
    console.log(e);
    return helper.fail(`
      There was a problem reading that file - please check the path and try
      again.
    `);
  }

  helper.success(`
    Nice work! Your script file exists and contains a command to run. Once you
    run it from your terminal, you'll see your text printed out - and you can
    run it again any time you like.

    The barrier ahead of you dissolves in a flicker of light.
  `);
};
