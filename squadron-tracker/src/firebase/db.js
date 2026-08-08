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

import * as liteSdk from "firebase/firestore/lite";
import { app } from "./firebase";

let sdk = liteSdk;
let offline = false;

/*
 * The NODE_ENV guard is load-bearing, not belt-and-braces.
 *
 * Webpack folds `process.env.NODE_ENV` to a literal at build time and then
 * skips dependencies inside provably-dead branches, so a production build
 * never even sees these requires. Written as a ternary
 * (`useFake ? require(...) : liteSdk`) the require is NOT eliminated -- that
 * was the first attempt, and it shipped the fake and both dummy squadrons to
 * users. Verified by grepping the built bundle; keep it in this shape.
 */
/* eslint-disable global-require */
if (process.env.NODE_ENV !== "production" && process.env.REACT_APP_USE_FAKE_DB === "true") {
  sdk = require("../test/fakeFirestore");
  const { dummyData } = require("../test/dummyData");
  sdk.__seed(dummyData);
  offline = true;
  // eslint-disable-next-line no-console
  console.info(
    "%c OFFLINE MODE ",
    "background:#d9534f;color:white;font-weight:bold",
    "Firestore is in-memory and seeded with dummy squadrons 9998/9999. " +
      "Nothing is saved; reloading resets everything."
  );
}
/* eslint-enable global-require */

export const isOfflineMode = offline;

/** The Firestore handle. Callers should not need to think about which SDK. */
export const db = () => (offline ? sdk.getFirestore() : sdk.getFirestore(app));

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
