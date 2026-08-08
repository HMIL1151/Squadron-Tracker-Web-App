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

describeRules("firestore.rules", () => {
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

  describe("signed-out access is refused entirely", () => {
    it("cannot read a squadron's cadets", async () => {
      await assertFails(anon.collection("SquadronDatabases/9999/Cadets").get());
    });

    it("cannot read the event log", async () => {
      await assertFails(anon.collection("SquadronDatabases/9999/EventLog").get());
    });

    it("cannot read the squadron directory", async () => {
      await assertFails(anon.collection("SquadronList").get());
    });

    it("cannot write anything", async () => {
      await assertFails(
        anon.doc("SquadronDatabases/9999/Cadets/intruder").set({ forename: "X" })
      );
      await assertFails(anon.doc("MassUserList/intruder").set({ UID: "x", systemAdmin: true }));
    });
  });

  describe("cross-squadron access is refused", () => {
    it("a member of 9998 cannot read 9999's cadets", async () => {
      // THE core isolation property: the client-supplied squadron number must
      // not grant access to someone else's squadron.
      await assertFails(testwoodAdmin.collection("SquadronDatabases/9999/Cadets").get());
    });

    it("a member of 9998 cannot read 9999's event log or flight points", async () => {
      await assertFails(testwoodAdmin.collection("SquadronDatabases/9999/EventLog").get());
      await assertFails(
        testwoodAdmin.doc("SquadronDatabases/9999/FlightPoints/TeamPoints").get()
      );
    });

    it("a member of 9998 cannot write into 9999", async () => {
      await assertFails(
        testwoodAdmin.doc("SquadronDatabases/9999/Cadets/planted").set({ forename: "X" })
      );
    });

    it("an admin of 9998 cannot grant themselves access to 9999", async () => {
      await assertFails(
        testwoodAdmin
          .doc(`SquadronDatabases/9999/AuthorisedUsers/${UIDS.testwoodAdmin}`)
          .set({ displayName: "Testwood Admin", role: "admin" })
      );
    });

    it("an admin of 9998 cannot mint a MassUserList row for 9999", async () => {
      await assertFails(
        testwoodAdmin.collection("MassUserList").add({ UID: "someone", Squadron: 9999 })
      );
    });
  });

  // -------------------------------------------------------------------------
  // What members can do
  // -------------------------------------------------------------------------

  describe("squadron members", () => {
    it("read and write their own squadron's data", async () => {
      await assertSucceeds(faketonUser.collection("SquadronDatabases/9999/Cadets").get());
      await assertSucceeds(faketonUser.collection("SquadronDatabases/9999/EventLog").get());
      await assertSucceeds(
        faketonUser.collection("SquadronDatabases/9999/EventLog").add({
          cadetName: "Isla Muir",
          date: "2025-06-10",
          addedBy: "Plain User",
        })
      );
    });

    it("read their squadron's flight points", async () => {
      await assertSucceeds(
        faketonUser.doc("SquadronDatabases/9999/FlightPoints/TeamPoints").get()
      );
    });

    it("cannot write AuthorisedUsers unless they are an admin", async () => {
      await assertFails(
        faketonUser
          .doc("SquadronDatabases/9999/AuthorisedUsers/uid-friend")
          .set({ displayName: "Friend", role: "user" })
      );
      await assertSucceeds(
        faketonAdmin
          .doc("SquadronDatabases/9999/AuthorisedUsers/uid-friend")
          .set({ displayName: "Friend", role: "user" })
      );
    });

    it("cannot see or manage access requests unless they are an admin", async () => {
      await assertFails(faketonUser.collection("SquadronDatabases/9999/UserRequests").get());
      await assertSucceeds(faketonAdmin.collection("SquadronDatabases/9999/UserRequests").get());
      await assertSucceeds(
        faketonAdmin
          .doc("SquadronDatabases/9999/UserRequests/req-9999-pending")
          .update({ progress: "granted" })
      );
    });
  });

  describe("the admin grant flow", () => {
    it("lets an admin create the uid-keyed MassUserList row for their own squadron", async () => {
      await assertSucceeds(
        faketonAdmin.doc("MassUserList/uid-pending").set({ UID: "uid-pending", Squadron: 9999 })
      );
    });

    it("lets an admin re-grant idempotently (same data, same document)", async () => {
      await assertSucceeds(
        faketonAdmin.doc("MassUserList/uid-pending").set({ UID: "uid-pending", Squadron: 9999 })
      );
      await assertSucceeds(
        faketonAdmin.doc("MassUserList/uid-pending").set({ UID: "uid-pending", Squadron: 9999 })
      );
    });

    it("refuses an update that repoints a mapping at another squadron", async () => {
      // An admin of 9999 must not be able to capture a 9998 user's mapping.
      await assertFails(
        faketonAdmin.doc("MassUserList/mul-03").set({ UID: UIDS.testwoodAdmin, Squadron: 9999 })
      );
    });

    it("refuses to let an admin write the systemAdmin flag", async () => {
      // checkUserRole treats systemAdmin:true on any row as system-admin
      // status, so this write would be self-service privilege escalation.
      await assertFails(
        faketonAdmin
          .doc("MassUserList/uid-sneaky")
          .set({ UID: UIDS.faketonAdmin, Squadron: 9999, systemAdmin: true })
      );
    });

    it("lets an admin delete a MassUserList row for their own squadron on revoke", async () => {
      await assertSucceeds(faketonAdmin.doc("MassUserList/mul-02").delete());
    });

    it("refuses the same from a non-admin member", async () => {
      await assertFails(
        faketonUser.doc("MassUserList/uid-pending").set({ UID: "uid-pending", Squadron: 9999 })
      );
      await assertFails(faketonUser.doc("MassUserList/mul-01").delete());
    });
  });

  // -------------------------------------------------------------------------
  // The login and join flows for people who are not members yet
  // -------------------------------------------------------------------------

  describe("login flow", () => {
    it("lets a user query their own MassUserList rows", async () => {
      // checkUserRole's exact query shape.
      await assertSucceeds(
        faketonAdmin.collection("MassUserList").where("UID", "==", UIDS.faketonAdmin).get()
      );
    });

    it("refuses an unconstrained MassUserList listing", async () => {
      // Without the where-clause the query could return everyone's squadron
      // mapping, so the rules must refuse it outright.
      await assertFails(faketonAdmin.collection("MassUserList").get());
    });

    it("refuses a query for someone else's rows", async () => {
      await assertFails(
        faketonAdmin.collection("MassUserList").where("UID", "==", UIDS.faketonUser).get()
      );
    });

    it("lets any signed-in user read the squadron directory", async () => {
      await assertSucceeds(stranger.collection("SquadronList").get());
    });
  });

  describe("join flow for a signed-in stranger", () => {
    it("can check whether a squadron exists", async () => {
      // doesSquadronAccountExist does a get() on the empty parent document;
      // without this the join flow reports every squadron as nonexistent.
      await assertSucceeds(stranger.doc("SquadronDatabases/9999").get());
    });

    it("cannot list squadron databases wholesale", async () => {
      await assertFails(stranger.collection("SquadronDatabases").get());
    });

    it("cannot read any squadron data from the existence check", async () => {
      await assertFails(stranger.collection("SquadronDatabases/9999/Cadets").get());
    });

    it("can file their own pending access request", async () => {
      await assertSucceeds(
        stranger.collection("SquadronDatabases/9999/UserRequests").add({
          displayName: "New Person",
          email: "new@person.test",
          uid: UIDS.stranger,
          progress: "pending",
          timestamp: "2025-06-15T12:00:00.000Z",
        })
      );
    });

    it("cannot file a request under someone else's uid", async () => {
      await assertFails(
        stranger.collection("SquadronDatabases/9999/UserRequests").add({
          displayName: "New Person",
          uid: "someone-else",
          progress: "pending",
        })
      );
    });

    it("cannot file a pre-granted request", async () => {
      await assertFails(
        stranger.collection("SquadronDatabases/9999/UserRequests").add({
          displayName: "New Person",
          uid: UIDS.stranger,
          progress: "granted",
        })
      );
    });

    it("cannot read anyone's requests", async () => {
      await assertFails(stranger.collection("SquadronDatabases/9999/UserRequests").get());
    });

    it("can file a new-squadron application under their own uid", async () => {
      await assertSucceeds(
        stranger.collection("NewAccountRequests").add({
          squadronName: "Newtown",
          squadronNumber: 7777,
          uid: UIDS.stranger,
          email: "new@person.test",
        })
      );
    });

    it("cannot read the application queue", async () => {
      await assertFails(stranger.collection("NewAccountRequests").get());
    });
  });

  // -------------------------------------------------------------------------
  // System admins
  // -------------------------------------------------------------------------

  describe("system admins", () => {
    it("can read any squadron's data", async () => {
      await assertSucceeds(sysAdmin.collection("SquadronDatabases/9999/Cadets").get());
      await assertSucceeds(sysAdmin.collection("SquadronDatabases/9998/Cadets").get());
    });

    it("can review and clear the application queue", async () => {
      await assertSucceeds(sysAdmin.collection("NewAccountRequests").get());
      await assertSucceeds(sysAdmin.doc("NewAccountRequests/nar-01").delete());
    });

    it("can perform the full squadron-creation write set", async () => {
      // Mirrors SystemAdminDashboard.handleApprove.
      await assertSucceeds(
        sysAdmin.collection("SquadronList").add({ Name: "Newtown", Number: 7777, flights: [] })
      );
      await assertSucceeds(sysAdmin.doc("SquadronDatabases/7777").set({}));
      await assertSucceeds(
        sysAdmin
          .doc("SquadronDatabases/7777/AuthorisedUsers/uid-hopeful")
          .set({ displayName: "Hopeful Admin", role: "admin" })
      );
      await assertSucceeds(
        sysAdmin.doc("SquadronDatabases/7777/FlightPoints/Badge Points").set({ "Blue Badge": 5 })
      );
      await assertSucceeds(
        sysAdmin.collection("MassUserList").add({ UID: "uid-hopeful", Squadron: 7777 })
      );
    });

    it("status is not grantable from the client", async () => {
      // The SystemAdmins collection is console-managed; even a system admin
      // cannot mint another one through the app.
      await assertFails(sysAdmin.doc("SystemAdmins/uid-new-sysadmin").set({}));
      await assertFails(
        faketonAdmin.doc(`SystemAdmins/${UIDS.faketonAdmin}`).set({})
      );
    });
  });

  // -------------------------------------------------------------------------
  // Squadron directory writes
  // -------------------------------------------------------------------------

  });
