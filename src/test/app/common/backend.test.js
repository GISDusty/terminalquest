import config from '../../../js/app/config/config';
import {
  isBackendEnabled,
  BACKEND_UNAVAILABLE_MESSAGE,
} from '../../../js/app/common/backend';
import { joinTeam } from '../../../js/app/common/teams';
import { joinOperation } from '../../../js/app/common/operations';

describe('backend gate', () => {
  const originalFlag = config.backendEnabled;
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = jest.fn();
    window.fetch = fetchSpy;
  });

  afterEach(() => {
    config.backendEnabled = originalFlag;
  });

  test('backend is disabled by default', () => {
    expect(config.backendEnabled).toBe(false);
    expect(isBackendEnabled()).toBe(false);
  });

  test('flag enables the backend', () => {
    config.backendEnabled = true;
    expect(isBackendEnabled()).toBe(true);
  });

  test('joinTeam and joinOperation fail with a message and make no request', async () => {
    const team = await joinTeam('abc');
    const operation = await joinOperation('abc');

    expect(team).toEqual({
      success: false,
      message: BACKEND_UNAVAILABLE_MESSAGE,
    });
    expect(operation).toEqual({
      success: false,
      message: BACKEND_UNAVAILABLE_MESSAGE,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
