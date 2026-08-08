/**
 * src/utils/flights.js
 *
 * Full branch coverage, with particular attention to the legacy string[] shape
 * -- that is not a migration window, it is a shape the database will keep
 * holding until each squadron happens to save.
 */

import {
  addFlight,
  countCadetsInFlight,
  getAssignableFlights,
  getCompetingFlights,
  normaliseFlights,
  toFlightMap,
  updateFlight,
  validateFlights,
} from "./flights";
import { FAKETON_FLIGHTS, TESTWOOD_FLIGHTS, SQUADRONS, dataContextFor } from "../test/dummyData";

const cadets = dataContextFor(SQUADRONS.FAKETON).cadets;

describe("normaliseFlights", () => {
  it("passes the object shape through", () => {
    expect(normaliseFlights(FAKETON_FLIGHTS)).toEqual([
      { name: "Staff Team", competing: false, archived: false },
      { name: "Alpha", competing: true, archived: false },
      { name: "Bravo", competing: true, archived: false },
      { name: "Charlie", competing: true, archived: true },
    ]);
  });

  it("converts the legacy string shape, treating the first flight as staff", () => {
    // Reproduces the old hardcoded rule exactly: index 0 does not compete.
    expect(normaliseFlights(TESTWOOD_FLIGHTS)).toEqual([
      { name: "Staff Team", competing: false, archived: false },
      { name: "Atlas", competing: true, archived: false },
      { name: "Tempest", competing: true, archived: false },
    ]);
  });

  it("handles a mixed array", () => {
    expect(normaliseFlights(["Staff", { name: "Alpha", competing: true, archived: false }])).toEqual([
      { name: "Staff", competing: false, archived: false },
      { name: "Alpha", competing: true, archived: false },
    ]);
  });

  it("fills in missing fields on a partial object", () => {
    expect(normaliseFlights([{ name: "Solo" }])).toEqual([
      { name: "Solo", competing: false, archived: false },
    ]);
  });

  it("survives empty, null and undefined", () => {
    expect(normaliseFlights([])).toEqual([]);
    expect(normaliseFlights(null)).toEqual([]);
    expect(normaliseFlights(undefined)).toEqual([]);
  });

  it("never returns an undefined name", () => {
    expect(normaliseFlights([{ competing: true }])[0].name).toBe("");
  });
});

describe("toFlightMap", () => {
  it("keys names by 1-based index, matching the cadet flight field", () => {
    expect(toFlightMap(FAKETON_FLIGHTS)).toEqual({
      1: "Staff Team",
      2: "Alpha",
      3: "Bravo",
      4: "Charlie",
    });
  });

  it("includes archived flights, so existing cadets still show a name", () => {
    expect(toFlightMap(FAKETON_FLIGHTS)[4]).toBe("Charlie");
  });

  it("works on the legacy shape", () => {
    expect(toFlightMap(TESTWOOD_FLIGHTS)).toEqual({ 1: "Staff Team", 2: "Atlas", 3: "Tempest" });
  });
});

describe("getCompetingFlights", () => {
  it("returns competing, non-archived flights with their index", () => {
    expect(getCompetingFlights(FAKETON_FLIGHTS)).toEqual([
      { name: "Alpha", competing: true, archived: false, index: 2 },
      { name: "Bravo", competing: true, archived: false, index: 3 },
    ]);
  });

  it("excludes an archived flight even when it is marked competing", () => {
    // Charlie is competing:true, archived:true.
    expect(getCompetingFlights(FAKETON_FLIGHTS).map((f) => f.name)).not.toContain("Charlie");
  });

  it("excludes the staff flight", () => {
    expect(getCompetingFlights(FAKETON_FLIGHTS).map((f) => f.name)).not.toContain("Staff Team");
  });

  it("reproduces the old hardcoded 'flights 2 and 3' for a legacy squadron", () => {
    // Exactly what FightPointsDashboard used to hardcode.
    expect(getCompetingFlights(TESTWOOD_FLIGHTS).map((f) => f.index)).toEqual([2, 3]);
  });

  it("supports more than two competing flights", () => {
    const four = addFlight(FAKETON_FLIGHTS, { name: "Delta", competing: true });
    expect(getCompetingFlights(four).map((f) => f.name)).toEqual(["Alpha", "Bravo", "Delta"]);
  });

  it("returns nothing when no flight competes", () => {
    expect(getCompetingFlights([{ name: "Only", competing: false, archived: false }])).toEqual([]);
  });
});

describe("getAssignableFlights", () => {
  it("offers every non-archived flight, including the staff flight", () => {
    expect(getAssignableFlights(FAKETON_FLIGHTS).map((f) => f.name)).toEqual([
      "Staff Team",
      "Alpha",
      "Bravo",
    ]);
  });

  it("hides archived flights from new assignments", () => {
    expect(getAssignableFlights(FAKETON_FLIGHTS).map((f) => f.name)).not.toContain("Charlie");
  });
});

describe("countCadetsInFlight", () => {
  it("counts by 1-based index", () => {
    expect(countCadetsInFlight(cadets, 2)).toBe(4); // Alpha
    expect(countCadetsInFlight(cadets, 4)).toBe(1); // archived Charlie
  });

  it("compares numerically, since edits can store the index as a string", () => {
    expect(countCadetsInFlight([{ flight: "2" }], 2)).toBe(1);
    expect(countCadetsInFlight([{ flight: 2 }], "2")).toBe(1);
  });

  it("returns zero for an empty flight or missing cadets", () => {
    expect(countCadetsInFlight(cadets, 99)).toBe(0);
    expect(countCadetsInFlight(undefined, 1)).toBe(0);
  });
});

describe("addFlight", () => {
  it("appends without disturbing existing indices", () => {
    const result = addFlight(FAKETON_FLIGHTS, { name: "Delta" });
    expect(result).toHaveLength(5);
    expect(result[4]).toEqual({ name: "Delta", competing: true, archived: false });
    // Every existing index is unchanged -- this is what keeps cadets correct.
    expect(toFlightMap(result)).toMatchObject(toFlightMap(FAKETON_FLIGHTS));
  });

  it("trims the name and defaults to competing", () => {
    expect(addFlight([], { name: "  Delta  " })[0]).toEqual({
      name: "Delta",
      competing: true,
      archived: false,
    });
  });

  it("can add a non-competing flight", () => {
    expect(addFlight([], { name: "Support", competing: false })[0].competing).toBe(false);
  });

  it("upgrades a legacy array on the way", () => {
    const result = addFlight(TESTWOOD_FLIGHTS, { name: "Delta" });
    expect(result.every((f) => typeof f === "object")).toBe(true);
    expect(result).toHaveLength(4);
  });
});

describe("updateFlight", () => {
  it("renames by 1-based index", () => {
    expect(updateFlight(FAKETON_FLIGHTS, 2, { name: "Renamed" })[1].name).toBe("Renamed");
  });

  it("leaves other flights untouched", () => {
    const result = updateFlight(FAKETON_FLIGHTS, 2, { name: "Renamed" });
    expect(result[0]).toEqual(FAKETON_FLIGHTS[0]);
    expect(result[2]).toEqual(FAKETON_FLIGHTS[2]);
  });

  it("toggles competing and archived", () => {
    expect(updateFlight(FAKETON_FLIGHTS, 2, { competing: false })[1].competing).toBe(false);
    expect(updateFlight(FAKETON_FLIGHTS, 2, { archived: true })[1].archived).toBe(true);
  });

  it("accepts a string index", () => {
    expect(updateFlight(FAKETON_FLIGHTS, "3", { name: "X" })[2].name).toBe("X");
  });

  it("upgrades a legacy array on the way", () => {
    const result = updateFlight(TESTWOOD_FLIGHTS, 2, { name: "Renamed" });
    expect(result[1]).toEqual({ name: "Renamed", competing: true, archived: false });
  });

  it("is a no-op for an index that does not exist", () => {
    expect(updateFlight(FAKETON_FLIGHTS, 99, { name: "X" })).toEqual(normaliseFlights(FAKETON_FLIGHTS));
  });
});

describe("validateFlights", () => {
  const ok = (flights, opts) => expect(validateFlights(flights, opts)).toBeNull();

  it("accepts both dummy squadrons as they stand", () => {
    // Faketon needs `previous` because Charlie is already archived with a
    // cadet in it -- see the dedicated test below.
    ok(FAKETON_FLIGHTS, { cadets, previous: FAKETON_FLIGHTS });
    ok(TESTWOOD_FLIGHTS);
  });

  it("rejects an empty squadron", () => {
    expect(validateFlights([])).toMatch(/at least one flight/i);
  });

  it("rejects a blank or whitespace-only name", () => {
    expect(validateFlights([{ name: "", competing: true }])).toMatch(/needs a name/i);
    expect(validateFlights([{ name: "   ", competing: true }])).toMatch(/needs a name/i);
  });

  it("rejects duplicate names, ignoring case and surrounding space", () => {
    expect(
      validateFlights([
        { name: "Alpha", competing: true },
        { name: " alpha ", competing: true },
      ])
    ).toMatch(/cannot share a name/i);
  });

  it("requires at least one competing, non-archived flight", () => {
    // Otherwise Flight Points renders an empty chart with no explanation.
    expect(validateFlights([{ name: "Staff", competing: false }])).toMatch(/must be competing/i);
    expect(
      validateFlights([
        { name: "Staff", competing: false },
        { name: "Alpha", competing: true, archived: true },
      ])
    ).toMatch(/must be competing/i);
  });

  it("refuses to archive a flight that still has cadets, and says how many", () => {
    const archiveAlpha = updateFlight(FAKETON_FLIGHTS, 2, { archived: true });
    const message = validateFlights(archiveAlpha, { cadets, previous: FAKETON_FLIGHTS });
    expect(message).toMatch(/Alpha still has 4 cadets/);
    expect(message).toMatch(/Move them to another flight/);
  });

  it("uses the singular for one cadet", () => {
    // Un-archive Charlie first so archiving it again is a genuine transition.
    const unarchived = updateFlight(FAKETON_FLIGHTS, 4, { archived: false });
    const rearchived = updateFlight(unarchived, 4, { archived: true });
    expect(validateFlights(rearchived, { cadets, previous: unarchived })).toMatch(
      /Charlie still has 1 cadet\b/
    );
  });

  it("allows a flight that was already archived to stay archived with cadets in it", () => {
    // Faketon's Charlie is archived and still holds Grace. That is ordinary
    // historical state; rejecting it would make the squadron unsaveable and
    // block every unrelated flight edit.
    ok(FAKETON_FLIGHTS, { cadets, previous: FAKETON_FLIGHTS });
  });

  it("still allows unrelated edits to a squadron with an occupied archived flight", () => {
    const renamed = updateFlight(FAKETON_FLIGHTS, 2, { name: "Renamed" });
    ok(renamed, { cadets, previous: FAKETON_FLIGHTS });
  });

  it("allows archiving an empty flight", () => {
    const withEmpty = addFlight(FAKETON_FLIGHTS, { name: "Delta" });
    ok(updateFlight(withEmpty, 5, { archived: true }), { cadets, previous: withEmpty });
  });

  it("treats archiving as new when no previous state is supplied", () => {
    // Defensive: without `previous` every archived flight is treated as newly
    // archived, so the check errs towards refusing rather than allowing.
    expect(validateFlights(FAKETON_FLIGHTS, { cadets })).toMatch(/Charlie still has 1 cadet/);
  });
});
