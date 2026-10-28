/**
 * Tests that EntityFactory + TiledService merge tileset-level default
 * properties with map-level object properties on the real
 * twilioquest-javascript extension data, and that the keycard-terminal
 * object's interaction handler behaves as expected.
 */
import path from 'path';
import fs from 'fs';

// Path to the checked-in public/extensions directory, relative to this file.
const EXTENSIONS_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'public',
  'extensions'
);
const PUBLIC_PATH = path.resolve(EXTENSIONS_PATH, '..');

// Mock assetLoader so that all extension file lookups resolve against the
// real public/extensions directory on disk.
jest.mock('../../../../js/app/common/assetLoader', () => {
  const path = require('path');
  const fs = require('fs');

  const EXTENSIONS_PATH = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    'public',
    'extensions'
  );

  async function resolve(relativePath) {
    // Lookup order mirrors assetLoader.resolveAbsolutePath: the path as given
    // (extension names are part of many relative paths), falling back to
    // searching each extension directory.
    const candidates = [];

    if (relativePath.split(path.sep).length > 1 || relativePath.includes('/')) {
      candidates.push(path.join(EXTENSIONS_PATH, relativePath));
    }

    const extensionNames = fs
      .readdirSync(EXTENSIONS_PATH, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();

    extensionNames.forEach(extensionName =>
      candidates.push(path.join(EXTENSIONS_PATH, extensionName, relativePath))
    );

    for (const candidate of candidates) {
      try {
        fs.statSync(candidate);
        return candidate;
      } catch (err) {
        // keep looking
      }
    }

    return undefined;
  }

  return {
    __esModule: true,
    readFile: async (relativePath, options) => {
      const absolutePath = await resolve(relativePath);
      if (!absolutePath) return undefined;
      try {
        return fs.readFileSync(absolutePath, options).toString();
      } catch (err) {
        return undefined;
      }
    },
    resolveAbsolutePath: async relativePath => resolve(relativePath),
    getOwningExtensionName: async absolutePath => {
      const relative = path.relative(EXTENSIONS_PATH, absolutePath);
      return relative.split(path.sep)[0];
    },
    getPathRelativeToOwningExtension: async absolutePath => {
      const relative = path.relative(EXTENSIONS_PATH, absolutePath);
      return relative.split(path.sep).slice(1).join(path.sep);
    },
  };
});

jest.mock('../../../../js/app/common/extensions', () => ({
  __esModule: true,
  BUNDLED_ASSET_DIRECTORY: '.bundled',
  getExtensionDirectory: () =>
    require('path').resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      '..',
      'public',
      'extensions'
    ),
}));

// EntityFactory instantiates concrete entity classes that touch Phaser and
// game services we don't want (or need) in this unit test. Replace them all
// with a lightweight recorder via a Proxy over the real collection metadata.
jest.mock(
  '../../../../js/app/components/game/entities/service/EntityMap',
  () => {
    class StubEntity {
      constructor(level, obj) {
        this.level = level;
        this.obj = obj;
      }
    }

    return {
      __esModule: true,
      default: new Proxy(
        {},
        {
          get: () => ({
            type: StubEntity,
            collections: [],
            group: '',
          }),
        }
      ),
    };
  }
);

describe('EntityFactory + TiledService tileset property merging', () => {
  const MAP_PATH = 'twilioquest-javascript/levels/javascript/maps/visitor-signin.json';

  let TiledService;
  let EntityFactory;
  let EntityConfigService;
  let rawObjectsById;

  beforeAll(async () => {
    TiledService = (await import('../../../../js/app/common/tiled')).default;
    EntityFactory = (
      await import('../../../../js/app/components/game/entities/service/EntityFactory')
    ).default;
    EntityConfigService = (
      await import('../../../../js/app/components/game/EntityConfigService')
    ).default;

    await TiledService.registerMapFile(MAP_PATH);

    // Index the raw Tiled objects by id, as DynamicLevel would feed them
    // to EntityFactory.create.
    rawObjectsById = {};
    TiledService.getMapData()
      .layers.filter(layer => layer.type === 'objectgroup')
      .forEach(layer => {
        layer.objects.forEach(rawObject => {
          rawObjectsById[rawObject.id] = rawObject;
        });
      });
  });

  const createFromMap = id => {
    const level = { entityService: { registerEntity: jest.fn() } };
    const factory = new EntityFactory(level);
    return factory.create(rawObjectsById[id]);
  };

  const partiallyToObject = properties => {
    return properties.reduce((object, property) => {
      return { ...object, [property.name]: property.value };
    }, {});
  };

  test('keycard-terminal tileset tiles are registered as typed tile data', () => {
    // gid 12047 (firstgid of TwilioQuestJavaScriptObjects.json in the map) is
    // tile id 2 in the tileset: the keycard-terminal.
    const tileData = TiledService.getTileData(12047);

    expect(tileData.type).toBe('keycard-terminal');
    expect(partiallyToObject(tileData.properties)).toEqual(
      expect.objectContaining({
        accessLevel: 'green',
        targetKey: 'example_key_here',
        interactable: true,
      })
    );
  });

  describe('green keycard terminals', () => {
    test.each([191, 205])(
      'object %i inherits the keycard-terminal type and green default access level, keeping its targetKey',
      id => {
        const instance = createFromMap(id);

        // type is inherited from the tileset's tile data
        expect(instance.obj.type).toBe('keycard-terminal');

        const properties = partiallyToObject(instance.obj.properties);
        // accessLevel comes from the tileset default, targetKey comes from
        // the map-level object and must win the merge.
        expect(properties).toEqual(
          expect.objectContaining({
            accessLevel: 'green',
            targetKey: 'visitor-signin',
          })
        );
      }
    );
  });

  describe('blue keycard terminals', () => {
    test.each([203, 204, 206])(
      'object %i overrides accessLevel to blue and inherits the example_key_here targetKey',
      id => {
        const instance = createFromMap(id);

        expect(instance.obj.type).toBe('keycard-terminal');

        const properties = partiallyToObject(instance.obj.properties);
        expect(properties).toEqual(
          expect.objectContaining({
            accessLevel: 'blue',
            targetKey: 'example_key_here',
            interactable: true,
          })
        );
      }
    );
  });
});

describe('keycard-terminal config interactions', () => {
  const KEYCARD_TERMINAL_CONFIG_PATH = path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    'public',
    'extensions',
    'twilioquest-javascript',
    'objects',
    'keycard-terminal',
    'config.js'
  );
  const WORLD_STATE_KEY =
    require(
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        '..',
        'public',
        'extensions',
        'twilioquest-javascript',
        'scripts',
        'config.js'
      )
    ).WORLD_STATE_KEY;
  const { onPlayerDidInteract } = require(KEYCARD_TERMINAL_CONFIG_PATH).events;

  const createWorld = accessLevels => {
    const world = {
      state: {
        [WORLD_STATE_KEY]: {
          accessLevels,
        },
      },
      getState: jest.fn(key => world.state[key]),
      setState: jest.fn((key, value) => {
        world.state[key] = value;
      }),
      hideEntities: jest.fn(),
      showNotification: jest.fn(),
    };

    return world;
  };

  const createSelf = accessLevel => {
    const self = {
      accessLevel,
      targetKey: 'visitor-signin',
    };
    const event = { target: self };
    return { self, event };
  };

  test('hides the target key entities when the player has the green access level', () => {
    const world = createWorld({
      green: {
        opened: [],
      },
    });
    const { self, event } = createSelf('green');

    onPlayerDidInteract(self, event, world);

    expect(world.hideEntities).toHaveBeenCalledWith('visitor-signin');
    expect(world.showNotification).not.toHaveBeenCalled();

    // the handler must persist new world state under the world state key
    expect(world.setState).toHaveBeenCalledWith(
      WORLD_STATE_KEY,
      expect.anything()
    );
  });

  test('shows the locked notification when the blue access level is missing', () => {
    const world = createWorld({
      green: {
        opened: [],
      },
    });
    const { self, event } = createSelf('blue');

    onPlayerDidInteract(self, event, world);

    expect(world.showNotification).toHaveBeenCalledWith(
      expect.stringContaining("I don't have the requisite access level")
    );
    expect(world.showNotification).toHaveBeenCalledWith(
      expect.stringContaining('blue')
    );
    expect(world.hideEntities).not.toHaveBeenCalled();
  });
});
