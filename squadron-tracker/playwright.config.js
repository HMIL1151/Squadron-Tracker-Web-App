import { defineConfig, devices } from "@playwright/test";

/**
 * Visual baselines for the styling overhaul.
 *
 * These exist to answer one question the Vitest suite cannot: did this change
 * alter what a user sees? Vitest runs jsdom with CSS processing off and does no
 * layout, so appearance is invisible to it by construction.
 *
 * Runs against the OFFLINE DEV SERVER, not a production build, and that is a
 * real limitation rather than a convenience.
 *
 * The intent was to drive a production build, because dev and build resolve the
 * stylesheet collisions differently: dev injects <style> tags in module
 * evaluation order, a build emits one CSS chunk per lazily-loaded dashboard
 * injected on load. That cannot be done. Offline mode is a dev-server-only
 * feature by construction -- src/firebase/db.js gates seeding on
 * `!import.meta.env.PROD` and seeds through a top-level await, so a build
 * either drops the seeding (leaving fake auth pointed at real Firestore, which
 * strands you on the squadron prompt) or, with PROD forced false, fails to
 * compile because top-level await is outside the browser targets.
 *
 * So these screenshots answer "did this change appearance", which is what
 * Phases 2 and 4 gate on. They do NOT answer "which duplicate rule won in
 * production". That question is answered instead -- and more rigorously, by
 * name rather than by pixel -- in src/test/cssShape.test.js, with the measured
 * production evidence in docs/styling-cascade.md.
 *
 * REACT_APP_USE_FAKE_DB swaps Firestore and Auth for in-memory fakes at resolve
 * time, so this needs no credentials and cannot reach production data.
 */
export default defineConfig({
  testDir: "./e2e",

  // Chunk-load order is the thing under test, so tests must not share a page.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: "http://localhost:3247",
    // Fixed viewport: a screenshot diff should mean a style changed, not that
    // the window was a different size.
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },

  expect: {
    toHaveScreenshot: {
      /*
       * Pixel-exact, and `threshold` is the part that matters.
       *
       * `threshold` is a PER-PIXEL colour tolerance, applied before
       * maxDiffPixelRatio counts anything. At its default of 0.2 this harness
       * did not notice the entire page header changing from #282c34 to a
       * bright purple: too few pixels registered as "different" for the ratio
       * to trip, so the suite reported a pass against a baseline it visibly
       * did not match. A tolerance that hides a whole header is not tolerance,
       * it is a blindfold.
       *
       * At 0 the same change is 69,208 pixels, 8% of the image. Verified
       * stable: two consecutive runs of all thirteen against an unchanged tree
       * pass, so anti-aliasing is not producing drift on a fixed viewport and
       * browser. Baselines carry a platform suffix, so a different OS gets its
       * own set rather than fighting these.
       */
      maxDiffPixelRatio: 0,
      threshold: 0,
      animations: "disabled",
    },
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    /*
     * Always a fresh server, on a port the normal dev server does not use.
     *
     * Both halves of that are load-bearing, and were learned the hard way.
     * With `reuseExistingServer` on port 3000, this silently attached to a dev
     * server someone else had already started, whose in-memory module graph had
     * gone stale: requesting tokens.css directly returned the edited values
     * while the index.css module it injects still carried the old ones. Every
     * screenshot then matched, because the page under test was not the code
     * under test -- the suite reported thirteen passes having verified nothing.
     *
     * strictPort so a busy 3247 is an error rather than a silent hop to another
     * port that baseURL would not be pointing at.
     */
    command: "cross-env REACT_APP_USE_FAKE_DB=true vite --port 3247 --strictPort",
    url: "http://localhost:3247",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
