/**
 * Backlog item 9b: the release tarball must preserve the relative symlinks
 * that `npm install` creates in public/node_modules (each bundled extension
 * is a symlink into ../extensions/<name>). tasks/create_release.js packs
 * public/ with the root `tar` package; this test proves that a tarball made
 * the same way keeps <ext> -> ../extensions/<ext> and that the app can still
 * read files through the symlink after extraction elsewhere.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import tar from 'tar';

const EXT_NAME = 'twilioquest-base';

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

describe('release tarball symlink handling', () => {
  test('public/node_modules/<ext> symlink is preserved and resolves after extraction', async () => {
    // Build a minimal fake public/ tree in a temp directory.
    const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-release-src-'));
    const publicDir = path.join(sourceDir, 'public');

    writeJson(path.join(publicDir, 'package.json'), { name: 'public' });
    writeJson(path.join(publicDir, 'extensions', EXT_NAME, 'level.json'), {
      id: `${EXT_NAME}-level`,
    });

    // The vendored extension actually lives in public/extensions/<ext>, and
    // node_modules/<ext> is a relative symlink pointing at
    // ../extensions/<ext>, exactly as bundling leaves the release tree.
    const extensionsExt = path.join(publicDir, 'extensions', EXT_NAME);
    writeJson(path.join(extensionsExt, 'package.json'), { name: EXT_NAME });
    writeJson(path.join(extensionsExt, 'level.json'), {
      id: `${EXT_NAME}-level`,
    });
    fs.mkdirSync(path.join(publicDir, 'node_modules'), { recursive: true });
    fs.symlinkSync(
      path.join('..', 'extensions', EXT_NAME),
      path.join(publicDir, 'node_modules', EXT_NAME),
      'dir'
    );

    // Pack public/ the same way tasks/create_release.js does.
    const tarballFile = path.join(sourceDir, 'release.tar.gz');
    await tar.c(
      {
        gzip: true,
        file: tarballFile,
        cwd: sourceDir,
      },
      ['public']
    );

    // Extract into a fresh temp directory.
    const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-release-out-'));
    fs.renameSync(tarballFile, path.join(extractDir, 'release.tar.gz'));
    tar.x({
      file: path.join(extractDir, 'release.tar.gz'),
      cwd: extractDir,
      sync: true,
    });

    // The symlink must have survived packaging and extraction as a relative
    // <ext> -> ../extensions/<ext> link.
    const extractedSymlink = path.join(
      extractDir,
      'public',
      'node_modules',
      EXT_NAME
    );
    expect(fs.lstatSync(extractedSymlink).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(extractedSymlink)).toBe(
      path.join('..', 'extensions', EXT_NAME)
    );

    // And reading a vendored file through the symlink must resolve to the
    // extensions/<ext> copy.
    try {
      const levelThroughSymlink = JSON.parse(
        fs.readFileSync(path.join(extractedSymlink, 'level.json'), 'utf8')
      );
      expect(levelThroughSymlink).toEqual({ id: `${EXT_NAME}-level` });
      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(extractDir, 'public', 'extensions', EXT_NAME, 'level.json'),
            'utf8'
          )
        )
      ).toEqual(levelThroughSymlink);
    } finally {
      fs.rmSync(sourceDir, { recursive: true, force: true });
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
  }, 30000);
});
