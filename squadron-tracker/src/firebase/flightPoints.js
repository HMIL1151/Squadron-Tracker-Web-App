/**
 * The FlightPoints collection: the price list every dashboard scores against,
 * plus TeamPoints, the bonus points an admin allocates directly to a flight.
 *
 * Five documents, each a different shape:
 *   "Badge Points"           { "Blue Badge": 5, ..., Exam: 8, Special: 25 }
 *   "Event Category Points"  { "Parade Night": 1, ... }
 *   "Badges"                 { "Badge Types": [...] }
 *   "Special Awards"         { "Special Awards": [...] }
 *   "TeamPoints"             { "1": 0, "2": 40, ..., LastLoginDate }
 */

import { arrayUnion, deleteField, getDoc, squadronDoc, updateDoc } from "./db";

const COLLECTION = "FlightPoints";

export const DOCS = {
  badgePoints: "Badge Points",
  categoryPoints: "Event Category Points",
  badges: "Badges",
  specialAwards: "Special Awards",
  teamPoints: "TeamPoints",
};

const ref = (squadronNumber, docName) => squadronDoc(squadronNumber, COLLECTION, docName);

/** Set a price, e.g. a new event category or badge level. */
export const setPrice = async (squadronNumber, docName, key, points) => {
  await updateDoc(ref(squadronNumber, docName), { [key]: parseInt(points, 10) });
};

/** Remove a price entirely rather than leaving it undefined. */
export const removePrice = async (squadronNumber, docName, key) => {
  await updateDoc(ref(squadronNumber, docName), { [key]: deleteField() });
};

/** Append to one of the list documents (badge types, special awards). */
export const addToList = async (squadronNumber, docName, arrayName, value) => {
  await updateDoc(ref(squadronNumber, docName), { [arrayName]: arrayUnion(value) });
};

/** Replace one of the list documents wholesale, e.g. after a removal. */
export const setList = async (squadronNumber, docName, arrayName, values) => {
  await updateDoc(ref(squadronNumber, docName), { [arrayName]: values });
};

export const fetchDoc = async (squadronNumber, docName) => {
  const snapshot = await getDoc(ref(squadronNumber, docName));
  return snapshot.exists() ? snapshot.data() : null;
};

/**
 * Directly-allocated flight points for the current year.
 *
 * Zeroes everything when LastLoginDate is not the current year: allocations
 * are a per-year competition and should not carry over. Handles both a
 * Firestore Timestamp and the legacy string form the field has been seen in.
 */
/**
 * The year a TeamPoints document was last stamped.
 *
 * Shared by the read and the write so the two cannot disagree about when a year
 * has rolled over. They did disagree, and allocations vanished as a result.
 * Handles a Firestore Timestamp, a plain Date, and the legacy string form the
 * field has been seen in.
 */
const teamPointsYear = (LastLoginDate) => {
  if (LastLoginDate && typeof LastLoginDate.toDate === "function") {
    return LastLoginDate.toDate().getFullYear();
  }
  if (Object.prototype.toString.call(LastLoginDate) === "[object Date]") {
    return LastLoginDate.getFullYear();
  }
  if (typeof LastLoginDate === "string") {
    const match = LastLoginDate.match(/\b(\d{4})\b/);
    if (match) return parseInt(match[1], 10);
  }
  return undefined;
};

export const fetchTeamPoints = async (squadronNumber) => {
  try {
    const data = await fetchDoc(squadronNumber, DOCS.teamPoints);
    if (!data) return {};

    const { LastLoginDate, ...points } = data;

    if (teamPointsYear(LastLoginDate) !== new Date().getFullYear()) {
      return Object.fromEntries(Object.keys(points).map((key) => [key, 0]));
    }
    return points;
  } catch (error) {
    console.error(`Error fetching TeamPoints for squadron ${squadronNumber}:`, error);
    return {};
  }
};

/** Add points to one flight's running total. Returns the new total. */
export const addPointsToFlight = async (squadronNumber, flightNumber, pointsToAdd) => {
  const teamPointsRef = ref(squadronNumber, DOCS.teamPoints);
  const snapshot = await getDoc(teamPointsRef);
  if (!snapshot.exists()) {
    throw new Error("TeamPoints document does not exist for this squadron.");
  }

  const { LastLoginDate, ...points } = snapshot.data();

  /*
   * Roll the year over here, on write, rather than only on read.
   *
   * fetchTeamPoints zeroes every flight when LastLoginDate is not the current
   * year, because allocations are a per-year competition. But this function
   * used to add to the stored value and never touch LastLoginDate -- so on any
   * squadron whose document still carried last year's date, an allocation was
   * written, then discarded by the very next read, every time. The points
   * appeared to vanish and nothing reported an error, because nothing had
   * failed. Faketon showed it plainly: allocate 25 to Alpha, watch the chart
   * stay at zero.
   *
   * Adding to a stale value would also be wrong in the other direction --
   * last year's 40 plus this year's 25 is not 65, it is 25.
   */
  const stale = teamPointsYear(LastLoginDate) !== new Date().getFullYear();
  const current = stale ? 0 : Number(points[flightNumber] || 0);
  const updated = current + Number(pointsToAdd);

  // On a rollover the reset is persisted for every flight, so the document
  // stops needing to be reinterpreted on each read.
  const reset = stale
    ? Object.fromEntries(Object.keys(points).map((key) => [key, 0]))
    : {};

  await updateDoc(teamPointsRef, {
    ...reset,
    [flightNumber]: updated,
    LastLoginDate: new Date(),
  });
  return updated;
};
