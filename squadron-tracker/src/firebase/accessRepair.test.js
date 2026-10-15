/**
 * Legacy-membership repair, against the seeded fake.
 *
 * Testwood carries one locked-out user in the fixture: AuthorisedUsers keyed by
 * their request id. The other cases -- a revoked user's leftover, a user who
 * already has a correct record -- are seeded per test, because they are the
 * ones where getting it wrong either gives access back or deletes it.
 */

import { __seed, __store, __writes } from "../test/fakeFirestore";
import { UIDS, dummyData } from "../test/dummyData";
import { findLegacyMemberships, repairLegacyMembership } from "./accessRepair";

const BASE = "SquadronDatabases/9998";
const LEGACY = `${BASE}/AuthorisedUsers/req-9998-locked`;
const KEYED = `${BASE}/AuthorisedUsers/${UIDS.testwoodLocked}`;

const seedWith = (changes) => __seed({ ...dummyData, ...changes });

beforeEach(() => __seed(dummyData));

describe("findLegacyMemberships", () => {
  it("finds the user whose membership is keyed by their request", async () => {
    const found = await findLegacyMemberships();
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      squadronNumber: 9998,
      squadronName: "Testwood",
      legacyId: "req-9998-locked",
      uid: UIDS.testwoodLocked,
      email: "locked@testwood.test",
      role: "user",
      action: "rekey",
    });
  });

  it("leaves correctly keyed members alone, including those with a granted request", async () => {
    const found = await findLegacyMemberships();
    expect(found.map((f) => f.uid)).not.toContain(UIDS.faketonUser);
    expect(found.map((f) => f.uid)).not.toContain(UIDS.testwoodAdmin);
  });

  it("only removes the leftover of a user whose access was later revoked", async () => {
    seedWith({ [`${BASE}/UserRequests/req-9998-locked`]: { ...dummyData[`${BASE}/UserRequests/req-9998-locked`], progress: "denied" } });
    const [finding] = await findLegacyMemberships();
    expect(finding.action).toBe("leftover");
  });

  it("only removes the duplicate when the user already has a correct record", async () => {
    seedWith({ [KEYED]: { displayName: "Locked Out", email: "locked@testwood.test", role: "admin" } });
    const [finding] = await findLegacyMemberships();
    expect(finding.action).toBe("leftover");
  });

  it("ignores a request-id document whose request never recorded a uid", async () => {
    const { uid, ...noUid } = dummyData[`${BASE}/UserRequests/req-9998-locked`];
    seedWith({ [`${BASE}/UserRequests/req-9998-locked`]: noUid });
    expect(await findLegacyMemberships()).toEqual([]);
  });
});

describe("repairLegacyMembership", () => {
  it("moves the record to the user's uid, unchanged, and removes the old one", async () => {
    const [finding] = await findLegacyMemberships();
    await repairLegacyMembership(finding);

    const store = __store();
    expect(store[KEYED]).toEqual({ displayName: "Locked Out", email: "locked@testwood.test", role: "user" });
    expect(store[LEGACY]).toBeUndefined();
    // New written before old removed, so a failure part-way leaves access.
    expect(__writes().map((w) => w.op)).toEqual(["set", "delete"]);
  });

  it("never re-creates access for a revoked user", async () => {
    seedWith({ [`${BASE}/UserRequests/req-9998-locked`]: { ...dummyData[`${BASE}/UserRequests/req-9998-locked`], progress: "denied" } });
    const [finding] = await findLegacyMemberships();
    await repairLegacyMembership(finding);

    const store = __store();
    expect(store[KEYED]).toBeUndefined();
    expect(store[LEGACY]).toBeUndefined();
  });

  it("does not overwrite a correct record that already exists", async () => {
    seedWith({ [KEYED]: { displayName: "Locked Out", email: "locked@testwood.test", role: "admin" } });
    const [finding] = await findLegacyMemberships();
    await repairLegacyMembership(finding);

    expect(__store()[KEYED].role).toBe("admin");
  });

  it("leaves nothing to find afterwards", async () => {
    const [finding] = await findLegacyMemberships();
    await repairLegacyMembership(finding);
    expect(await findLegacyMemberships()).toEqual([]);
  });
});
