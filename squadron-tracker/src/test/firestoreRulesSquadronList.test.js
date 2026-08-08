/**
 * @jest-environment node
 *
 * Security-rules tests, run against the Firestore emulator.
 *
 * These are the only tests in the suite that cannot run purely in memory: the
 * rules engine lives in the emulator. They are skipped automatically when no
 * emulator is present (the default `npm test`), and run via
 *
 *   npm run test:rules
 *
 * which wraps this file in `firebase emulators:exec` so the emulator's
 * lifetime is managed and FIRESTORE_EMULATOR_HOST is set.
 *
 * Context that makes these tests matter: the ruleset these replace was
 * `allow read, write: if true` -- every squadron's cadet records publicly
 * readable and writable by anyone on the internet, no login required. The
 * unauthenticated cases below are not hypothetical hardening; they are the
 * exact accesses that were open.
 */

// The global harness replaces firebase/firestore with the in-memory fake.
// These tests are the one place that must talk to the real SDK, because the
// thing under test is the emulator's rules engine, not the app.
jest.unmock("firebase/firestore");
jest.unmock("firebase/firestore/lite");
jest.unmock("firebase/auth");

// Jest 27's node test environment predates Node's global fetch, which
// rules-unit-testing v4 uses to talk to the emulator's REST API. Node itself
// has all of this; only the Jest sandbox lacks the globals, so restore them
// from Node's own modules before undici loads.
/* eslint-disable global-require */
if (typeof globalThis.ReadableStream === "undefined") {
  const web = require("node:stream/web");
  globalThis.ReadableStream = web.ReadableStream;
  globalThis.WritableStream = web.WritableStream;
  globalThis.TransformStream = web.TransformStream;
}
if (typeof globalThis.Blob === "undefined") {
  globalThis.Blob = require("node:buffer").Blob;
}
if (typeof globalThis.MessagePort === "undefined") {
  globalThis.MessagePort = require("node:worker_threads").MessagePort;
}
if (typeof globalThis.fetch === "undefined") {
  const undici = require("undici");
  globalThis.fetch = undici.fetch;
  globalThis.Headers = undici.Headers;
  globalThis.Request = undici.Request;
  globalThis.Response = undici.Response;
  globalThis.FormData = undici.FormData;
}
/* eslint-enable global-require */

import fs from "fs";
import path from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";

import { UIDS, dummyData } from "./dummyData";

const describeRules = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  // eslint-disable-next-line no-console
  console.log("firestoreRules: no emulator detected -- skipped. Run via `npm run test:rules`.");
}

/**
 * dummyData holds Timestamp stand-ins carrying a toDate() method; the real SDK
 * rejects functions as field values, so convert them to Dates for seeding.
 */
const seedable = (value) => {
  if (value === null || typeof value !== "object") return value;
  if (Object.prototype.toString.call(value) === "[object Date]") return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (Array.isArray(value)) return value.map(seedable);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, seedable(v)]));
};

describeRules("firestore.rules -- squadron directory", () => {
  let env;

  // Compat-style handles (db.doc(...).get()) -- deliberately not the modular
  // API, so nothing here depends on the mocked module specifiers.
  let anon; // signed out
  let stranger; // signed in, member of nothing
  let faketonAdmin; // admin of 9999
  let faketonUser; // plain member of 9999
  let testwoodAdmin; // admin of 9998 -- the cross-squadron attacker stand-in
  let sysAdmin; // listed in SystemAdmins

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: "squadron-tracker-rules-test",
      firestore: {
        rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
      },
    });

    anon = env.unauthenticatedContext().firestore();
    stranger = env.authenticatedContext(UIDS.stranger).firestore();
    faketonAdmin = env.authenticatedContext(UIDS.faketonAdmin).firestore();
    faketonUser = env.authenticatedContext(UIDS.faketonUser).firestore();
    testwoodAdmin = env.authenticatedContext(UIDS.testwoodAdmin).firestore();
    sysAdmin = env.authenticatedContext(UIDS.systemAdmin).firestore();

    // Once per file, not per test. clearFirestore() is by far the most
    // expensive call here, but skipping it entirely lets data accumulate
    // across suites and slows the emulator just as badly. Once at the start
    // gives a known-clean database for the cost of a single call.
    await env.clearFirestore();
  });

  jest.setTimeout(30000);

  /*
   * A deliberately minimal fixture.
   *
   * Seeding the full dummy squadron (~45 documents) before each of 40-odd
   * tests overwhelmed the emulator: the last few tests timed out, which reads
   * exactly like a rules failure and is not one. Batching the writes made it
   * worse, not better -- clearFirestore() itself is the expensive part, and it
   * scales with how much data is there.
   *
   * Rules tests are about who may touch which path. They need one or two
   * documents per collection, not a realistic squadron -- that is what the
   * in-memory suite is for. Everything the rules actually branch on is kept:
   * both squadrons, membership documents in each, a request in each state, and
   * the system-admin lookup.
   */
  const rulesFixture = () => {
    const pick = (prefix, count) =>
      Object.entries(dummyData)
        .filter(([path]) => path.startsWith(prefix))
        .slice(0, count);

    return Object.fromEntries([
      ...Object.entries(dummyData).filter(([path]) =>
        path.startsWith("SquadronList/") ||
        path.startsWith("MassUserList/") ||
        path.startsWith("NewAccountRequests/") ||
        path.startsWith("SquadronDatabases/9999/AuthorisedUsers/") ||
        path.startsWith("SquadronDatabases/9998/AuthorisedUsers/") ||
        path.startsWith("SquadronDatabases/9999/UserRequests/") ||
        path === "SquadronDatabases/9999" ||
        path === "SquadronDatabases/9998"
      ),
      // Just enough of each data collection to read from and write to.
      ...pick("SquadronDatabases/9999/Cadets/", 2),
      ...pick("SquadronDatabases/9998/Cadets/", 1),
      ...pick("SquadronDatabases/9999/EventLog/", 1),
      ...pick("SquadronDatabases/9999/FlightPoints/", 1),
      ...pick("FlightPoints/", 1),
      // The rules-only lookup table; not part of dummyData because app code
      // never touches it.
      [`SystemAdmins/${UIDS.systemAdmin}`, {}],
    ]);
  };

  const FIXTURE = rulesFixture();

  /*
   * Restores the fixture by overwriting it, WITHOUT clearFirestore().
   *
   * clearFirestore() turned out to be the expensive call: running it before
   * each of 43 tests drove the whole suite past its timeouts on a modest
   * machine, and the resulting failures looked exactly like rules failures.
   * (Confirmed by running one describe in isolation, where all of its tests
   * pass in a couple of seconds.)
   *
   * Overwriting restores every document these tests read. Documents a test
   * creates (a new squadron, say) do linger, which is harmless here: no test
   * asserts that something is absent, only that an operation is allowed or
   * denied, and denial does not depend on unrelated documents existing.
   */
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const batch = db.batch();
      Object.entries(FIXTURE).forEach(([docPath, data]) => {
        batch.set(db.doc(docPath), seedable(data));
      });
      await batch.commit();
    });
  });

  afterAll(async () => {
    await env.cleanup();
  });

  // -------------------------------------------------------------------------
  // What the old ruleset allowed, and must now be refused
  // -------------------------------------------------------------------------

describe("SquadronList writes", () => {
    const NEW_FLIGHTS = [
      { name: "Staff Team", competing: false, archived: false },
      { name: "Alpha", competing: true, archived: false },
      { name: "Delta", competing: true, archived: false },
    ];

    it("let a squadron's admin change their own flights", async () => {
      // The narrow widening Add/Edit Flights needs.
      await assertSucceeds(
        faketonAdmin.doc("SquadronList/sqnlist-faketon").update({ flights: NEW_FLIGHTS })
      );
    });

    it("refuse a non-admin member changing flights", async () => {
      await assertFails(
        faketonUser.doc("SquadronList/sqnlist-faketon").update({ flights: NEW_FLIGHTS })
      );
    });

    it("refuse an admin of another squadron changing these flights", async () => {
      // The isolation property, applied to the new write path.
      await assertFails(
        testwoodAdmin.doc("SquadronList/sqnlist-faketon").update({ flights: NEW_FLIGHTS })
      );
    });

    it("refuse an admin renaming or renumbering their squadron", async () => {
      // Renumbering would be a route into another squadron's identity.
      await assertFails(
        faketonAdmin.doc("SquadronList/sqnlist-faketon").update({ Name: "Renamed" })
      );
      await assertFails(
        faketonAdmin.doc("SquadronList/sqnlist-faketon").update({ Number: 9998 })
      );
    });

    it("refuse an admin smuggling another field alongside flights", async () => {
      await assertFails(
        faketonAdmin
          .doc("SquadronList/sqnlist-faketon")
          .update({ flights: NEW_FLIGHTS, Name: "Renamed" })
      );
    });

    it("refuse an admin creating or deleting directory entries", async () => {
      await assertFails(
        faketonAdmin.doc("SquadronList/invented").set({ Name: "X", Number: 1, flights: [] })
      );
      await assertFails(faketonAdmin.doc("SquadronList/sqnlist-faketon").delete());
    });

    it("still allow system admins to change anything", async () => {
      await assertSucceeds(
        sysAdmin.doc("SquadronList/sqnlist-faketon").update({ Name: "Renamed" })
      );
    });
  });

});
