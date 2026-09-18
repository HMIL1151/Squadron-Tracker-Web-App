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
  /*
   * The dev squadron is the test fixture plus a realistic bulk of cadets and
   * several years of records. Layered rather than merged into dummyData,
   * because that file is the test fixture and nearly every value in it is
   * load-bearing -- but ten cadets and one year of history is not enough to
   * judge a table, a year filter or a year-on-year comparison on.
   */
  /*
   * `?data=fixture` pins the seed to the small, deliberate test fixture.
   *
   * The screenshot suite uses it. Those baselines have to photograph a dataset
   * that does not move, and a full-page shot of forty cadets and a thousand
   * records is both enormous and invalidated by any tweak to the generator --
   * so the visual tests get the ten cadets whose every value means something,
   * and a person opening the dev server gets a squadron that looks like one.
   */
  let useFixtureOnly = false;
  try {
    useFixtureOnly = new URLSearchParams(window.location.search).get("data") === "fixture";
  } catch {
    // No URLSearchParams, or no window. The full dev squadron is the default.
  }

  if (useFixtureOnly) {
    sdk.__seed(dummyData);
  } else {
    const { buildDevSquadron } = await import("../test/devDataset");
    sdk.__seed({ ...dummyData, ...buildDevSquadron() });
  }
  // eslint-disable-next-line no-console
  console.info(
    "%c OFFLINE MODE ",
    "background:#d9534f;color:white;font-weight:bold",
    "Firestore is in-memory and seeded with dummy squadrons 9998/9999. " +
      "9999 carries a full-size squadron for dev; nothing is saved, and " +
      "reloading resets everything."
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
