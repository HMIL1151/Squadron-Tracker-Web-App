import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite config, replacing react-scripts.
 *
 * Several settings exist to keep the rest of the project unchanged rather than
 * because Vite wants them:
 *
 *   envPrefix   The app's variables are REACT_APP_*, and so is the Firebase
 *               App Hosting configuration. Renaming them all to VITE_* would
 *               mean re-entering them in the hosting console for no benefit.
 *
 *   outDir      firebase.json deploys `build`. Vite defaults to `dist`;
 *               pointing it at `build` leaves the deploy flow untouched.
 *
 *   globals     The test suite was written for Jest's globals (describe, it,
 *               expect, jest). `globals: true` plus the jest->vi alias in
 *               setupTests.js means ~490 tests did not have to be rewritten.
 */
/*
 * Offline mode is a resolution-time swap, not a runtime branch.
 *
 * With REACT_APP_USE_FAKE_DB set, every `firebase/firestore/lite` import
 * resolves to the in-memory fake instead, and every `firebase/auth` import to
 * a stub that signs in as a fixture user. src/firebase/db.js needs no
 * conditional, and a production build contains no reference to either at
 * all -- which is stronger than relying on dead-branch elimination to remove
 * one. (An earlier runtime version shipped the fake and both dummy squadrons
 * to users.)
 *
 * Auth has to be swapped as well as Firestore, not instead of it. With only
 * the database faked, the app booted against the dummy squadrons and then sent
 * you to a real Google popup; the real uid that came back is not in the
 * fixture, so the app treated you as a first-time visitor and the seeded
 * squadrons were unreachable.
 */
const offline = process.env.REACT_APP_USE_FAKE_DB === "true";
const fixture = (file) => new URL(`./src/test/${file}`, import.meta.url).pathname;

export default defineConfig({
  plugins: [react()],

  envPrefix: ["VITE_", "REACT_APP_"],

  /*
   * Keep the module cache inside the project.
   *
   * The default lives in the OS temp directory, which on Windows produced
   * intermittent `EBUSY: resource busy or locked` errors as parallel test
   * workers raced on the same cache files -- a different number of test files
   * silently failed to run on each attempt, while the run still reported
   * everything it did manage to run as passing.
   */
  cacheDir: "node_modules/.vite",

  resolve: {
    alias: offline
      ? {
          "firebase/firestore/lite": fixture("fakeFirestore.js"),
          "firebase/auth": fixture("devAuth.js"),
        }
      : {},
  },

  build: {
    outDir: "build",
    // CRA emitted source maps; keep doing so.
    sourcemap: true,
  },

  server: {
    port: 3000,
    open: true,
  },

  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.js"],
    globalSetup: ["./src/test/globalSetup.js"],

    /*
     * Run test files one at a time.
     *
     * In parallel, Vitest's dependency-optimizer cache in the OS temp
     * directory intermittently threw `EBUSY: resource busy or locked` on
     * Windows. The damage was not a red run -- it was that a varying number of
     * test files never executed while the run still reported everything it did
     * manage as passing (446 tests one run, 334 the next, both "green").
     *
     * A suite that silently shrinks is worse than a slow one. The whole run
     * takes about 25 seconds sequentially.
     */
    fileParallelism: false,

    // Do not let an unhandled error be swallowed into a green run.
    dangerouslyIgnoreUnhandledErrors: false,

    /*
     * CSS Modules class names, in tests, are the names as written.
     *
     * Vitest does not process CSS -- `css.include: []` keeps it that way, since
     * pushing every stylesheet through jsdom for each component file buys no
     * assertion. What it DOES do is replace a `.module.css` import with a Proxy
     * whose keys resolve according to classNameStrategy, and the default
     * ("stable") returns a hashed name derived from the file path. That would
     * turn every `querySelector(".popup-content")` in the suite red, and churn
     * the committed snapshots into unreadable hashes that move again the next
     * time a file is renamed.
     *
     * "non-scoped" returns the raw key instead, so styles["popup-content"] is
     * "popup-content" in tests and a scoped name in the browser. The thirty-odd
     * class-coupled assertions keep working, and keep being regression
     * detectors through the migration rather than churn.
     */
    css: {
      include: [],
      modules: { classNameStrategy: "non-scoped" },
    },

    // CRA's default. Several tests rely on module mocks persisting across
    // tests within a file, so this must stay false.
    restoreMocks: false,
    clearMocks: false,

    /*
     * Keep Jest's snapshot serialisation.
     *
     * Vitest omits the `Array [` / `Object {` prefixes by default. Without
     * this, every existing snapshot is treated as obsolete and rewritten in
     * the new format -- the suite reports "20 obsolete" and passes, having
     * compared nothing. The characterization snapshots are the evidence that
     * this migration changed no rendering, so they must be compared as they
     * were committed, not reformatted.
     */
    snapshotFormat: {
      printBasicPrototype: true,
    },

    // The rules tests are NOT excluded here. They skip themselves when
    // FIRESTORE_EMULATOR_HOST is unset, so an ordinary run reports them as
    // skipped rather than pretending they do not exist. Excluding them by
    // pattern also made them unrunnable by path, since `exclude` wins over a
    // positional argument -- scripts/test-rules.js names each file directly.
    //
    // e2e/ IS excluded: those are Playwright specs, and Vitest's default
    // include picks up *.spec.js. Without this it collects them and fails on
    // the @playwright/test import, which has no meaning outside its own runner.
    exclude: ["**/node_modules/**", "**/build/**", "**/e2e/**"],

    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,jsx}"],
      exclude: [
        "src/test/**",
        "src/misc/**",
        "src/index.jsx",
        "src/**/*.test.{js,jsx}",
      ],
      thresholds: {
        statements: 69,
        branches: 60,
        functions: 69,
        lines: 69,
      },
    },
  },
});
