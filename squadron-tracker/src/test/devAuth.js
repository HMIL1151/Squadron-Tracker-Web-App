/**
 * Stand-in for `firebase/auth`, used ONLY by `npm run dev:offline`.
 *
 * Why this exists: offline mode replaced Firestore with the in-memory fake, but
 * left Auth real. So the app booted with a seeded dummy database and then asked
 * you to sign in with Google -- which needs a network, a real Firebase project,
 * and gives you your real uid. That uid is not in the fixture, so `checkUserRole`
 * returned "First Login" and you landed on the request-access screen. The dummy
 * squadrons were loaded and unreachable.
 *
 * Signing in here returns a fixture user instead, so the app's own login path
 * runs unchanged -- checkUserRole, the squadron lookup, the role lookup, the
 * bulk data fetch -- just against the fake.
 *
 * Pick who you are with a query parameter:
 *
 *   /?as=admin      squadron 9999 Faketon, admin       (default)
 *   /?as=user       squadron 9999 Faketon, non-admin
 *   /?as=legacy     squadron 9998 Testwood, admin      (legacy string[] flights)
 *   /?as=sysadmin   system admin
 *   /?as=new        signed in, authorised for nothing  (first-login flow)
 *
 * This file is wired in by a resolve alias in vite.config.js, exactly as the
 * Firestore fake is, and for the same reason: a production build has no
 * reference to it to eliminate, rather than a dead branch to be trusted.
 */

import { UIDS } from "./dummyData";

/*
 * displayName is load-bearing, not decoration.
 *
 * WelcomePage's navigateToMainContent looks the signed-in user up in
 * AuthorisedUsers by displayName -- not by uid -- to decide whether they are an
 * admin. These strings must therefore match the AuthorisedUsers documents in
 * dummyData exactly, or every persona silently arrives as a non-admin.
 */
export const PERSONAS = {
  admin: {
    uid: UIDS.faketonAdmin,
    displayName: "Admin User",
    email: "admin@faketon.test",
    describe: "squadron 9999 Faketon, admin",
  },
  user: {
    uid: UIDS.faketonUser,
    displayName: "Plain User",
    email: "user@faketon.test",
    describe: "squadron 9999 Faketon, non-admin",
  },
  legacy: {
    uid: UIDS.testwoodAdmin,
    displayName: "Testwood Admin",
    email: "admin@testwood.test",
    describe: "squadron 9998 Testwood, admin, legacy string[] flights",
  },
  sysadmin: {
    uid: UIDS.systemAdmin,
    displayName: "System Admin",
    email: "sysadmin@example.test",
    describe: "system admin",
  },
  new: {
    uid: UIDS.stranger,
    displayName: "New Person",
    email: "new@example.test",
    describe: "signed in, authorised for nothing -- first-login flow",
  },
};

export const DEFAULT_PERSONA = "admin";

/** Read `?as=` from a search string. Unknown or absent falls back to the default. */
export const resolvePersonaKey = (search = "") => {
  const requested = new URLSearchParams(search).get("as");
  if (!requested) return DEFAULT_PERSONA;
  if (!PERSONAS[requested]) {
    // eslint-disable-next-line no-console
    console.warn(
      `devAuth: unknown persona "${requested}". Valid: ${Object.keys(PERSONAS).join(", ")}. ` +
        `Falling back to "${DEFAULT_PERSONA}".`
    );
    return DEFAULT_PERSONA;
  }
  return requested;
};

/** The fixture user a given persona signs in as. */
export const personaUser = (key) => {
  const { uid, displayName, email } = PERSONAS[key];
  // Shaped like a Firebase User to the extent the app touches one: it reads
  // uid, displayName and email off the result of signInWithPopup and nothing else.
  return { uid, displayName, email, providerId: "google.com" };
};

const search = typeof window === "undefined" ? "" : window.location.search;
const personaKey = resolvePersonaKey(search);

let currentUser = null;

const banner = () => {
  const lines = Object.entries(PERSONAS)
    .map(([key, p]) => `  ?as=${key.padEnd(9)} ${p.describe}`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.info(
    `%c OFFLINE AUTH %c signing in as "${personaKey}" (${PERSONAS[personaKey].describe})\n\n` +
      `Sign in with Google returns a fixture user -- no popup, no network.\n` +
      `Switch by changing the URL:\n${lines}\n`,
    "background:#0275d8;color:white;font-weight:bold",
    ""
  );
};

// jsdom has a window too, and the banner is noise in test output. Only the
// browser gets it.
if (typeof window !== "undefined" && import.meta.env?.MODE !== "test") banner();

// ---------------------------------------------------------------------------
// The firebase/auth surface the app imports
// ---------------------------------------------------------------------------

const authInstance = {
  get currentUser() {
    return currentUser;
  },
};

export const getAuth = () => authInstance;

export class GoogleAuthProvider {
  constructor() {
    this.providerId = "google.com";
  }
}

export const signInWithPopup = async () => {
  currentUser = personaUser(personaKey);
  return { user: currentUser };
};

export const signOut = async () => {
  currentUser = null;
};

export const onAuthStateChanged = (auth, callback) => {
  callback(currentUser);
  return () => {};
};

/*
 * Anything else throws rather than returning undefined. Offline mode is for
 * clicking through the app; a silently-missing auth call would look like an app
 * bug when it is really a hole in this stub.
 */
const unsupported = (name) => () => {
  throw new Error(
    `devAuth: ${name}() is not implemented. Offline mode only stubs what the app ` +
      `uses -- add it here if the app starts calling it.`
  );
};

export const signInWithEmailAndPassword = unsupported("signInWithEmailAndPassword");
export const createUserWithEmailAndPassword = unsupported("createUserWithEmailAndPassword");
export const signInWithRedirect = unsupported("signInWithRedirect");
export const getRedirectResult = unsupported("getRedirectResult");
export const connectAuthEmulator = unsupported("connectAuthEmulator");
