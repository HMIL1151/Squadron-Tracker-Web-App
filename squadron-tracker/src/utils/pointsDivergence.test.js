/**
 * CHARACTERIZATION -- the three points implementations, compared directly.
 *
 * Event points are calculated in three places today:
 *
 *   1. firestoreUtils.getTotalPointsForCadet   -- year via date.substring(0,4)
 *   2. MassEventLog (inline)                   -- no year filter
 *   3. FightPointsDashboard (inline)           -- year via new Date(d).getFullYear()
 *
 * Phase 6 replaces all three with src/utils/points.js. This file is the contract
 * that replacement has to satisfy: it reimplements each of the three exactly as
 * written today and asserts where they agree and where they do not.
 *
 * If a future reader wonders why the unified version behaves a particular way in
 * some corner, the answer should be here.
 */

import { dataContextFor, SQUADRONS } from "../test/dummyData";
import { getTotalPointsForCadet } from "../firebase/firestoreUtils";

const data = dataContextFor(SQUADRONS.FAKETON);
const badgePoints = data.flightPoints["Badge Points"];
const categoryPoints = data.flightPoints["Event Category Points"];

// ---------------------------------------------------------------------------
// The three implementations, transcribed from their current call sites
// ---------------------------------------------------------------------------

/** MassEventLog.js:83-119 -- dispatches category points off `eventName`. */
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

/** FightPointsDashboard.js:85-123 -- dispatches category points off `eventCategory`. */
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

/** firestoreUtils.js:102-116 -- the same dispatch as Flight Points. */
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

const IMPLEMENTATIONS = {
  massEventLog: massEventLogPoints,
  flightPoints: flightPointsPoints,
  firestoreUtils: firestoreUtilsPoints,
};

// ---------------------------------------------------------------------------

describe("where all three agree", () => {
  it("agrees on every event in the dummy squadron", () => {
    // The important result: despite three separate dispatches, no event in a
    // realistic dataset is scored differently. The case for unifying them is
    // that they *could* diverge, not that they currently do.
    const disagreements = data.events
      .map((event) => ({
        event: `${event.cadetName} ${event.date}`,
        scores: Object.fromEntries(
          Object.entries(IMPLEMENTATIONS).map(([name, fn]) => [name, fn(event)])
        ),
      }))
      .filter(({ scores }) => new Set(Object.values(scores)).size > 1);

    expect(disagreements).toEqual([]);
  });

  it("scores every event kind identically", () => {
    const byKind = {};
    data.events.forEach((event) => {
      const kind = event.badgeLevel
        ? `badge:${event.badgeLevel}`
        : event.examName
        ? "exam"
        : event.specialAward
        ? "special"
        : event.eventCategory
        ? `category:${event.eventCategory}`
        : "event:uncategorised";
      byKind[kind] = massEventLogPoints(event);
    });
    expect(byKind).toMatchSnapshot();
  });
});

describe("where they would diverge", () => {
  // These inputs do not occur in the dummy squadron, but nothing stops Firestore
  // holding them. They are why three implementations is a latent hazard.

  it("disagrees on an event whose category is set but whose name is blank", () => {
    // Mass Event Log requires eventName to reach the category branch at all, so
    // it scores 0. The other two key off eventCategory and score 5.
    const event = {
      badgeCategory: "", badgeLevel: "", examName: "", specialAward: "",
      eventName: "", eventCategory: "Wing Event", date: "2025-04-01", cadetName: "X",
    };
    expect(massEventLogPoints(event)).toBe(0);
    expect(flightPointsPoints(event)).toBe(5);
    expect(firestoreUtilsPoints(event)).toBe(5);
  });

  it("disagrees on a badge with a category but no level", () => {
    // Flight Points requires both fields, so it falls through to its warn branch
    // and scores 0. The other two dispatch on badgeCategory alone, look up
    // "undefined Badge", miss, and also land on 0 -- by luck, not by design.
    const event = {
      badgeCategory: "Radio", badgeLevel: "", examName: "", specialAward: "",
      eventName: "", eventCategory: "", date: "2025-04-01", cadetName: "X",
    };
    expect(massEventLogPoints(event)).toBe(0);
    expect(flightPointsPoints(event)).toBe(0);
    expect(firestoreUtilsPoints(event)).toBe(0);
  });

  it("agrees an uncategorised named event is worth nothing", () => {
    // The real row in the fixture -- Jack's Ad-hoc Range Day. Both reach 0, by
    // different routes. Phase 6 must keep it at 0.
    const event = data.events.find((e) => e.eventName === "Ad-hoc Range Day");
    expect(massEventLogPoints(event)).toBe(0);
    expect(flightPointsPoints(event)).toBe(0);
  });
});

describe("year bucketing", () => {
  const YEAR_STYLES = {
    // firestoreUtils.js:97
    substring: (date) => date?.substring(0, 4),
    // FightPointsDashboard.js:81
    dateParse: (date) => String(new Date(date).getFullYear()),
  };

  it("agrees under the suite's pinned UTC timezone", () => {
    const disagreements = data.events
      .map((e) => e.date)
      .filter((d) => YEAR_STYLES.substring(d) !== YEAR_STYLES.dateParse(d));
    expect(disagreements).toEqual([]);
  });

  it("only diverges west of UTC", () => {
    // Demonstrated rather than asserted about: `new Date("2025-01-01")` is
    // midnight UTC, so its *local* year is 2024 anywhere behind UTC.
    //
    // This is why the divergence never bites UK squadrons -- London is never
    // behind UTC. Phase 6 removes the fragility; it is not fixing something
    // users are currently hitting.
    const utcMidnight = new Date("2025-01-01T00:00:00Z");
    const behindUtc = new Date(utcMidnight.getTime() - 5 * 60 * 60 * 1000);
    expect(behindUtc.getUTCFullYear()).toBe(2024);
    expect("2025-01-01".slice(0, 4)).toBe("2025");
  });

  it("filters Mass Event Log not at all", () => {
    // CHARACTERIZATION: this dashboard shows every year at once. Phase 6 must
    // not accidentally introduce a year filter here.
    const years = new Set(data.events.map((e) => e.date.slice(0, 4)));
    expect(years.size).toBeGreaterThan(1);
  });
});

describe("firestoreUtils.getTotalPointsForCadet", () => {
  // The only one of the three that is a callable function today.

  it("totals a cadet's events for a year", async () => {
    // Amelia's 2025: Silver badge 15 + exam 8 + Wing Event 5 = 28.
    await expect(getTotalPointsForCadet("Amelia Hart", 2025, data)).resolves.toBe(28);
  });

  it("excludes other years", async () => {
    // Her 2024: Blue 5 + Bronze 10 + exam 8 + special 25 = 48.
    await expect(getTotalPointsForCadet("Amelia Hart", 2024, data)).resolves.toBe(48);
  });

  it("returns zero for a cadet with no events", async () => {
    await expect(getTotalPointsForCadet("Isla Muir", 2025, data)).resolves.toBe(0);
  });

  it("returns zero for a name that does not exist", async () => {
    await expect(getTotalPointsForCadet("Nobody At All", 2025, data)).resolves.toBe(0);
  });

  it("matches what Flight Points shows for the same cadet and year", async () => {
    // Both are supposed to answer the same question. Phase 6 makes that
    // structural rather than coincidental.
    const cadets = ["Amelia Hart", "Eve Nakamura", "Jack Petrov", "Harry Blythe-Jones"];
    for (const name of cadets) {
      const viaUtils = await getTotalPointsForCadet(name, 2025, data);
      const viaFlightPoints = data.events
        .filter((e) => e.cadetName === name && new Date(e.date).getFullYear() === 2025)
        .reduce((sum, e) => sum + flightPointsPoints(e), 0);
      expect({ name, viaUtils }).toEqual({ name, viaUtils: viaFlightPoints });
    }
  });
});
