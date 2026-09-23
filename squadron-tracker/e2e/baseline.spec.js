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
/**
 * The same instant src/setupTests.js freezes the unit suite to.
 *
 * Without this the Cadet List screenshots drift by one pixel-row of digits
 * every day: its Service Length column is computed from `new Date()`, so
 * "5 Yrs, 0 Mos, 12 Days" becomes 13 tomorrow and the baseline fails for
 * everyone, on every branch, until it is recaptured. Measured at 668 differing
 * pixels against an unmodified component -- a broken clock, not a regression.
 *
 * Both suites now freeze to the same instant, so a figure in a screenshot and
 * the same figure in a snapshot mean the same thing.
 */
const FROZEN_NOW = new Date("2025-06-15T12:00:00Z");

const signIn = async (page, ui = "classic") => {
  await page.clock.setFixedTime(FROZEN_NOW);
  /*
   * The interface is pinned through the URL rather than left to the default.
   *
   * A fresh browser context has no cached choice, so these used to land on
   * classic by accident -- which would silently become "photograph whatever
   * the system default is" the day a system admin moves it. `?ui=` is the one
   * layer that beats both the account and the cache, so it is exactly the
   * right tool for saying which interface a screenshot is OF.
   */
  /*
   * `data=fixture` pins the seed to the small test fixture. The dev server
   * otherwise seeds a full-size squadron, which is right for a person opening
   * it and wrong for a golden master -- a forty-cadet full-page screenshot is
   * enormous, and every baseline would move the next time the generator was
   * touched.
   */
  await page.goto(`/?ui=${ui}&data=fixture`);
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

/**
 * The same dashboards in the Muster interface.
 *
 * Their own baselines, and the classic ones above are untouched -- which is
 * the point. As long as both sets are green, the new interface has not reached
 * into the old one.
 *
 * Navigation differs: classic renders list items, Muster renders buttons in a
 * rail, because the app has no routing to link to. The titles differ too,
 * since Muster uses sentence case.
 */
const MUSTER_SCREENS = [
  "Mass Event Log",
  "Cadet List",
  "Record Categories",
  "Classification Tracker",
  "Flight Points",
  "Certificates",
  "PTS Tracker",
  "Squadron Statistics",
  "Flights",
  "Admin Area",
];

const openMuster = async (page, title) => {
  await page.getByRole("button", { name: title, exact: true }).click();
  // Lazily loaded, so wait for Suspense to resolve before photographing.
  await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
};

test.describe("muster dashboards", () => {
  for (const title of MUSTER_SCREENS) {
    const slug = title.toLowerCase().replace(/\s+/g, "-");

    test(`${title} renders in Muster`, async ({ page }) => {
      await signIn(page, "muster");
      await openMuster(page, title);
      await expect(page).toHaveScreenshot(`muster-${slug}.png`, { fullPage: true });
    });
  }

  /*
   * The collapsed rail has layout no unit test can reach: jsdom has no layout
   * engine, so "is the selected item square" is only answerable from a
   * screenshot. It was a 16x36 sliver standing on end -- the width collapsed
   * to the icon's -- and nothing but a picture would have caught it.
   */
  test("the rail collapses to a strip of icons", async ({ page }) => {
    await signIn(page, "muster");
    await openMuster(page, "Cadet List");
    await page.getByRole("button", { name: "Collapse the menu" }).click();
    await expect(page.getByRole("button", { name: "Expand the menu" })).toBeVisible();
    await expect(page).toHaveScreenshot("muster-rail-collapsed.png", { fullPage: true });
  });

  test("the sign-in screen renders in Muster", async ({ page }) => {
    await page.clock.setFixedTime(FROZEN_NOW);
    await page.goto("/?ui=muster&data=fixture");
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
    await expect(page).toHaveScreenshot("muster-sign-in.png", { fullPage: true });
  });

  /*
   * Opening the earlier releases used to take the page to 5,487px. The left
   * column centres its content vertically, so it went with it: you were left
   * looking at an empty navy field with the writing somewhere around 2,500px
   * down. The release notes have to scroll inside their own column.
   *
   * The height assertion is the real check and the screenshot is the witness
   * -- a full-page shot of a regressed page is 5,487px tall, so it fails
   * whichever way you read it.
   */
  test("the sign-in screen scrolls its release notes, not the page", async ({ page }) => {
    await page.clock.setFixedTime(FROZEN_NOW);
    await page.goto("/?ui=muster&data=fixture");
    await page.getByText(/Earlier releases/).click();

    await expect(page.getByRole("heading", { name: "One record of every cadet." })).toBeVisible();

    const grew = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollHeight > doc.clientHeight || doc.scrollWidth > doc.clientWidth;
    });
    expect(grew).toBe(false);

    await expect(page).toHaveScreenshot("muster-sign-in-releases.png", { fullPage: true });
  });
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
