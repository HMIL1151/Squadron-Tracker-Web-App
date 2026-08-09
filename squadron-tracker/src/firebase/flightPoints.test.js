/**
 * TeamPoints allocation, and the year rollover that used to eat it.
 *
 * The bug these exist for: fetchTeamPoints zeroes every flight when
 * LastLoginDate is not the current year, because allocations are a per-year
 * competition. addPointsToFlight added to the stored value and never touched
 * LastLoginDate -- so on any squadron whose document still carried last year's
 * date, an allocation was written and then discarded by the very next read.
 * Nothing errored, because nothing had failed. The points simply never
 * appeared, on every attempt, forever.
 *
 * The clock is frozen to 2025-06-15 by setupTests.js, so "this year" is 2025
 * and "last year" is 2024 throughout.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { __seed, __store } from "../test/fakeFirestore";
import { addPointsToFlight, fetchTeamPoints } from "./flightPoints";

const SQN = 9999;
const PATH = `SquadronDatabases/${SQN}/FlightPoints/TeamPoints`;

const seedTeamPoints = (fields) => __seed({ [PATH]: fields });

describe("allocating points to a flight", () => {
  beforeEach(() => {
    seedTeamPoints({ 1: 0, 2: 40, 3: 10, LastLoginDate: new Date("2025-01-05T09:00:00Z") });
  });

  it("adds to the running total", async () => {
    const total = await addPointsToFlight(SQN, "2", 25);
    expect(total).toBe(65);
    expect(__store()[PATH]["2"]).toBe(65);
  });

  it("leaves the other flights alone", async () => {
    await addPointsToFlight(SQN, "2", 25);
    const stored = __store()[PATH];
    expect(stored["1"]).toBe(0);
    expect(stored["3"]).toBe(10);
  });

  it("survives the round trip through fetchTeamPoints", async () => {
    // The regression. Before the fix this read back as 0, because the write
    // never stamped LastLoginDate.
    await addPointsToFlight(SQN, "2", 25);
    const points = await fetchTeamPoints(SQN);
    expect(points["2"]).toBe(65);
  });
});

describe("when the stored year is stale", () => {
  beforeEach(() => {
    // Last allocated in 2024; the clock says 2025.
    seedTeamPoints({ 1: 5, 2: 40, 3: 10, LastLoginDate: new Date("2024-11-02T20:15:00Z") });
  });

  it("starts this year's total from zero rather than adding to last year's", async () => {
    const total = await addPointsToFlight(SQN, "2", 25);
    expect(total).toBe(25);
  });

  it("persists the reset for every flight, not just the one allocated to", async () => {
    // Otherwise the document keeps needing to be reinterpreted on every read,
    // and the next allocation to a different flight inherits a stale value.
    await addPointsToFlight(SQN, "2", 25);
    const stored = __store()[PATH];
    expect(stored["1"]).toBe(0);
    expect(stored["3"]).toBe(0);
    expect(stored["2"]).toBe(25);
  });

  it("stamps the current year so the allocation is not zeroed on read", async () => {
    await addPointsToFlight(SQN, "2", 25);
    const points = await fetchTeamPoints(SQN);
    expect(points["2"]).toBe(25);
  });
});

describe("reading team points", () => {
  it("zeroes a document last stamped in a previous year", async () => {
    seedTeamPoints({ 1: 5, 2: 40, LastLoginDate: new Date("2024-11-02T20:15:00Z") });
    expect(await fetchTeamPoints(SQN)).toEqual({ 1: 0, 2: 0 });
  });

  it("accepts the legacy string form of the date", async () => {
    // The field has been seen as a string in real data, so both shapes must
    // resolve to the same year rather than one silently reading as undefined.
    seedTeamPoints({ 2: 40, LastLoginDate: "15 June 2025 at 12:00:00 UTC" });
    expect(await fetchTeamPoints(SQN)).toEqual({ 2: 40 });
  });

  it("returns nothing when the document is missing", async () => {
    __seed({});
    expect(await fetchTeamPoints(SQN)).toEqual({});
  });

  it("refuses to allocate when the document is missing", async () => {
    __seed({});
    await expect(addPointsToFlight(SQN, "2", 25)).rejects.toThrow(/does not exist/i);
  });
});
