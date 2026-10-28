import { getAppMeta } from './electronBridge';

// Analytics are disabled: Universal Analytics was shut down in 2023, so no hits
// are sent anywhere. The module keeps its original API so callers
// (ContextProvider, gameEvents, etc.) continue to work unchanged.
const analytics = {
  initializeAnalytics,
  appVersion: undefined,
  analyticsId: undefined,
  visitor: undefined,
  pageview,
  event,
};

function initializeAnalytics(state) {
  const {
    user: { guid },
  } = state;

  // Get app version - will be electron version in dev, actual app version in prod
  analytics.appVersion = getAppMeta().version;
  analytics.analyticsId = guid;
}

// No-op: retained so existing callers do not need to change.
function pageview(path, title, options = {}) {}

// No-op: retained so existing callers do not need to change.
function event(category, action, label, value, pageTitle, pagePath) {}

export default analytics;
