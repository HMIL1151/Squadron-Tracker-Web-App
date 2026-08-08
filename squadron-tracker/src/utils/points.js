/**
 * What an event is worth, and what it is called.
 *
 * Single authority, replacing three separate implementations that lived inline
 * in firestoreUtils, MassEventLog and FlightPointsDashboard. They agreed on every
 * event in a realistic dataset, but each dispatched slightly differently, so
 * they could drift apart at any time -- and any new dashboard would have made a
 * fourth copy.
 *
 * Two deliberate decisions, both recorded in pointsDivergence.test.js:
 *
 *   Category points dispatch on `eventCategory`, not `eventName`.
 *     MassEventLog used to require a non-empty eventName before it would even
 *     look at the category, so an event carrying a category but no name scored
 *     0 there and 5 everywhere else. What an event is worth follows from its
 *     category; whether someone typed a description is irrelevant.
 *
 *   Years compare as strings, via date.slice(0, 4).
 *     Dates are stored as "YYYY-MM-DD". `new Date("2025-01-01").getFullYear()`
 *     reads the *local* year of a UTC-midnight instant, which is 2024 anywhere
 *     west of UTC -- so FlightPointsDashboard bucketed 1 January events into the
 *     previous year for those users. Never wrong for UK squadrons (London is
 *     never behind UTC), but fragile for no benefit.
 */

/** The year an event belongs to, as a string. Timezone-proof. */
export const getEventYear = (event) => event?.date?.slice(0, 4);

/**
 * Points for a single event.
 *
 * @param event         an EventLog document
 * @param flightPoints  DataContext's flightPoints map (keyed by document name)
 * @returns integer, 0 when nothing matches
 */
export const getEventPoints = (event, flightPoints) => {
  if (!event || !flightPoints) return 0;

  const badgePoints = flightPoints["Badge Points"] || {};
  const categoryPoints = flightPoints["Event Category Points"] || {};

  const toInt = (value) => parseInt(value, 10) || 0;

  if (event.badgeLevel && event.badgeCategory) {
    return toInt(badgePoints[`${event.badgeLevel} Badge`]);
  }
  if (event.examName) {
    return toInt(badgePoints.Exam);
  }
  if (event.eventCategory) {
    return toInt(categoryPoints[event.eventCategory]);
  }
  if (event.specialAward) {
    return toInt(badgePoints.Special);
  }

  // An event with a name but no category reaches here and scores nothing --
  // there is no price to look up. Matches the previous behaviour of all three
  // implementations, which each arrived at 0 by a different route.
  return 0;
};

/** How an event reads in a table or on a certificate. */
export const getEventDescription = (event) => {
  if (!event) return "";
  if (event.badgeLevel && event.badgeCategory) {
    return `${event.badgeLevel} ${event.badgeCategory}`;
  }
  if (event.examName) return event.examName;
  if (event.eventName) return event.eventName;
  if (event.specialAward) return event.specialAward;
  return "";
};

/**
 * A cadet's total for one year.
 *
 * @param year  number or string; compared as a string
 */
export const getCadetPoints = (cadetName, year, events = [], flightPoints = {}) =>
  events
    .filter((event) => event.cadetName === cadetName && getEventYear(event) === String(year))
    .reduce((total, event) => total + getEventPoints(event, flightPoints), 0);

/**
 * Per-flight totals for one year, keyed by the cadet's 1-based flight index.
 * Every flight a cadet belongs to appears, including those scoring zero.
 */
export const getFlightPointTotals = (year, cadets = [], events = [], flightPoints = {}) => {
  const totals = {};
  cadets.forEach((cadet) => {
    const flight = cadet.flight;
    if (flight === undefined || flight === null || flight === "") return;
    const earned = getCadetPoints(
      `${cadet.forename} ${cadet.surname}`,
      year,
      events,
      flightPoints
    );
    totals[flight] = (totals[flight] || 0) + earned;
  });
  return totals;
};
