/**
 * Global test setup. Runs before every test file.
 *
 * NOTE ON LOCATION: this must live at src/setupTests.js. Create React App only
 * looks there. The repo previously had one at src/misc/setupTests.js, which CRA
 * never loaded -- so jest-dom's matchers were silently unavailable.
 *
 * What this file does:
 *   1. Loads jest-dom matchers.
 *   2. Routes both Firestore entry points to the in-memory fake, so no test can
 *      open a network connection or reach production data.
 *   3. Stubs Firebase Auth, whose real calls would hit the network.
 *   4. Freezes the wall clock so snapshots do not drift day to day.
 *
 * src/firebase/firebase.js is deliberately NOT mocked. It initialises fine under
 * the fake credentials in .env.test -- verified rather than assumed -- and
 * leaving it real means the app's own module graph is what gets tested.
 */

import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// 1. Firestore -> in-memory fake
// ---------------------------------------------------------------------------

// Both entry points, because the app imports from each: nine files use the lite
// SDK and seven the full one. Mocking only one would let real Firestore through.
// (Phase 8 collapses this to one; until then both must be covered.)
jest.mock("firebase/firestore", () => require("./test/fakeFirestore"));
jest.mock("firebase/firestore/lite", () => require("./test/fakeFirestore"));

// ---------------------------------------------------------------------------
// 2. Firebase Auth -> controllable stub
// ---------------------------------------------------------------------------

jest.mock("firebase/auth", () => require("./test/fakeAuth"));

// ---------------------------------------------------------------------------
// 3. Freeze the clock
// ---------------------------------------------------------------------------

/**
 * `new Date()` appears in 13 source files, including render paths: cadet service
 * lengths, the default year in Flight Points and PTS Tracker, and createdAt
 * stamps. Left alone, snapshots would drift every day and break outright on
 * 1 January.
 *
 * Only the clock is frozen -- setTimeout and friends are left real.
 * jest.useFakeTimers() would also replace the timer functions, which breaks
 * Testing Library's waitFor and user-event; Jest 27 (what CRA 5 ships) has no
 * `doNotFake` option to opt out. Replacing the Date constructor is the smaller
 * intervention and needs no cooperation from async utilities.
 *
 * Consequence to be aware of: this leaves two Date constructors alive, so
 * `instanceof Date` is unreliable for values built before setup ran. Use
 * `Object.prototype.toString.call(v) === "[object Date]"` instead. The fake's
 * clone() already does.
 */
const RealDate = Date;
const FROZEN_MS = RealDate.parse("2025-06-15T12:00:00.000Z");

class FrozenDate extends RealDate {
  constructor(...args) {
    // Only the no-argument form is frozen; explicit dates behave normally.
    if (args.length === 0) {
      super(FROZEN_MS);
    } else {
      super(...args);
    }
  }

  static now() {
    return FROZEN_MS;
  }
}

global.Date = FrozenDate;

// Exposed so tests can assert against the same instant without re-deriving it.
global.__FROZEN_NOW__ = new RealDate(FROZEN_MS);

// ---------------------------------------------------------------------------
// 4. Clean state between tests
// ---------------------------------------------------------------------------

// Done centrally so no test file has to remember it. State leaking between tests
// produces order-dependent failures, which are far more expensive to chase than
// the reset costs.
//
// These are the same module instances the jest.mock factories above return --
// Jest's registry hands back one instance per module per test file.
/* eslint-disable global-require */
beforeEach(() => {
  require("./test/fakeFirestore").__reset();
  require("./test/fakeAuth").__reset();
});
/* eslint-enable global-require */
