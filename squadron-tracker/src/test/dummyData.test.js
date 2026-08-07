/**
 * Integrity checks on the dummy squadrons.
 *
 * The fixture is about to become the input to every other test, so a typo in it
 * would show up later as a confusing failure in unrelated code. These assertions
 * keep it honest: referential integrity, valid shapes, and -- just as important
 * -- that it still contains the specific edge cases later phases depend on.
 */

import { examList, badgeLevel as BADGE_LEVELS } from "../utils/examList";
import { rankMap } from "../utils/mappings";
import {
  FAKETON_FLIGHTS,
  FROZEN_NOW,
  SQUADRONS,
  STALE_TEAM_POINTS,
  TESTWOOD_FLIGHTS,
  UIDS,
  dataContextFor,
  dummyData,
  userFor,
} from "./dummyData";
import { __seed, __reset, collection, doc, getDoc, getDocs, getFirestore } from "./fakeFirestore";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const flightNameOf = (f) => (typeof f === "string" ? f : f.name);

const squadrons = [
  { number: SQUADRONS.FAKETON, flights: FAKETON_FLIGHTS },
  { number: SQUADRONS.TESTWOOD, flights: TESTWOOD_FLIGHTS },
];

describe("document paths", () => {
  it("are all valid Firestore document paths", () => {
    // Even segment count. A stray path here would blow up the fake at seed time.
    const odd = Object.keys(dummyData).filter((p) => p.split("/").length % 2 !== 0);
    expect(odd).toEqual([]);
  });

  it("load into the fake without error", () => {
    expect(() => __seed(dummyData)).not.toThrow();
    __reset();
  });
});

describe.each(squadrons)("squadron $number", ({ number, flights }) => {
  const data = dataContextFor(number);
  const cadetNames = data.cadets.map((c) => `${c.forename} ${c.surname}`);

  it("has cadets and events", () => {
    expect(data.cadets.length).toBeGreaterThan(0);
    expect(data.events.length).toBeGreaterThan(0);
  });

  it("gives every event a cadet that exists", () => {
    const orphans = data.events.filter((e) => !cadetNames.includes(e.cadetName));
    expect(orphans.map((e) => e.cadetName)).toEqual([]);
  });

  it("keeps every cadet's flight index inside the flights array", () => {
    // `flight` is a 1-based index into flights. Out of range would render as a
    // bare number instead of a name.
    const bad = data.cadets.filter((c) => c.flight < 1 || c.flight > flights.length);
    expect(bad.map((c) => `${c.forename} ${c.surname}: flight ${c.flight}`)).toEqual([]);
  });

  it("gives every cadet a rank that exists in rankMap", () => {
    const bad = data.cadets.filter((c) => !rankMap[c.rank]);
    expect(bad.map((c) => c.surname)).toEqual([]);
  });

  it("formats every date as YYYY-MM-DD", () => {
    const bad = [
      ...data.cadets.map((c) => c.startDate),
      ...data.events.map((e) => e.date),
    ].filter((d) => !ISO_DATE.test(d));
    expect(bad).toEqual([]);
  });

  it("keeps every date at or before the frozen clock", () => {
    // A future date would make service lengths negative and drift as the real
    // date advances -- exactly what freezing the clock is meant to prevent.
    const cutoff = FROZEN_NOW.toISOString().slice(0, 10);
    const future = [
      ...data.cadets.map((c) => c.startDate),
      ...data.events.map((e) => e.date),
    ].filter((d) => d > cutoff);
    expect(future).toEqual([]);
  });

  it("gives every event exactly one kind", () => {
    // The points and description branches dispatch on which field is truthy, so
    // an event with two kinds set would score ambiguously.
    const kindsOf = (e) =>
      [
        e.badgeCategory || e.badgeLevel ? "badge" : null,
        e.examName ? "exam" : null,
        e.eventName ? "event" : null,
        e.specialAward ? "special" : null,
      ].filter(Boolean);

    const bad = data.events.filter((e) => kindsOf(e).length !== 1);
    expect(bad.map((e) => `${e.cadetName} ${e.date}: ${kindsOf(e).join("+") || "none"}`)).toEqual([]);
  });

  it("gives every badge event both a level and a category", () => {
    const bad = data.events.filter((e) => Boolean(e.badgeLevel) !== Boolean(e.badgeCategory));
    expect(bad.map((e) => `${e.cadetName} ${e.date}`)).toEqual([]);
  });

  it("uses only known badge levels and categories", () => {
    const types = data.flightPoints.Badges["Badge Types"];
    const badges = data.events.filter((e) => e.badgeLevel);
    expect(badges.filter((e) => !BADGE_LEVELS.includes(e.badgeLevel))).toEqual([]);
    expect(badges.filter((e) => !types.includes(e.badgeCategory))).toEqual([]);
  });

  it("prices every badge level it uses", () => {
    const points = data.flightPoints["Badge Points"];
    const missing = data.events
      .filter((e) => e.badgeLevel)
      .filter((e) => points[`${e.badgeLevel} Badge`] === undefined);
    expect(missing.map((e) => e.badgeLevel)).toEqual([]);
  });

  it("uses only exams from examList", () => {
    const bad = data.events.filter((e) => e.examName && !examList.includes(e.examName));
    expect(bad.map((e) => e.examName)).toEqual([]);
  });

  it("uses only known event categories", () => {
    const known = Object.keys(data.flightPoints["Event Category Points"]);
    const bad = data.events.filter((e) => e.eventCategory && !known.includes(e.eventCategory));
    expect(bad.map((e) => e.eventCategory)).toEqual([]);
  });

  it("uses only known special awards", () => {
    const known = data.flightPoints["Special Awards"]["Special Awards"];
    const bad = data.events.filter((e) => e.specialAward && !known.includes(e.specialAward));
    expect(bad.map((e) => e.specialAward)).toEqual([]);
  });

  it("has all five FlightPoints documents", () => {
    expect(Object.keys(data.flightPoints).sort()).toEqual([
      "Badge Points",
      "Badges",
      "Event Category Points",
      "Special Awards",
      "TeamPoints",
    ]);
  });

  it("keys TeamPoints by flight index, within range", () => {
    const keys = Object.keys(data.flightPoints.TeamPoints).filter((k) => k !== "LastLoginDate");
    expect(keys.length).toBeGreaterThan(0);
    keys.forEach((k) => {
      expect(Number(k)).toBeGreaterThanOrEqual(1);
      expect(Number(k)).toBeLessThanOrEqual(flights.length);
    });
  });

  it("has a TeamPoints login date in the frozen clock's year", () => {
    // fetchTeamPoints zeroes everything when the year does not match, so the
    // default fixture has to be current or every flight total reads zero.
    const { LastLoginDate } = data.flightPoints.TeamPoints;
    expect(LastLoginDate.toDate().getFullYear()).toBe(FROZEN_NOW.getFullYear());
  });
});

describe("edge cases later phases rely on", () => {
  const faketon = dataContextFor(SQUADRONS.FAKETON);

  it("has the 2025-01-01 boundary event", () => {
    // `new Date("2025-01-01").getFullYear()` is 2024 west of UTC while
    // `"2025-01-01".slice(0,4)` is 2025. This row is what makes the three points
    // implementations disagree, and what proves Phase 6 fixed it.
    const boundary = faketon.events.filter((e) => e.date === "2025-01-01");
    expect(boundary).toHaveLength(1);
    expect(boundary[0].cadetName).toBe("Ben Okafor");
  });

  it("has an event with a name but no category", () => {
    // MassEventLog keys category points off eventName, FightPointsDashboard off
    // eventCategory. This row scores differently in the two dashboards today.
    const uncategorised = faketon.events.filter((e) => e.eventName && !e.eventCategory);
    expect(uncategorised).toHaveLength(1);
    expect(uncategorised[0].eventName).toBe("Ad-hoc Range Day");
  });

  it("has a cadet with no events at all", () => {
    const names = new Set(faketon.events.map((e) => e.cadetName));
    const eventless = faketon.cadets.filter((c) => !names.has(`${c.forename} ${c.surname}`));
    expect(eventless.map((c) => c.surname)).toEqual(["Muir"]);
  });

  it("covers all four badge levels", () => {
    const used = new Set(faketon.events.filter((e) => e.badgeLevel).map((e) => e.badgeLevel));
    expect([...used].sort()).toEqual([...BADGE_LEVELS].sort());
  });

  it("spans more than one year, so year filtering is exercised", () => {
    const years = new Set(faketon.events.map((e) => e.date.slice(0, 4)));
    expect([...years].sort()).toEqual(["2024", "2025"]);
  });

  it("has a cadet in the archived flight and one in the non-competing flight", () => {
    const archivedIndex = FAKETON_FLIGHTS.findIndex((f) => f.archived) + 1;
    const staffIndex = FAKETON_FLIGHTS.findIndex((f) => !f.competing) + 1;
    expect(faketon.cadets.some((c) => c.flight === archivedIndex)).toBe(true);
    expect(faketon.cadets.some((c) => c.flight === staffIndex)).toBe(true);
  });

  it("has awkward names that formatting has to survive", () => {
    const surnames = faketon.cadets.map((c) => c.surname);
    expect(surnames).toContain("Blythe-Jones"); // hyphen
    expect(surnames).toContain("O'Neill"); // apostrophe
  });

  it("has both Timestamp and plain Date createdAt values", () => {
    // EventDetailsPopup branches on `.seconds` being present.
    const kinds = faketon.events.map((e) => (e.createdAt instanceof Date ? "date" : "timestamp"));
    expect(kinds).toContain("date");
    expect(kinds).toContain("timestamp");
  });

  it("offers a stale TeamPoints variant for the year-rollover test", () => {
    expect(STALE_TEAM_POINTS.LastLoginDate.toDate().getFullYear()).toBe(
      FROZEN_NOW.getFullYear() - 1
    );
  });
});

describe("flight shapes", () => {
  it("keeps Testwood on the legacy string[] shape", () => {
    TESTWOOD_FLIGHTS.forEach((f) => expect(typeof f).toBe("string"));
  });

  it("keeps Faketon on the object shape with an archived and a non-competing flight", () => {
    FAKETON_FLIGHTS.forEach((f) => {
      expect(typeof f.name).toBe("string");
      expect(typeof f.competing).toBe("boolean");
      expect(typeof f.archived).toBe("boolean");
    });
    expect(FAKETON_FLIGHTS.filter((f) => f.archived)).toHaveLength(1);
    expect(FAKETON_FLIGHTS.filter((f) => !f.competing)).toHaveLength(1);
    expect(FAKETON_FLIGHTS.filter((f) => f.competing && !f.archived).length).toBeGreaterThanOrEqual(2);
  });

  it("names every flight, in both shapes", () => {
    [...FAKETON_FLIGHTS, ...TESTWOOD_FLIGHTS].forEach((f) => {
      expect(flightNameOf(f).trim()).not.toBe("");
    });
  });
});

describe("dataContextFor", () => {
  it("returns the shape DataContext holds", () => {
    expect(Object.keys(dataContextFor(SQUADRONS.FAKETON)).sort()).toEqual([
      "cadets",
      "events",
      "flightPoints",
    ]);
  });

  it("sorts cadets by forename, matching DataContext.fetchData", () => {
    const names = dataContextFor(SQUADRONS.FAKETON).cadets.map((c) => c.forename);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("gives every document an id", () => {
    const { cadets, events } = dataContextFor(SQUADRONS.FAKETON);
    expect(cadets.every((c) => Boolean(c.id))).toBe(true);
    expect(events.every((e) => Boolean(e.id))).toBe(true);
  });

  it("does not mix the two squadrons together", () => {
    const faketon = dataContextFor(SQUADRONS.FAKETON).cadets.map((c) => c.surname);
    const testwood = dataContextFor(SQUADRONS.TESTWOOD).cadets.map((c) => c.surname);
    expect(faketon.filter((s) => testwood.includes(s))).toEqual([]);
  });
});

describe("users and access", () => {
  it("has an admin, a plain user, and a system admin", () => {
    const entries = Object.entries(dummyData).filter(([p]) => p.startsWith("MassUserList/"));
    const uids = entries.map(([, d]) => d.UID);
    expect(uids).toEqual(expect.arrayContaining([UIDS.faketonAdmin, UIDS.faketonUser, UIDS.systemAdmin]));
    expect(entries.some(([, d]) => d.systemAdmin === true)).toBe(true);
  });

  it("has no MassUserList entry for the stranger, so checkUserRole reports a first login", () => {
    const uids = Object.entries(dummyData)
      .filter(([p]) => p.startsWith("MassUserList/"))
      .map(([, d]) => d.UID);
    expect(uids).not.toContain(UIDS.stranger);
  });

  it("has one access request in each state", () => {
    const states = Object.entries(dummyData)
      .filter(([p]) => p.startsWith("SquadronDatabases/9999/UserRequests/"))
      .map(([, d]) => d.progress);
    expect(states.sort()).toEqual(["denied", "granted", "pending"]);
  });

  it("builds a user prop matching the squadron", () => {
    const user = userFor(SQUADRONS.FAKETON);
    expect(user).toMatchObject({ squadronNumber: 9999, squadronName: "Faketon", role: "admin" });
    expect(user.uid).toBe(UIDS.faketonAdmin);
  });
});

describe("reading the fixture back through the fake", () => {
  const db = getFirestore();

  beforeEach(() => __seed(dummyData));
  afterEach(() => __reset());

  it("reads a squadron's cadets", async () => {
    const snap = await getDocs(collection(db, "SquadronDatabases", "9999", "Cadets"));
    expect(snap.size).toBe(dataContextFor(SQUADRONS.FAKETON).cadets.length);
  });

  it("reads a nested FlightPoints document", async () => {
    const snap = await getDoc(
      doc(db, "SquadronDatabases", "9999", "FlightPoints", "Badge Points")
    );
    expect(snap.exists()).toBe(true);
    expect(snap.data()["Gold Badge"]).toBe(20);
  });

  it("exposes the top-level FlightPoints template copied into new squadrons", async () => {
    const snap = await getDocs(collection(db, "FlightPoints"));
    expect(snap.docs.map((d) => d.id).sort()).toEqual([
      "Badge Points",
      "Badges",
      "Event Category Points",
      "Special Awards",
      "TeamPoints",
    ]);
  });
});
