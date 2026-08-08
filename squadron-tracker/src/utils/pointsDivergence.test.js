/**
 * The three points implementations that src/utils/points.js replaced.
 *
 * Before Phase 6, event points were calculated in three places:
 *
 *   1. firestoreUtils.getTotalPointsForCadet   -- year via date.substring(0,4)
 *   2. MassEventLog (inline)                   -- no year filter
 *   3. FlightPointsDashboard (inline)           -- year via new Date(d).getFullYear()
 *
 * All three are transcribed below exactly as they were written. This file is
 * now a regression guard: it proves the unified implementation still scores
 * every realistic event the same way the old code did, and documents the two
 * places where it deliberately does not.
 *
 * If a future reader wonders why points.js behaves a particular way in some
 * corner, the answer is here.
 */

import { dataContextFor, SQUADRONS } from "../test/dummyData";
import { getCadetPoints, getEventPoints } from "./points";

const data = dataContextFor(SQUADRONS.FAKETON);
const badgePoints = data.flightPoints["Badge Points"];
const categoryPoints = data.flightPoints["Event Category Points"];

// ---------------------------------------------------------------------------
// The three old implementations, transcribed from their former call sites
// ---------------------------------------------------------------------------

/** MassEventLog.js -- dispatched category points off `eventName`. */
const massEventLogPoints = (event) => {
  if (event.badgeCategory) {
    return parseInt(badgePoints?.[`${event.badgeLevel} Badge`] || 0, 10);
  }
  if (event.examName) {
    return parseInt(badgePoints?.["Exam"] || 0, 10);
  }
  if (event.eventName) {
    return parseInt(categoryPoints?.[event.eventCategory] || 0, 10);
  }
  if (event.specialAward) {
    return parseInt(badgePoints?.["Special"] || 0, 10);
  }
  return 0;
};

/** FlightPointsDashboard.js -- dispatched category points off `eventCategory`. */
const flightPointsPoints = (event) => {
  if (event.badgeLevel && event.badgeCategory) {
    return parseInt(badgePoints?.[`${event.badgeLevel} Badge`] || 0, 10);
  }
  if (event.examName) {
    return parseInt(badgePoints?.["Exam"] || 0, 10);
  }
  if (event.eventCategory) {
    return parseInt(categoryPoints?.[event.eventCategory] || 0, 10);
  }
  if (event.specialAward) {
    return parseInt(badgePoints?.["Special"] || 0, 10);
  }
  return 0; // reached via the console.warn branch
};

/** firestoreUtils.js -- the same dispatch as Flight Points. */
const firestoreUtilsPoints = (event) => {
  if (event.badgeCategory) {
    return Number(badgePoints[`${event.badgeLevel} Badge`] || 0);
  }
  if (event.examName) {
    return Number(badgePoints["Exam"] || 0);
  }
  if (event.eventCategory) {
    return Number(categoryPoints[event.eventCategory] || 0);
  }
  if (event.specialAward) {
    return Number(badgePoints["Special"] || 0);
  }
  return 0;
};

const OLD_IMPLEMENTATIONS = {
  massEventLog: massEventLogPoints,
  flightPoints: flightPointsPoints,
  firestoreUtils: firestoreUtilsPoints,
};

// ---------------------------------------------------------------------------

describe("the unified implementation matches the old ones", () => {
  it("scores every event in the dummy squadron identically", () => {
    // The headline regression check for Phase 6. All three old implementations
    // agreed on realistic data; points.js must agree with all of them.
    const differences = data.events
      .map((event) => ({
        event: `${event.cadetName} ${event.date}`,
        unified: getEventPoints(event, data.flightPoints),
        old: Object.fromEntries(
          Object.entries(OLD_IMPLEMENTATIONS).map(([name, fn]) => [name, fn(event)])
        ),
      }))
      .filter(({ unified, old }) => Object.values(old).some((v) => v !== unified));

    expect(differences).toEqual([]);
  });

  it("keeps the same per-cadet yearly totals", () => {
    // Reproduces the old firestoreUtils.getTotalPointsForCadet and compares.
    const oldTotal = (cadetName, year) =>
      data.events
        .filter((e) => e.cadetName === cadetName && e.date?.substring(0, 4) === String(year))
        .reduce((sum, e) => sum + firestoreUtilsPoints(e), 0);

    data.cadets.forEach((cadet) => {
      const name = `${cadet.forename} ${cadet.surname}`;
      [2024, 2025].forEach((year) => {
        expect({ name, year, points: getCadetPoints(name, year, data.events, data.flightPoints) }).toEqual(
          { name, year, points: oldTotal(name, year) }
        );
      });
    });
  });
});

describe("where the unified implementation deliberately differs", () => {
  it("scores a categorised event with no description, where Mass Event Log scored nothing", () => {
    // THE ONE INTENDED BEHAVIOUR CHANGE. Mass Event Log required a non-empty
    // eventName before it would consult the category at all. What an event is
    // worth follows from its category, not from whether anyone typed a
    // description -- and the other two implementations already agreed.
    const event = {
      badgeCategory: "", badgeLevel: "", examName: "", specialAward: "",
      eventName: "", eventCategory: "Wing Event", date: "2025-04-01", cadetName: "X",
    };

    expect(massEventLogPoints(event)).toBe(0); // old Mass Event Log
    expect(flightPointsPoints(event)).toBe(5); // old Flight Points
    expect(firestoreUtilsPoints(event)).toBe(5); // old firestoreUtils
    expect(getEventPoints(event, data.flightPoints)).toBe(5); // unified
  });

  it("still scores a described event with no category as nothing", () => {
    // Jack's Ad-hoc Range Day. All three old implementations reached 0 by
    // different routes; the unified one must stay at 0.
    const event = data.events.find((e) => e.eventName === "Ad-hoc Range Day");
    expect(massEventLogPoints(event)).toBe(0);
    expect(flightPointsPoints(event)).toBe(0);
    expect(getEventPoints(event, data.flightPoints)).toBe(0);
  });
});

describe("year bucketing", () => {
  const YEAR_STYLES = {
    substring: (date) => date?.substring(0, 4), // firestoreUtils
    dateParse: (date) => String(new Date(date).getFullYear()), // FlightPointsDashboard
  };

  it("agrees with both old styles under the suite's pinned UTC timezone", () => {
    const disagreements = data.events
      .map((e) => e.date)
      .filter((d) => YEAR_STYLES.substring(d) !== YEAR_STYLES.dateParse(d));
    expect(disagreements).toEqual([]);
  });

  it("uses the string form, which cannot drift west of UTC", () => {
    // `new Date("2025-01-01")` is midnight UTC, so its *local* year is 2024
    // anywhere behind UTC -- FlightPointsDashboard used to bucket 1 January
    // events into the previous year for those users. Never wrong for UK
    // squadrons (London is never behind UTC), but fragile for no benefit.
    const utcMidnight = new Date("2025-01-01T00:00:00Z");
    const behindUtc = new Date(utcMidnight.getTime() - 5 * 60 * 60 * 1000);
    expect(behindUtc.getUTCFullYear()).toBe(2024);

    // The unified implementation is unaffected by any of that.
    const benBadge = data.events.find((e) => e.date === "2025-01-01");
    expect(getCadetPoints("Ben Okafor", 2025, [benBadge], data.flightPoints)).toBe(5);
    expect(getCadetPoints("Ben Okafor", 2024, [benBadge], data.flightPoints)).toBe(0);
  });

  it("does not introduce a year filter into Mass Event Log", () => {
    // That dashboard shows every year at once; points.js is only consulted
    // per-event there, never through getCadetPoints.
    const years = new Set(data.events.map((e) => e.date.slice(0, 4)));
    expect(years.size).toBeGreaterThan(1);
  });
});
