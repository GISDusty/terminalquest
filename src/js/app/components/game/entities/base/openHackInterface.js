import { getContext, setContext } from '../../../../common/context';

/**
 * Open the hack interface for a map object that has an `objectiveName`.
 * Shared by the hackable barrier and chest; mirrors TileObject's hackable
 * branch.
 *
 * @param {MapObject} object - object with `level` and `objectiveName`
 */
export default function openHackInterface(object) {
  if (!object.objectiveName) {
    console.error(
      'Object is hackable but did not have an objectiveName listed',
      object
    );
    return;
  }

  // Get objective completion status before updating context
  const objectiveKey = `${object.level.levelName}.${object.objectiveName}`;
  if (getContext('completedObjectives')[objectiveKey]) {
    object.complete = true;
  }

  setContext({ hackObject: object });
}
