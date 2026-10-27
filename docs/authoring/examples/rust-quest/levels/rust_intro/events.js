'use strict';
// Does nothing, on purpose. A level with no events.js still loads, but the game
// logs "Error loading event hander" and keeps the previous level's handler.
// An empty handler avoids both.
module.exports = function (event, world) {};
