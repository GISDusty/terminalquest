// The 2021 Earth Day tree hunt used to be wired up here
// (public/levels/common/events/trees.js). That promotion is over, and the
// helper POSTs progress to a Twilio backend that no longer exists, so this
// level no longer calls it. The helper file is left in place, unused.
//
// The reward chest on the `terminal` map has no `objectiveName`, so pressing
// space on it only emits `playerDidInteract`. It opens once the four terminal
// barrier objectives are complete, grants a one-time XP reward, and remembers
// that in level state so it stays open after a reload.
const LEVEL = 'dev_skills';
const REQUIRED_OBJECTIVES = [
  'terminal_pwd',
  'terminal_safety',
  'terminal_cd',
  'terminal_script',
];
const CHEST_KEY = 'reward_chest';
const OPENED_STATE_KEY = `${LEVEL}.rewardChestOpened`;
const REWARD_XP = 100;

function allBarriersDone(world) {
  const completed = world.getContext('completedObjectives');
  return REQUIRED_OBJECTIVES.every(name => completed[`${LEVEL}.${name}`]);
}

module.exports = function(event, world) {
  // Re-open the chest when the player comes back to the terminal map.
  if (event.name === 'mapDidLoad' && event.mapName === 'terminal') {
    if (world.getState(OPENED_STATE_KEY)) {
      world.forEachEntities(CHEST_KEY, chest => chest.markAsComplete());
    }
    return;
  }

  if (
    event.name === 'playerDidInteract' &&
    event.target &&
    event.target.key === CHEST_KEY
  ) {
    const chest = event.target;

    if (world.getState(OPENED_STATE_KEY)) {
      world.showNotification('The chest is empty. You already took the reward.');
      return;
    }

    if (!allBarriersDone(world)) {
      world.showNotification(
        'Locked. Complete the four terminal challenges first.'
      );
      return;
    }

    chest.markAsComplete();
    world.setState(OPENED_STATE_KEY, true);
    world.setContext({ xp: world.getContext('xp') + REWARD_XP });
    world.showNotification(`The chest opens. You earned ${REWARD_XP} XP!`);
  }
};
