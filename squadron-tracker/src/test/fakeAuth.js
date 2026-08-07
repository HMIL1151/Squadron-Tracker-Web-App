/**
 * Stub for `firebase/auth`.
 *
 * The real module opens popups and network connections, neither of which a test
 * can do. Scope is exactly what the app imports:
 *
 *   getAuth  GoogleAuthProvider  signInWithPopup  signOut  onAuthStateChanged
 *
 * Sign-in is scripted rather than simulated: a test says who signs in next with
 * __setNextUser(), then triggers the UI. Anything unimplemented throws, so a new
 * auth call surfaces as a failure rather than a silent undefined.
 */

let currentUser = null;
let nextUser = null;
let nextError = null;
const listeners = new Set();
const calls = [];

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Who signInWithPopup() will return. Pass a user-shaped object. */
export const __setNextUser = (user) => {
  nextUser = user;
  nextError = null;
};

/** Make the next signInWithPopup() reject, for the error-path tests. */
export const __setNextError = (error) => {
  nextError = error instanceof Error ? error : new Error(String(error));
  nextUser = null;
};

/** Who is currently signed in, as the app sees it. */
export const __currentUser = () => currentUser;

/** Sign someone in without going through the UI, and notify listeners. */
export const __signIn = (user) => {
  currentUser = user;
  listeners.forEach((fn) => fn(user));
};

/** Every auth call made since the last reset: [{ fn, args }]. */
export const __calls = () => [...calls];

export const __reset = () => {
  currentUser = null;
  nextUser = null;
  nextError = null;
  listeners.clear();
  calls.length = 0;
};

const record = (fn, ...args) => calls.push({ fn, args });

// ---------------------------------------------------------------------------
// Public API -- mirrors firebase/auth
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
  record("signInWithPopup");
  if (nextError) {
    const err = nextError;
    nextError = null;
    throw err;
  }
  if (!nextUser) {
    throw new Error(
      "fakeAuth: signInWithPopup() called with no scripted result. " +
        "Call __setNextUser(user) or __setNextError(err) first."
    );
  }
  currentUser = nextUser;
  nextUser = null;
  listeners.forEach((fn) => fn(currentUser));
  return { user: currentUser };
};

export const signOut = async () => {
  record("signOut");
  currentUser = null;
  listeners.forEach((fn) => fn(null));
};

export const onAuthStateChanged = (auth, callback) => {
  record("onAuthStateChanged");
  listeners.add(callback);
  // Real Firebase fires once with the current state on subscribe.
  callback(currentUser);
  return () => listeners.delete(callback);
};

const unsupported = (name) => () => {
  throw new Error(
    `fakeAuth: ${name}() is not implemented. The app did not use it when the ` +
      `stub was written -- implement it here (and test it) before using it.`
  );
};

export const signInWithEmailAndPassword = unsupported("signInWithEmailAndPassword");
export const createUserWithEmailAndPassword = unsupported("createUserWithEmailAndPassword");
export const signInWithRedirect = unsupported("signInWithRedirect");
export const getRedirectResult = unsupported("getRedirectResult");
export const connectAuthEmulator = unsupported("connectAuthEmulator");
