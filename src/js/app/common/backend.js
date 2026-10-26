import config from '../config/config';

export const BACKEND_UNAVAILABLE_MESSAGE =
  'Online features are not available in this version.';

/**
 * The TwilioQuest backend (cloud sync, unlock codes, teams, live events) is
 * no longer maintained. Every feature that talks to it must check this first
 * and skip its network request when it returns false.
 *
 * @returns {boolean}
 */
export function isBackendEnabled() {
  return config.backendEnabled === true;
}
