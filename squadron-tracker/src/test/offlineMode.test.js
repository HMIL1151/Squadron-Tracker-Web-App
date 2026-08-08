/**
 * Offline dev mode, end to end.
 *
 * `npm run dev:offline` is meant to run the real app against the in-memory
 * fake with no Firebase project. That claim is only worth making if something
 * checks it, so this drives a real dashboard through the real data layer with
 * the flag set -- not through the test harness's own mocks.
 */

// The global harness routes Firestore to the fake for every test. Here that
// would defeat the point: what is under test is whether db.js does the routing
// itself when the flag is set.
jest.unmock("firebase/firestore");
jest.unmock("firebase/firestore/lite");

describe("REACT_APP_USE_FAKE_DB", () => {
  /**
   * Loads a fresh copy of db.js with the flag set, and returns it.
   *
   * This has to happen inside each test, not in beforeAll: setupTests.js calls
   * __reset() on the fake in a global beforeEach, which would wipe the seed
   * db.js installs at import time. That reset is right for every other test in
   * the suite -- so this one re-imports rather than fighting it.
   */
  const loadOfflineDb = () => {
    process.env.REACT_APP_USE_FAKE_DB = "true";
    jest.resetModules();
    // eslint-disable-next-line global-require
    return require("../firebase/db");
  };

  afterEach(() => {
    delete process.env.REACT_APP_USE_FAKE_DB;
    jest.resetModules();
  });

  it("reports that it is offline", () => {
    expect(loadOfflineDb().isOfflineMode).toBe(true);
  });

  it("is off without the flag", () => {
    jest.resetModules();
    // eslint-disable-next-line global-require
    expect(require("../firebase/db").isOfflineMode).toBe(false);
  });

  it("seeds both dummy squadrons", async () => {
    const db = loadOfflineDb();
    const squadrons = await db.getDocs(db.collection(db.db(), "SquadronList"));
    expect(squadrons.docs.map((d) => d.data().Number).sort()).toEqual([9998, 9999]);
  });

  it("serves a squadron's cadets", async () => {
    const db = loadOfflineDb();
    const cadets = await db.getDocs(db.squadronCollection(9999, "Cadets"));
    expect(cadets.size).toBe(10);
  });

  it("serves the flights an admin would edit", async () => {
    const db = loadOfflineDb();
    const squadrons = await db.getDocs(db.collection(db.db(), "SquadronList"));
    const faketon = squadrons.docs.find((d) => d.data().Number === 9999).data();
    expect(faketon.flights.map((f) => f.name)).toEqual([
      "Staff Team",
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
  });

  it("accepts a flight edit written through the real data layer", async () => {
    loadOfflineDb();
    // The exact calls FlightsDashboard makes, through the real modules.
    // eslint-disable-next-line global-require
    const { updateFlights, fetchSquadronDoc } = require("../firebase/squadron");

    const before = await fetchSquadronDoc(9999);
    await updateFlights(before.id, [
      ...before.flights,
      { name: "Delta", competing: true, archived: false },
    ]);

    const after = await fetchSquadronDoc(9999);
    expect(after.flights.map((f) => f.name)).toContain("Delta");
  });

  it("never opens a real connection", () => {
    // db.js re-exports the fake's own functions, not the SDK's. If this fails,
    // offline mode is talking to Firebase.
    const db = loadOfflineDb();
    // eslint-disable-next-line global-require
    const fake = require("./fakeFirestore");
    expect(db.collection).toBe(fake.collection);
    expect(typeof fake.__seed).toBe("function");
  });
});
