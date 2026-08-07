/**
 * In-memory Firestore.
 *
 * Substituted for both `firebase/firestore` and `firebase/firestore/lite` in
 * tests, so nothing in the suite ever opens a network connection or can touch
 * production data.
 *
 * Scope is deliberately exactly what this app uses, verified by grep:
 *
 *   getFirestore  collection  doc  getDoc  getDocs  setDoc  updateDoc
 *   deleteDoc  query  where  writeBatch  arrayUnion
 *
 * No orderBy, limit, runTransaction, increment, addDoc, collectionGroup or
 * onSnapshot -- the app uses none of them. Anything unimplemented throws loudly
 * rather than silently returning nothing, so if the app grows a new call the
 * tests say so instead of quietly passing.
 *
 * Hand-rolled rather than using a library because the published Firestore mocks
 * are written against the v8 API and this app is on v11. Owning ~250 lines means
 * it cannot silently drift from what the app actually calls.
 *
 * Storage is a flat Map of full document path -> data, which is Firestore's own
 * model and exactly the shape of src/test/dummyData.js.
 */

const store = new Map();
const writeLog = [];
let autoIdCounter = 0;

// ---------------------------------------------------------------------------
// Test helpers (prefixed __ so they cannot collide with the real SDK surface)
// ---------------------------------------------------------------------------

/** Replace the store with `docs` (a path -> data map). Deep-cloned on the way in. */
export const __seed = (docs = {}) => {
  store.clear();
  Object.entries(docs).forEach(([path, data]) => {
    assertDocPath(path);
    store.set(path, clone(data));
  });
  writeLog.length = 0;
  autoIdCounter = 0;
};

/** Empty the store, the write log, and the auto-ID counter. */
export const __reset = () => {
  store.clear();
  writeLog.length = 0;
  autoIdCounter = 0;
};

/** Every write since the last seed/reset: [{ op, path, data }]. */
export const __writes = () => clone(writeLog);

/** Current contents as a plain path -> data object, for assertions. */
export const __store = () => Object.fromEntries([...store.entries()].map(([k, v]) => [k, clone(v)]));

/** Read one document directly, bypassing the SDK surface. */
export const __get = (path) => (store.has(path) ? clone(store.get(path)) : undefined);

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// Timestamps and Dates must survive cloning intact; structuredClone handles
// Date, and our Timestamp stand-ins carry a method so are passed by reference.
const clone = (value) => {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value.toDate === "function") return value; // Timestamp-like: keep identity
  if (Array.isArray(value)) return value.map(clone);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
};

/** "A/b/C/d" -> ["A","b","C","d"], tolerating segments that contain slashes. */
const segmentsOf = (parts) =>
  parts
    .flatMap((p) => String(p).split("/"))
    .filter((s) => s.length > 0);

const assertDocPath = (path) => {
  const n = segmentsOf([path]).length;
  if (n % 2 !== 0) {
    throw new Error(`Not a document path (needs an even number of segments): "${path}"`);
  }
};

const assertCollectionPath = (path) => {
  const n = segmentsOf([path]).length;
  if (n % 2 === 0) {
    throw new Error(`Not a collection path (needs an odd number of segments): "${path}"`);
  }
};

const isRef = (v, type) => v && typeof v === "object" && v.__ref === type;

/** Documents directly inside `collectionPath` -- not those in its subcollections. */
const childrenOf = (collectionPath) => {
  const prefix = `${collectionPath}/`;
  const out = [];
  store.forEach((data, path) => {
    if (!path.startsWith(prefix)) return;
    if (path.slice(prefix.length).includes("/")) return;
    out.push({ path, data });
  });
  return out;
};

const record = (op, path, data) => writeLog.push({ op, path, data: clone(data) });

// -- sentinels --------------------------------------------------------------

const ARRAY_UNION = Symbol("arrayUnion");

/** Resolve field sentinels against the document's existing value. */
const applyFieldValue = (incoming, existing) => {
  if (incoming && incoming.__sentinel === ARRAY_UNION) {
    const base = Array.isArray(existing) ? existing : [];
    const added = incoming.values.filter((v) => !base.includes(v));
    return [...base, ...added];
  }
  return incoming;
};

const mergeFields = (target, updates) => {
  const next = { ...target };
  Object.entries(updates).forEach(([key, value]) => {
    if (key.includes(".")) {
      // Real Firestore treats dots as nested field paths. The app never uses
      // them, so rather than half-implement it, refuse.
      throw new Error(`fakeFirestore: dotted field paths are not supported ("${key}")`);
    }
    next[key] = applyFieldValue(value, target[key]);
  });
  return next;
};

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

const docSnapshot = (path, data) => ({
  id: segmentsOf([path]).pop(),
  ref: makeDocRef(path),
  exists: () => data !== undefined,
  data: () => (data === undefined ? undefined : clone(data)),
});

const querySnapshot = (rows) => {
  const docs = rows.map(({ path, data }) => docSnapshot(path, data));
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (fn) => docs.forEach(fn),
  };
};

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------

const makeDocRef = (path) => ({
  __ref: "doc",
  path,
  id: segmentsOf([path]).pop(),
  get parent() {
    const parts = segmentsOf([path]);
    return makeCollectionRef(parts.slice(0, -1).join("/"));
  },
});

const makeCollectionRef = (path) => ({
  __ref: "collection",
  path,
  id: segmentsOf([path]).pop(),
});

// ---------------------------------------------------------------------------
// Public API -- mirrors firebase/firestore
// ---------------------------------------------------------------------------

export const getFirestore = () => ({ __ref: "db" });

/**
 * collection(db, "A", "b", "C")  and  collection(parentDocRef, "C").
 */
export const collection = (parent, ...segments) => {
  if (segments.length === 0) {
    throw new Error("collection() needs at least one path segment");
  }
  const base = isRef(parent, "doc") ? [parent.path] : [];
  const path = segmentsOf([...base, ...segments]).join("/");
  assertCollectionPath(path);
  return makeCollectionRef(path);
};

/**
 * doc(collectionRef)          -> new document with a generated id
 * doc(collectionRef, "id")    -> that document
 * doc(db, "A", "b", "C", "d") -> that document
 */
export const doc = (parent, ...segments) => {
  if (isRef(parent, "collection")) {
    const id = segments.length ? segmentsOf(segments).join("/") : `auto-${++autoIdCounter}`;
    const path = `${parent.path}/${id}`;
    assertDocPath(path);
    return makeDocRef(path);
  }
  const path = segmentsOf(segments).join("/");
  assertDocPath(path);
  return makeDocRef(path);
};

export const getDoc = async (ref) => {
  if (!isRef(ref, "doc")) throw new Error("getDoc() expects a document reference");
  return docSnapshot(ref.path, store.get(ref.path));
};

export const getDocs = async (target) => {
  if (isRef(target, "collection")) return querySnapshot(childrenOf(target.path));
  if (target && target.__ref === "query") {
    const rows = childrenOf(target.path).filter(({ data }) =>
      target.constraints.every(({ field, op, value }) => {
        if (op !== "==") {
          throw new Error(`fakeFirestore: only "==" is supported in where(), got "${op}"`);
        }
        return data[field] === value;
      })
    );
    return querySnapshot(rows);
  }
  throw new Error("getDocs() expects a collection reference or a query");
};

export const setDoc = async (ref, data, options = {}) => {
  if (!isRef(ref, "doc")) throw new Error("setDoc() expects a document reference");
  const existing = store.get(ref.path);
  const next = options.merge && existing ? mergeFields(existing, data) : clone(data);
  store.set(ref.path, next);
  record("set", ref.path, data);
};

export const updateDoc = async (ref, data) => {
  if (!isRef(ref, "doc")) throw new Error("updateDoc() expects a document reference");
  const existing = store.get(ref.path);
  if (existing === undefined) {
    // Matches real Firestore, which rejects rather than creating the document.
    throw new Error(`No document to update: ${ref.path}`);
  }
  store.set(ref.path, mergeFields(existing, data));
  record("update", ref.path, data);
};

export const deleteDoc = async (ref) => {
  if (!isRef(ref, "doc")) throw new Error("deleteDoc() expects a document reference");
  store.delete(ref.path);
  record("delete", ref.path, undefined);
};

export const query = (collectionRef, ...constraints) => {
  if (!isRef(collectionRef, "collection")) throw new Error("query() expects a collection reference");
  constraints.forEach((c) => {
    if (!c || c.__constraint !== "where") {
      throw new Error("fakeFirestore: only where() constraints are supported");
    }
  });
  return { __ref: "query", path: collectionRef.path, constraints };
};

export const where = (field, op, value) => ({ __constraint: "where", field, op, value });

export const arrayUnion = (...values) => ({ __sentinel: ARRAY_UNION, values });

export const writeBatch = () => {
  const queued = [];
  const batch = {
    set: (ref, data, options) => (queued.push(() => setDoc(ref, data, options)), batch),
    update: (ref, data) => (queued.push(() => updateDoc(ref, data)), batch),
    delete: (ref) => (queued.push(() => deleteDoc(ref)), batch),
    commit: async () => {
      for (const op of queued) await op();
      queued.length = 0;
    },
  };
  return batch;
};

/** Not imported anywhere in the app today, but cheap to keep faithful. */
export class Timestamp {
  constructor(seconds, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  static fromDate(date) {
    return new Timestamp(Math.floor(date.getTime() / 1000), (date.getTime() % 1000) * 1e6);
  }
  static now() {
    return Timestamp.fromDate(new Date());
  }
  toDate() {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1e6);
  }
}

// -- Deliberately unimplemented ---------------------------------------------
// Throwing beats returning undefined: if the app starts using one of these, a
// test fails with the reason instead of passing against a silent no-op.

const unsupported = (name) => () => {
  throw new Error(
    `fakeFirestore: ${name}() is not implemented. The app did not use it when the fake ` +
      `was written -- implement it here (and test it) before using it.`
  );
};

export const onSnapshot = unsupported("onSnapshot");
export const orderBy = unsupported("orderBy");
export const limit = unsupported("limit");
export const addDoc = unsupported("addDoc");
export const increment = unsupported("increment");
export const runTransaction = unsupported("runTransaction");
export const collectionGroup = unsupported("collectionGroup");
export const serverTimestamp = unsupported("serverTimestamp");
export const arrayRemove = unsupported("arrayRemove");
export const deleteField = unsupported("deleteField");
export const connectFirestoreEmulator = unsupported("connectFirestoreEmulator");
