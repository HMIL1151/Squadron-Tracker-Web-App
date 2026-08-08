# Why the styling is being overhauled

Short version: **a popup's width today depends on which dashboards you happened to open first.**

This document records the evidence, because the fix (scoping every stylesheet with CSS Modules,
consolidating the popups, moving colour behind tokens) is a lot of churn for something that looks
cosmetic from the outside. It is not cosmetic.

## The mechanism

Two facts combine badly.

1. Every stylesheet is global. Class names are shared by convention, and the convention has not
   held — 20 class names are defined in more than one file. `.popup-overlay` has six definitions,
   `.popup-content` five.
2. Every dashboard is `React.lazy`-loaded (`DashboardComponents/dashboardList.js`), and Vite's
   `cssCodeSplit` is on by default. So each dashboard's CSS is a **separate chunk, injected when
   that dashboard is first opened.**

Two rules at equal specificity are resolved by document order. When document order is "whatever the
user clicked, in the order they clicked it", the winner is a function of navigation history.

## The evidence

From a production build (`REACT_APP_USE_FAKE_DB=true npm run build`), `.popup-content` is defined in
five separate chunks, each loaded independently:

| Chunk | Rule |
|---|---|
| `Popup-*.css` | `width: 300px` |
| `EventCategoriesDashboard-*.css` | `width: 300px` |
| `MassEventLog-*.css` | `min-width: 400px`, flex column — and a *second* rule, `width: 20%` |
| `ClassificationDashboard-*.css` | `width: 500px` |
| `PTSTracker-*.css` | (a near-miss duplicate, `.popup-contents`) |

So the shared popup renders at 300px, 400px-plus, 20%, or 500px wide, and the deciding factor is
which dashboards are in the session's chunk-load history. Open Mass Event Log then Classification
and you get one answer; reverse the order and you get another. Dev mode differs again, because
`<style>` injection order in dev follows module evaluation rather than chunk loading.

This is why "it looks fine on my machine" has been true and unhelpful at the same time.

## Why the test suite never caught it

It cannot, by construction:

- Vitest runs jsdom with CSS processing off, so stylesheets are never loaded.
- jsdom does no layout, so even loaded CSS would not produce a width.
- `src/test/domSnapshot.jsx` deliberately excludes the `style` attribute, so snapshots are blind to
  appearance on purpose — that exclusion is correct, and it is also why this class of bug is
  invisible.

The check that *can* see it reads the files rather than the DOM: `src/test/cssShape.test.js`.

## What else that test found

Running it against the tree as it stands turned up four more defects of the same family:

- `dashboardStyles.css` animates the error toast with `@keyframes fadeOut`, which is defined only in
  `CadetsDashboard.css`. **The toast only fades if you have opened the Cadet List this session.**
  CSS Modules localises keyframe names, so this breaks outright — and silently — on migration.
- `SuccessMessage.jsx` renders `.success-popup` and imports no stylesheet at all. Its rule also
  lives in `CadetsDashboard.css`.
- `CadetsDashboard.css` has a bare `select { }` selector styling every dropdown in the app. CSS
  Modules does **not** scope element selectors, so renaming that file would give the appearance of
  containment without the fact of it.
- 14 classes are rendered by components but defined in no stylesheet, including `.clickable-row`,
  which `Table.jsx` puts on every row when `onRowClick` is set and which appears ten times in a
  committed snapshot.

## The order of the fix

The sequencing matters more than usual here, because the current appearance is partly an accident
of load order, and "fix the duplicates" changes what the *survivors* inherit.

**Rename, then delete.** For each duplicated name, first give every consumer a class it owns,
carrying the values that win on a pinned navigation path. Only when nothing references the shared
name is it safe to remove the definitions. Deleting first and then looking is how you spend a week
chasing diffs that turn out to be pre-existing nondeterminism.

Full plan and phase order: see the styling overhaul plan.
