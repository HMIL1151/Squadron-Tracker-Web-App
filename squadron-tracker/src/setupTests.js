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

// The timezone is pinned to UTC in src/test/globalSetup.js, which has to run
// before workers spawn -- an assignment here would be too late, because imports
// hoist above it.

import { beforeEach, vi } from "vitest";
import "@testing-library/jest-dom";
import ReactModal from "react-modal";

import * as fakeFirestore from "./test/fakeFirestore";
import * as fakeAuth from "./test/fakeAuth";

/*
 * `jest` -> `vi`.
 *
 * The suite was written against Jest and its API is close enough to Vitest's
 * that aliasing the global was far cheaper, and far less risky, than rewriting
 * ~490 tests. jest.mock, jest.fn, jest.unmock and jest.resetModules all exist
 * on `vi` with the same signatures.
 *
 * NOT everything maps: `vi.setTimeout` does not exist, and call sites were
 * changed to `vi.setConfig({ testTimeout, hookTimeout })`. Anything else that
 * fails with "is not a function" needs the same treatment rather than a
 * wrapper here -- a shim would hide which Jest APIs the suite still leans on.
 *
 * Note jest.mock/jest.unmock calls are hoisted by Vitest's transform the same
 * way Jest hoists them, so this alias does not change when they run.
 */
globalThis.jest = vi;

// ---------------------------------------------------------------------------
// 1. Firestore -> in-memory fake
// ---------------------------------------------------------------------------

// Both entry points, because the app imports from each: nine files use the lite
// SDK and seven the full one. Mocking only one would let real Firestore through.
// (Phase 8 collapses this to one; until then both must be covered.)
vi.mock("firebase/firestore", () => import("./test/fakeFirestore"));
vi.mock("firebase/firestore/lite", () => import("./test/fakeFirestore"));

// ---------------------------------------------------------------------------
// 2. Firebase Auth -> controllable stub
// ---------------------------------------------------------------------------

vi.mock("firebase/auth", () => import("./test/fakeAuth"));

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
// 4. Browser APIs jsdom does not implement
// ---------------------------------------------------------------------------

// ClassificationDashboard's GraphContainer observes its own size, and Chart.js
// measures its canvas. jsdom provides neither, so both need a stand-in. These
// are inert: nothing under test depends on a resize actually firing or on real
// canvas output, only on the components mounting without throwing.
if (typeof global.ResizeObserver === "undefined") {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof HTMLCanvasElement !== "undefined" && !HTMLCanvasElement.prototype.getContext.__stubbed) {
  const stub = () => ({
    canvas: { width: 0, height: 0 },
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => ({ data: [] }),
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    measureText: () => ({ width: 0 }),
    fillText: () => {},
    strokeText: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    setLineDash: () => {},
    getLineDash: () => [],
  });
  stub.__stubbed = true;
  HTMLCanvasElement.prototype.getContext = stub;
}

// ---------------------------------------------------------------------------
// 5. react-modal's app element
// ---------------------------------------------------------------------------

/*
 * Point react-modal at a dedicated element, NOT document.body.
 *
 * While a dialog is open react-modal sets aria-hidden on the app element, so
 * that assistive technology sees only the dialog. react-modal also appends its
 * portal to document.body -- so naming the body as the app element hides the
 * dialog along with everything else, and Testing Library's role queries, which
 * skip aria-hidden subtrees, then find nothing at all. That produced 54
 * "unable to find an accessible element" failures.
 *
 * An empty stand-in keeps the library happy and hides nothing under test. The
 * running app names its real #root in src/index.jsx, where the behaviour is
 * wanted.
 *
 * Guarded on `document` for the same reason the canvas stub above is: the
 * Firestore rules suites run with no DOM, and an unguarded appendChild here
 * failed both files before a single test ran.
 */
if (typeof document !== "undefined") {
  const modalAppElement = document.createElement("div");
  modalAppElement.setAttribute("id", "react-modal-app-element");
  document.body.appendChild(modalAppElement);
  ReactModal.setAppElement(modalAppElement);
}

// ---------------------------------------------------------------------------
// 6. Clean state between tests
// ---------------------------------------------------------------------------

// Done centrally so no test file has to remember it. State leaking between tests
// produces order-dependent failures, which are far more expensive to chase than
// the reset costs.
//
// These are the same module instances the jest.mock factories above return --
// Jest's registry hands back one instance per module per test file.
beforeEach(() => {
  fakeFirestore.__reset();
  fakeAuth.__reset();
});
