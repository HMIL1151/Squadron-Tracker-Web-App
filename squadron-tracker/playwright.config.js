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
    baseURL: "http://localhost:3000",
    // Fixed viewport: a screenshot diff should mean a style changed, not that
    // the window was a different size.
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },

  expect: {
    toHaveScreenshot: {
      // Anti-aliasing differs slightly between machines; a real style change is
      // far larger than this.
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
    },
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // The same script a developer uses by hand, so there is one offline path
    // rather than a second one that only the tests take.
    command: "npm run dev:offline",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
