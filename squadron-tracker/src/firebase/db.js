/**
 * The one place the app talks to Firestore.
 *
 * Everything under src/firebase/ imports its Firestore primitives from here
 * rather than from the SDK directly, for two reasons:
 *
 *   1. One SDK. The app previously imported from both `firebase/firestore` and
 *      `firebase/firestore/lite`, so both shipped in the bundle. There are no
 *      onSnapshot listeners anywhere -- every read is a one-shot fetch -- so
 *      the lite SDK covers the entire surface and is considerably smaller.
 *
 *   2. One switch for offline mode. `npm run dev:offline` sets
 *      REACT_APP_USE_FAKE_DB, and everything downstream transparently talks to
 *      the in-memory fake instead. That makes it possible to click through the
 *      whole app, seeded with a dummy squadron, with no Firebase project, no
 *      credentials and no risk of touching production data.
 */

import * as sdk from "firebase/firestore/lite";
import { app } from "./firebase";

/*
 * How offline mode is wired.
 *
 * The import above is unconditional and always says `firebase/firestore/lite`.
 * When REACT_APP_USE_FAKE_DB is set, vite.config.js ALIASES that specifier to
 * src/test/fakeFirestore.js, so this module transparently gets the fake with
 * no branch here at all.
 *
 * That is deliberate. The first attempt did the swap at runtime with a
 * conditional require(), and under webpack the require was not eliminated: the
 * fake and both dummy squadrons shipped to users. Doing it in resolution
 * rather than in code makes leaking structurally impossible -- a production
 * build has no reference to the fake to eliminate in the first place. Verified
 * by grepping the built bundle either way.
 *
 * Seeding is top-level await so the database is populated before any consumer
 * can read from it. Guarded on PROD, so Rollup drops the dynamic import.
 */
const offline = !import.meta.env.PROD && import.meta.env.REACT_APP_USE_FAKE_DB === "true";

if (offline && typeof sdk.__seed === "function") {
  const { dummyData } = await import("../test/dummyData");
  sdk.__seed(dummyData);
  // eslint-disable-next-line no-console
  console.info(
    "%c OFFLINE MODE ",
    "background:#d9534f;color:white;font-weight:bold",
    "Firestore is in-memory and seeded with dummy squadrons 9998/9999. " +
      "Nothing is saved; reloading resets everything."
  );
}

export const isOfflineMode = offline;

/** The Firestore handle. Callers should not need to think about which SDK. */
export const db = () => (offline ? sdk.getFirestore() : sdk.getFirestore(app));

// Re-exported so tests can drive the fake without reaching around this module.
export const __sdk = sdk;

// Re-exported primitives, so no module outside src/firebase/ imports the SDK.
export const {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  arrayUnion,
  deleteField,
} = sdk;

// -- Path helpers -----------------------------------------------------------
// Squadron paths were built by hand in sixteen files, each doing its own
// `squadronNumber.toString()`. Building them here means a collection can be
// renamed in one place.

export const squadronPath = (squadronNumber) => ["SquadronDatabases", String(squadronNumber)];

export const squadronCollection = (squadronNumber, name) =>
  collection(db(), ...squadronPath(squadronNumber), name);

export const squadronDoc = (squadronNumber, name, id) =>
  doc(db(), ...squadronPath(squadronNumber), name, id);

/** A new document reference with a generated id, in a squadron subcollection. */
export const newSquadronDoc = (squadronNumber, name) =>
  doc(squadronCollection(squadronNumber, name));
