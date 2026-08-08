/**
 * Offline dev mode.
 *
 * `npm run dev:offline` runs the real app against the in-memory fake with no
 * Firebase project. Two halves have to hold, and they are checked separately
 * because they work by different mechanisms:
 *
 *   1. The SWAP is a build-time alias in vite.config.js -- with the flag set,
 *      every `firebase/firestore/lite` import resolves to the fake instead.
 *      That cannot be triggered by setting an environment variable at runtime,
 *      so it is asserted against the config.
 *
 *   2. The BEHAVIOUR -- that the app's real data-layer modules work correctly
 *      against the fake, seeded with the dummy squadrons -- is exercised for
 *      real below, through the same functions the dashboards call.
 */

import fs from "fs";
import path from "path";

import { dummyData } from "./dummyData";
import { __reset, __seed } from "./fakeFirestore";
import { fetchSquadronDoc, updateFlights } from "../firebase/squadron";
import { squadronCollection, collection, db, getDocs } from "../firebase/db";

const CONFIG = fs.readFileSync(
  path.resolve(__dirname, "..", "..", "vite.config.js"),
  "utf8"
);

describe("the offline swap", () => {
  it("is wired as a resolve alias keyed on the flag", () => {
    expect(CONFIG).toMatch(/REACT_APP_USE_FAKE_DB\s*===\s*["']true["']/);
    expect(CONFIG).toMatch(/["']firebase\/firestore\/lite["']\s*:/);
    expect(CONFIG).toMatch(/fakeFirestore/);
  });

  it("swaps auth as well as the database", () => {
    // Both halves are required. With only Firestore faked, the app booted
    // against the dummy squadrons and then sent the user to a real Google
    // popup; the real uid that came back is not in the fixture, so the app
    // treated them as a first-time visitor and the seeded squadrons could not
    // be reached at all.
    expect(CONFIG).toMatch(/["']firebase\/auth["']\s*:/);
    expect(CONFIG).toMatch(/devAuth/);
  });

  it("only applies when the flag is set", () => {
    // The alias object is empty otherwise, so an ordinary build and an ordinary
    // test run both get the real SDK specifier.
    expect(CONFIG).toMatch(/offline\s*\?\s*\{[\s\S]*?\}\s*:\s*\{\}/);
  });

  it("is exposed to the app as isOfflineMode, off by default", async () => {
    const { isOfflineMode } = await import("../firebase/db");
    expect(isOfflineMode).toBe(false);
  });
});

describe("the app's data layer against the seeded fake", () => {
  // This is what offline mode actually does once the alias is in place: the
  // real modules, the real dummy squadrons, no Firebase.
  beforeEach(() => {
    __seed(dummyData);
  });

  afterEach(() => {
    __reset();
  });

  it("serves both dummy squadrons", async () => {
    const squadrons = await getDocs(collection(db(), "SquadronList"));
    expect(squadrons.docs.map((d) => d.data().Number).sort()).toEqual([9998, 9999]);
  });

  it("serves a squadron's cadets", async () => {
    const cadets = await getDocs(squadronCollection(9999, "Cadets"));
    expect(cadets.size).toBe(10);
  });

  it("serves the flights an admin would edit", async () => {
    const faketon = await fetchSquadronDoc(9999);
    expect(faketon.flights.map((f) => f.name)).toEqual([
      "Staff Team",
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
  });

  it("accepts a flight edit through the same calls the dashboard makes", async () => {
    const before = await fetchSquadronDoc(9999);
    await updateFlights(before.id, [
      ...before.flights,
      { name: "Delta", competing: true, archived: false },
    ]);

    const after = await fetchSquadronDoc(9999);
    expect(after.flights.map((f) => f.name)).toContain("Delta");
  });
});
