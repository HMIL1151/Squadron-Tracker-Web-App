import { expect, test } from "@playwright/test";

/**
 * Golden-master screenshots, one per dashboard, plus the pairs that make the
 * cascade collisions visible.
 *
 * Twenty class names are defined in more than one stylesheet, and each
 * dashboard's CSS arrives only when that dashboard is first opened, so the
 * winner depends on navigation history. A single screenshot per screen would
 * photograph one arbitrary resolution of that and call it the baseline. Taking
 * the same screen along two different routes is what turns the ambiguity into
 * a visible diff.
 *
 * These run against the dev server, so the pairs below detect ordering that
 * varies in DEV. Production splits CSS into per-dashboard chunks and resolves
 * the same collisions differently -- see playwright.config.js for why a build
 * cannot be driven here, and docs/styling-cascade.md for the measured
 * production evidence. The authoritative check on collisions is
 * src/test/cssShape.test.js, which names them rather than photographing them.
 */

const DASHBOARDS = [
  "Mass Event Log",
  "Cadet List",
  "Record Categories",
  "Classification Tracker",
  "Flight Points",
  "Certificates",
  "PTS Tracker",
  "Flights",
  "Admin Area",
];

/**
 * Sign in and wait for the app proper.
 *
 * Offline mode has no popup and no real account -- devAuth returns a fixture
 * user as soon as the button is clicked. Default is 9999 Faketon, admin.
 */
const signIn = async (page) => {
  await page.goto("/");
  await page.getByRole("button", { name: /sign in with google/i }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
};

const open = async (page, title) => {
  await page.getByRole("listitem").filter({ hasText: new RegExp(`^${title}$`) }).click();
  // The dashboard is lazily loaded; wait for Suspense to resolve before
  // photographing, or the screenshot catches the fallback.
  await expect(page.getByText("Loading...")).toHaveCount(0, { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
};

test.describe("dashboards", () => {
  for (const title of DASHBOARDS) {
    const slug = title.toLowerCase().replace(/\s+/g, "-");

    test(`${title} renders`, async ({ page }) => {
      await signIn(page);
      await open(page, title);
      await expect(page).toHaveScreenshot(`dashboard-${slug}.png`, { fullPage: true });
    });
  }
});

test.describe("cascade collisions", () => {
  /*
   * .popup-content is defined in five chunks -- 300px in Popup.css, min-width
   * 400px in MassEventLog.css, 500px in ClassificationDashboard.css. If these
   * two screenshots differ, the popup's width is a function of where the user
   * has been, which is the defect Phase 2 removes. If they match, the ordering
   * happened to be stable for this pair and the pinned routes need revisiting.
   */
  test("Mass Event Log popup, opened directly", async ({ page }) => {
    await signIn(page);
    await open(page, "Mass Event Log");
    await page.getByRole("button", { name: "Add New Record" }).click();
    await expect(page).toHaveScreenshot("popup-masseventlog-direct.png");
  });

  test("Mass Event Log popup, after Classification Tracker", async ({ page }) => {
    await signIn(page);
    await open(page, "Classification Tracker");
    await open(page, "Mass Event Log");
    await page.getByRole("button", { name: "Add New Record" }).click();
    await expect(page).toHaveScreenshot("popup-masseventlog-after-classification.png");
  });

  test("Cadet List popup, opened directly", async ({ page }) => {
    await signIn(page);
    await open(page, "Cadet List");
    await page.getByRole("button", { name: "Add Cadet" }).click();
    await expect(page).toHaveScreenshot("popup-cadetlist-direct.png");
  });

  test("Cadet List popup, after Record Categories", async ({ page }) => {
    await signIn(page);
    await open(page, "Record Categories");
    await open(page, "Cadet List");
    await page.getByRole("button", { name: "Add Cadet" }).click();
    await expect(page).toHaveScreenshot("popup-cadetlist-after-eventcategories.png");
  });
});
