/**
 * Reading a whole squadron out, for backup.
 *
 * Deliberately excluded: AuthorisedUsers and UserRequests (the squadron's own
 * subcollections), and the top-level MassUserList, SystemAdmins and
 * NewAccountRequests. Those hold web-app accounts -- emails, uids, roles and
 * access decisions -- which are not squadron records and have no place in a
 * file an admin will email around or drop in a shared drive. A restore
 * recreates access through the normal request flow instead.
 *
 * Reads are fresh rather than taken from DataContext, which holds whatever was
 * loaded at login. A backup should be the data as it stands when the button is
 * pressed, not as it stood that morning.
 *
 * Nothing here writes.
 */

import { getDocs, squadronCollection } from "./db";
import { fetchSquadronDoc } from "./squadron";

/** Every document in a collection, as `{ id, ...fields }`. */
const readAll = async (collectionRef) => {
  const snapshot = await getDocs(collectionRef);
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
};

/** Exported for the offline/dev path and tests; ordinary callers want fetchSquadronBackup. */
export const readSquadronCollection = (squadronNumber, name) =>
  readAll(squadronCollection(squadronNumber, name));

/**
 * Everything a backup contains.
 *
 * @returns { cadets, events, flightPoints, squadron }
 *          squadron is the SquadronList entry, or null if there isn't one.
 *
 * The four reads are independent, so they run together -- a squadron with a
 * few thousand event rows is one round trip's wait rather than four.
 *
 * fetchSquadronDoc returns null rather than throwing when the directory entry
 * is missing, and that is left as-is: the squadron's own records are the point
 * of the backup, and they are all still here.
 */
export const fetchSquadronBackup = async (squadronNumber) => {
  const [cadets, events, flightPoints, squadron] = await Promise.all([
    readSquadronCollection(squadronNumber, "Cadets"),
    readSquadronCollection(squadronNumber, "EventLog"),
    readSquadronCollection(squadronNumber, "FlightPoints"),
    fetchSquadronDoc(squadronNumber),
  ]);

  return { cadets, events, flightPoints, squadron };
};
