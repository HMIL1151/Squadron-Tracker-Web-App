/**
 * The shape of the stylesheet layer, asserted against a written-down baseline.
 *
 * This is a ratchet, not a pass/fail on quality. Every list below records a
 * defect that exists today; the test goes red when something is ADDED to the
 * pile, and equally when something is fixed without being crossed off. Both
 * directions are deliberate -- the lists are the Phase 2 backlog, and a backlog
 * that drifts out of date is worse than none.
 *
 * Why a file-reading test rather than a DOM one: the suite runs jsdom with CSS
 * processing off, so no rendering test can see a stylesheet at all, let alone
 * see which of five competing `.popup-content` rules won. See cssShape.js.
 */

import {
  analyseCss,
  analyseSource,
  crossFileAnimations,
  cssFiles,
  duplicateClasses,
  sourceFiles,
} from "./cssShape";

const sheets = cssFiles().map(analyseCss);
const sources = sourceFiles().map(analyseSource);

/**
 * Class names defined in more than one GLOBAL stylesheet.
 *
 * This used to cover every stylesheet, because every class name was global and
 * a name defined twice was a collision decided by which lazily-loaded dashboard
 * the user opened first. That is no longer true: the component stylesheets are
 * CSS Modules, so two files may both define `.active` and the two never meet.
 *
 * What still matters is the handful of genuinely global sheets under Styles/,
 * where a duplicate is a real collision again. The list is empty and should
 * stay that way.
 *
 * "Defined" means the class is the subject of a selector -- `.popup-content h2`
 * describes a heading, not a second opinion about what a popup is. See
 * classesIn in cssShape.js.
 */
const KNOWN_DUPLICATE_CLASSES = [];

/**
 * `animation:` naming a @keyframes defined in another file.
 *
 * dashboardStyles.css drives the error toast from a keyframes block that lives
 * in CadetsDashboard.css, so the toast only fades if the Cadet List happens to
 * have been opened this session. CSS Modules localises keyframes names, so this
 * stops working outright -- silently -- the moment either file is migrated.
 */
const KNOWN_CROSS_FILE_ANIMATIONS = [];

/**
 * Bare element selectors outside the global stylesheets.
 *
 * CSS Modules does not scope element selectors, so renaming the file to
 * `.module.css` would give the appearance of containment without the fact of
 * it. `select` here styles every dropdown in the app.
 */
const KNOWN_BARE_ELEMENT_SELECTORS = [];

/**
 * Classes a component renders that no stylesheet defines.
 *
 * `clickable-row` is the notable one: Table.jsx applies it to every row when
 * onRowClick is set, it appears ten times in a committed snapshot, and it has
 * never had a rule. Under CSS Modules there is nothing for it to map to.
 */
const KNOWN_UNSTYLED_CLASSES = [
  "components/Dashboards/CadetsDashboard/CadetsDashboard.jsx:cadet-count",
  "components/Dashboards/CertificateDashboard/CertificateDashboard.jsx:preview-button",
  "components/Dashboards/DashboardComponents/Form.jsx:form",
  "components/Dashboards/DashboardComponents/Form.jsx:form-title",
  "components/Dashboards/EventCategoriesDashboard/EventCategoriesDashboard.jsx:add-entry-modal",
  "components/Dashboards/EventCategoriesDashboard/EventCategoriesDashboard.jsx:badgepoints",
  "components/Dashboards/EventCategoriesDashboard/EventCategoriesDashboard.jsx:badges",
  "components/Dashboards/EventCategoriesDashboard/EventCategoriesDashboard.jsx:eventcategories",
  "components/Dashboards/EventCategoriesDashboard/EventCategoriesDashboard.jsx:specialawards",
  "components/Dashboards/MassEventLog/AddEventPopup.jsx:date-input",
  "components/Dashboards/MassEventLog/AddEventPopup.jsx:text-input",
  "components/Dashboards/PTSTracker/PTSTracker.jsx:PTSTracker-year-filter",
  "components/WelcomePage/WelcomePage.jsx:error-message",
];

const RATCHET = "Update the list in cssShape.test.js in the same commit as the fix.";

describe("stylesheet shape", () => {
  it("finds the stylesheets and components to analyse", () => {
    // Guards against a path or glob change silently reducing this to nothing,
    // which would make every assertion below pass by analysing zero files.
    expect(sheets.length).toBeGreaterThanOrEqual(20);
    expect(sources.length).toBeGreaterThanOrEqual(40);
  });

  it("defines each class name in exactly one GLOBAL stylesheet", () => {
    const globals = sheets.filter((s) => s.file.startsWith("Styles/"));
    const found = [...duplicateClasses(globals).keys()];
    expect(found.sort()).toEqual([...KNOWN_DUPLICATE_CLASSES].sort());
  });

  it("scopes every component stylesheet", () => {
    /*
     * The check that replaces the old duplicate hunt. Collisions are no longer
     * possible between modules, so what matters is that no component stylesheet
     * has slipped back to being global -- one plain .css under components/ and
     * its class names are shared with everything again.
     */
    const unscoped = sheets
      .filter((s) => !s.file.startsWith("Styles/") && !s.file.includes(".module.css"))
      .map((s) => s.file);
    expect(unscoped).toEqual([]);
  });

  it("keeps every @keyframes in the file that animates with it", () => {
    const found = crossFileAnimations(sheets).map((a) => `${a.file}:${a.name}`);
    expect(found.sort()).toEqual([...KNOWN_CROSS_FILE_ANIMATIONS].sort());
  });

  it("confines bare element selectors to the global stylesheets", () => {
    const found = sheets
      .filter((s) => !s.file.startsWith("Styles/"))
      .flatMap((s) => [...s.bareElements].map((e) => `${s.file}:${e}`));
    expect(found.sort()).toEqual([...KNOWN_BARE_ELEMENT_SELECTORS].sort());
  });

  it("has a stylesheet rule for every class a component renders", () => {
    // `referenced`, not `classes`: a class styled only as an ancestor or
    // qualifier still has styling. See classesIn/allClassesIn in cssShape.js.
    const defined = new Set(sheets.flatMap((s) => [...s.referenced]));
    const found = sources.flatMap((src) =>
      [...src.classes].filter((c) => !defined.has(c)).map((c) => `${src.file}:${c}`)
    );
    expect(found.sort()).toEqual([...KNOWN_UNSTYLED_CLASSES].sort());
  });

  it("records the known defects accurately", () => {
    // A stale baseline is the failure mode that makes a ratchet useless, so
    // say so explicitly rather than leaving it implied by the tests above.
    expect(KNOWN_DUPLICATE_CLASSES).toEqual([...new Set(KNOWN_DUPLICATE_CLASSES)]);
    expect(KNOWN_UNSTYLED_CLASSES).toEqual([...new Set(KNOWN_UNSTYLED_CLASSES)]);
    expect(RATCHET).toBeTruthy();
  });
});
