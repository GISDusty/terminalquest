// Duplicate this file and rename the copy to local_config.js to specify
// git-ignored local configuration options. Only loaded in dev. Keys here
// override the defaults in config.js.

const config = {
  drawDebug: false, // show debug rendering info for Phaser

  // Where a new game starts. Until the prologue mission (owls_nest) is
  // completed, the *Prologue variants below win over the plain keys.
  // defaultLevelName: 'fog_owl',
  // defaultPlayerEntry: 'player_entry1',
  // defaultMapName: 'default',
  // defaultLevelNamePrologue: 'owls_nest',
  // defaultPlayerEntryPrologue: 'player_entry1',
  // defaultMapNamePrologue: 'default',

  // backendEnabled: false, // talk to the (unmaintained) TwilioQuest backend
  // enableSpector: false, // load Spector.js from a CDN (dev only)

  // The original Twilio backend is offline, so there is no need to set this.
  // apiBaseUrl: 'https://twilioquest-dev.firebaseapp.com/quest/',
};

module.exports = config;
