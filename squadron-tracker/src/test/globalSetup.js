/**
 * Jest globalSetup. Runs once in the main process, before any worker spawns.
 *
 * Pins the timezone so the suite produces identical results on every machine.
 *
 * This has to happen here rather than in setupTests.js: ES `import` statements
 * hoist above any assignment in that file, so by the time an assignment there
 * runs, modules have already been evaluated and the environment's timezone is
 * fixed. Setting it in globalSetup means workers inherit it from process.env at
 * spawn time. (Verified -- the setupTests.js version genuinely did not work.)
 *
 * Why it matters: FlightPointsDashboard buckets events with
 * `new Date(event.date).getFullYear()`, which reads the *local* year from a
 * UTC-midnight instant. West of UTC that yields the previous year for any
 * 1 January event, so identical code gives a US developer different flight
 * totals than a UK one. Pinning to UTC means the suite measures the app, not
 * the machine it ran on.
 *
 * CommonJS on purpose: Jest loads this file directly, without the app's
 * Babel transform.
 */
module.exports = async () => {
  process.env.TZ = "UTC";
};
