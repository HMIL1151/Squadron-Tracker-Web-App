/**
 * Tests for the fake itself.
 *
 * The whole suite trusts this module, so it has to be trustworthy. An untested
 * fake that quietly diverges from real Firestore produces green tests over
 * broken code -- the exact failure mode the test suite exists to prevent.
 *
 * Each assertion below mirrors a real Firestore behaviour the app depends on.
 */

import {
  __seed,
  __reset,
  __writes,
  __store,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from "./fakeFirestore";

const db = getFirestore();

beforeEach(() => __reset());

describe("path handling", () => {
  it("builds a collection path from segments", () => {
    expect(collection(db, "SquadronDatabases", "9999", "Cadets").path).toBe(
      "SquadronDatabases/9999/Cadets"
    );
  });

  it("builds a subcollection from a parent document reference", () => {
    // WelcomePage and SystemAdminDashboard both use collection(docRef, "name").
    const parent = doc(db, "SquadronDatabases", "9999");
    expect(collection(parent, "AuthorisedUsers").path).toBe(
      "SquadronDatabases/9999/AuthorisedUsers"
    );
  });

  it("rejects an even number of segments for a collection", () => {
    expect(() => collection(db, "SquadronDatabases", "9999")).toThrow(/not a collection path/i);
  });

  it("rejects an odd number of segments for a document", () => {
    expect(() => doc(db, "SquadronDatabases", "9999", "Cadets")).toThrow(/not a document path/i);
  });
});

describe("auto-generated ids", () => {
  it("generates an id when doc() is called on a collection with no id", () => {
    // The app relies on this in eight places, e.g. saving a new event.
    const ref = doc(collection(db, "MassUserList"));
    expect(ref.id).toBe("auto-1");
    expect(ref.path).toBe("MassUserList/auto-1");
  });

  it("counts deterministically so snapshots stay stable", () => {
    const a = doc(collection(db, "MassUserList"));
    const b = doc(collection(db, "MassUserList"));
    expect([a.id, b.id]).toEqual(["auto-1", "auto-2"]);
  });

  it("restarts the counter on reset", () => {
    doc(collection(db, "MassUserList"));
    __reset();
    expect(doc(collection(db, "MassUserList")).id).toBe("auto-1");
  });
});

describe("reads", () => {
  beforeEach(() =>
    __seed({
      "SquadronDatabases/9999/Cadets/c1": { forename: "Amelia", flight: 2 },
      "SquadronDatabases/9999/Cadets/c2": { forename: "Ben", flight: 3 },
      // A document one level deeper -- must not leak into the Cadets listing.
      "SquadronDatabases/9999/Cadets/c1/Notes/n1": { text: "nested" },
      "SquadronDatabases/9998/Cadets/c9": { forename: "Katie", flight: 2 },
    })
  );

  it("returns exists() false and undefined data for a missing document", () => {
    const snap = { ...{} };
    return getDoc(doc(db, "SquadronDatabases", "9999", "Cadets", "nope")).then((s) => {
      expect(s.exists()).toBe(false);
      expect(s.data()).toBeUndefined();
      expect(snap).toEqual({});
    });
  });

  it("reads a document that exists", async () => {
    const snap = await getDoc(doc(db, "SquadronDatabases", "9999", "Cadets", "c1"));
    expect(snap.exists()).toBe(true);
    expect(snap.id).toBe("c1");
    expect(snap.data()).toEqual({ forename: "Amelia", flight: 2 });
  });

  it("lists only direct children of a collection", async () => {
    const snap = await getDocs(collection(db, "SquadronDatabases", "9999", "Cadets"));
    expect(snap.docs.map((d) => d.id)).toEqual(["c1", "c2"]);
    expect(snap.size).toBe(2);
    expect(snap.empty).toBe(false);
  });

  it("keeps squadrons isolated by path", async () => {
    const snap = await getDocs(collection(db, "SquadronDatabases", "9998", "Cadets"));
    expect(snap.docs.map((d) => d.id)).toEqual(["c9"]);
  });

  it("reports empty for a collection with no documents", async () => {
    const snap = await getDocs(collection(db, "Nothing"));
    expect(snap.empty).toBe(true);
    expect(snap.docs).toEqual([]);
  });

  it("supports forEach, which the app uses on query results", async () => {
    const seen = [];
    const snap = await getDocs(collection(db, "SquadronDatabases", "9999", "Cadets"));
    snap.forEach((d) => seen.push(d.data().forename));
    expect(seen).toEqual(["Amelia", "Ben"]);
  });

  it("returns cloned data so callers cannot mutate the store", async () => {
    const snap = await getDoc(doc(db, "SquadronDatabases", "9999", "Cadets", "c1"));
    snap.data().forename = "Mutated";
    const again = await getDoc(doc(db, "SquadronDatabases", "9999", "Cadets", "c1"));
    expect(again.data().forename).toBe("Amelia");
  });
});

describe("queries", () => {
  beforeEach(() =>
    __seed({
      "MassUserList/m1": { UID: "uid-a", Squadron: 9999 },
      "MassUserList/m2": { UID: "uid-b", Squadron: 9998 },
      "MassUserList/m3": { UID: "uid-a", systemAdmin: true },
    })
  );

  it("filters on equality", async () => {
    const snap = await getDocs(query(collection(db, "MassUserList"), where("UID", "==", "uid-a")));
    expect(snap.docs.map((d) => d.id)).toEqual(["m1", "m3"]);
  });

  it("returns empty when nothing matches", async () => {
    const snap = await getDocs(query(collection(db, "MassUserList"), where("UID", "==", "nope")));
    expect(snap.empty).toBe(true);
  });

  it("applies multiple constraints as AND", async () => {
    const snap = await getDocs(
      query(collection(db, "MassUserList"), where("UID", "==", "uid-a"), where("Squadron", "==", 9999))
    );
    expect(snap.docs.map((d) => d.id)).toEqual(["m1"]);
  });

  it("compares strictly, so 9999 does not match \"9999\"", async () => {
    // Squadron numbers move between string and number all over this app, so a
    // loose comparison here would hide real bugs.
    const snap = await getDocs(query(collection(db, "MassUserList"), where("Squadron", "==", "9999")));
    expect(snap.empty).toBe(true);
  });

  it("refuses operators it does not implement", async () => {
    await expect(
      getDocs(query(collection(db, "MassUserList"), where("Squadron", ">", 1)))
    ).rejects.toThrow(/only "==" is supported/);
  });
});

describe("writes", () => {
  it("setDoc creates a document", async () => {
    await setDoc(doc(db, "A", "one"), { n: 1 });
    expect(__store()["A/one"]).toEqual({ n: 1 });
  });

  it("setDoc replaces wholesale rather than merging", async () => {
    __seed({ "A/one": { n: 1, keep: "no" } });
    await setDoc(doc(db, "A", "one"), { n: 2 });
    expect(__store()["A/one"]).toEqual({ n: 2 });
  });

  it("setDoc with merge keeps existing fields", async () => {
    __seed({ "A/one": { n: 1, keep: "yes" } });
    await setDoc(doc(db, "A", "one"), { n: 2 }, { merge: true });
    expect(__store()["A/one"]).toEqual({ n: 2, keep: "yes" });
  });

  it("updateDoc merges into an existing document", async () => {
    __seed({ "A/one": { n: 1, keep: "yes" } });
    await updateDoc(doc(db, "A", "one"), { n: 2 });
    expect(__store()["A/one"]).toEqual({ n: 2, keep: "yes" });
  });

  it("updateDoc rejects when the document is missing", async () => {
    // Real Firestore rejects rather than creating. AdminDashboard and
    // AddBadgePoints both depend on that, so the fake must too.
    await expect(updateDoc(doc(db, "A", "missing"), { n: 1 })).rejects.toThrow(/no document to update/i);
  });

  it("deleteDoc removes a document", async () => {
    __seed({ "A/one": { n: 1 } });
    await deleteDoc(doc(db, "A", "one"));
    expect(__store()["A/one"]).toBeUndefined();
  });

  it("deleting a document that does not exist is not an error", async () => {
    await expect(deleteDoc(doc(db, "A", "missing"))).resolves.toBeUndefined();
  });

  it("does not support dotted field paths, and says so", async () => {
    __seed({ "A/one": { nested: { n: 1 } } });
    await expect(updateDoc(doc(db, "A", "one"), { "nested.n": 2 })).rejects.toThrow(
      /dotted field paths are not supported/
    );
  });
});

describe("arrayUnion", () => {
  it("appends to an existing array", async () => {
    // addEntry.js adds badge types and special awards this way.
    __seed({ "A/one": { list: ["a"] } });
    await updateDoc(doc(db, "A", "one"), { list: arrayUnion("b") });
    expect(__store()["A/one"].list).toEqual(["a", "b"]);
  });

  it("does not add a duplicate", async () => {
    __seed({ "A/one": { list: ["a"] } });
    await updateDoc(doc(db, "A", "one"), { list: arrayUnion("a") });
    expect(__store()["A/one"].list).toEqual(["a"]);
  });

  it("creates the array when the field is absent", async () => {
    __seed({ "A/one": {} });
    await updateDoc(doc(db, "A", "one"), { list: arrayUnion("a") });
    expect(__store()["A/one"].list).toEqual(["a"]);
  });
});

describe("writeBatch", () => {
  it("applies nothing until commit", async () => {
    const batch = writeBatch(db);
    batch.set(doc(db, "A", "one"), { n: 1 });
    expect(__store()["A/one"]).toBeUndefined();
    await batch.commit();
    expect(__store()["A/one"]).toEqual({ n: 1 });
  });

  it("applies set, update and delete together", async () => {
    __seed({ "A/two": { n: 2 }, "A/three": { n: 3 } });
    const batch = writeBatch(db);
    batch.set(doc(db, "A", "one"), { n: 1 });
    batch.update(doc(db, "A", "two"), { n: 22 });
    batch.delete(doc(db, "A", "three"));
    await batch.commit();

    const store = __store();
    expect(store["A/one"]).toEqual({ n: 1 });
    expect(store["A/two"]).toEqual({ n: 22 });
    expect(store["A/three"]).toBeUndefined();
  });
});

describe("write log", () => {
  it("records each write with its path and payload", async () => {
    await setDoc(doc(db, "A", "one"), { n: 1 });
    await updateDoc(doc(db, "A", "one"), { n: 2 });
    await deleteDoc(doc(db, "A", "one"));

    expect(__writes()).toEqual([
      { op: "set", path: "A/one", data: { n: 1 } },
      { op: "update", path: "A/one", data: { n: 2 } },
      { op: "delete", path: "A/one", data: undefined },
    ]);
  });

  it("does not record reads", async () => {
    __seed({ "A/one": { n: 1 } });
    await getDoc(doc(db, "A", "one"));
    await getDocs(collection(db, "A"));
    expect(__writes()).toEqual([]);
  });

  it("is cleared by seeding", async () => {
    await setDoc(doc(db, "A", "one"), { n: 1 });
    __seed({});
    expect(__writes()).toEqual([]);
  });
});

describe("Timestamp", () => {
  it("round-trips through a Date", () => {
    const date = new Date("2025-06-15T12:00:00Z");
    expect(Timestamp.fromDate(date).toDate().toISOString()).toBe(date.toISOString());
  });

  it("survives storage with toDate() intact", async () => {
    // firestoreUtils.fetchTeamPoints branches on typeof LastLoginDate.toDate.
    await setDoc(doc(db, "A", "one"), { at: Timestamp.fromDate(new Date("2025-01-01T00:00:00Z")) });
    const snap = await getDoc(doc(db, "A", "one"));
    expect(typeof snap.data().at.toDate).toBe("function");
    expect(snap.data().at.toDate().getUTCFullYear()).toBe(2025);
  });

  it("keeps a plain Date as a Date", async () => {
    // EventDetailsPopup handles both Timestamp and plain Date createdAt values.
    await setDoc(doc(db, "A", "one"), { at: new Date("2025-01-30T18:30:00Z") });
    const snap = await getDoc(doc(db, "A", "one"));
    expect(Object.prototype.toString.call(snap.data().at)).toBe("[object Date]");
    expect(snap.data().at.toISOString()).toBe("2025-01-30T18:30:00.000Z");
  });

  it("preserves a Date built by a different Date constructor", async () => {
    // setupTests.js freezes the clock by replacing global.Date with a subclass.
    // That leaves two Date constructors alive, and a value from the original is
    // not `instanceof` the replacement. An instanceof-based clone would treat it
    // as a plain object and flatten it to {} -- silent corruption. Reproduced
    // here by swapping the global mid-test.
    const Real = Date;
    class Frozen extends Real {}
    const built = new Real("2024-03-01T00:00:00Z");

    global.Date = Frozen;
    try {
      expect(built instanceof Date).toBe(false); // the trap this guards against

      await setDoc(doc(db, "A", "one"), { at: built });
      const snap = await getDoc(doc(db, "A", "one"));

      expect(Object.prototype.toString.call(snap.data().at)).toBe("[object Date]");
      expect(snap.data().at.toISOString()).toBe("2024-03-01T00:00:00.000Z");
    } finally {
      global.Date = Real;
    }
  });
});

describe("unimplemented APIs", () => {
  it("throw with a useful message instead of silently doing nothing", () => {
    // If the app grows a realtime listener, a test should say so rather than
    // pass against a no-op.
    expect(() => onSnapshot()).toThrow(/not implemented/);
  });
});
