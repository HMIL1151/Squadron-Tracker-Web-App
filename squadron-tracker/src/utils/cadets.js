/**
 * Cadet-shaped views over the data already in DataContext.
 *
 * These are pure functions, not database calls. They lived in
 * firebase/firestoreUtils.js purely by accident of history -- nothing here
 * touches Firestore, and keeping them there meant components importing from
 * the data layer to do string formatting.
 */

import { rankMap } from "./mappings";
import { getEventDescription } from "./points";

/**
 * A cadet's achievements, formatted for a certificate.
 *
 * Events with none of the describing fields set are dropped rather than
 * printed as a blank line.
 */
export const getEventsForCadet = (cadetName, data) => {
  const events = data?.events || [];
  return events
    .filter((event) => event.cadetName === cadetName)
    .map((event) => ({ event: getEventDescription(event), date: event.date }))
    .filter(({ event }) => event !== "");
};

/** A cadet's rank as a name rather than the stored integer. */
export const getCadetRank = (cadetName, data) => {
  const cadet = (data?.cadets || []).find(
    (c) => `${c.forename} ${c.surname}` === cadetName
  );
  if (!cadet) {
    console.warn(`Cadet ${cadetName} not found in DataContext.`);
    return "Cadet Not Found";
  }
  return rankMap[cadet.rank] || "Unknown Rank";
};
