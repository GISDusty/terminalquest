// events.js reacts to things that happen while the player is in this level.
// The game calls this function for every event (levelDidLoad, mapDidLoad,
// playerDidInteract, objectiveCompleted, ...). The return value is ignored.
// Event list and world API: docs/authoring/mission.md
module.exports = function(event, world) {
  if (event.name === 'levelDidLoad') {
    world.showNotification('Welcome to this mission. Find the terminal.');
  }

  if (event.name === 'objectiveCompleted') {
    world.showNotification(`Objective complete: ${event.objective}`);
  }
};
