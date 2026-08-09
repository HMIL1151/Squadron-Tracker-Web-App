# CLAUDE.md

Guidance for Claude Code working in this repo. [README.md](README.md) is the architecture
document — read it before any non-trivial change. This file is the operational layer: commands,
layout, and the constraints that are expensive to rediscover.

## Ground rules

- **The app lives in `squadron-tracker/`, not the repo root.** Every npm command runs from there.
- The app is a real RAFAC squadron tracker with live user data in Firestore. Never point a dev
  server, test or script at the real project — use offline mode (below).
- Non-trivial modules open with a block comment explaining *why* the design is what it is,
  usually naming the approach that failed. Match that style; do not strip those comments while
  editing nearby code. See `src/firebase/db.js`, `vite.config.js`, `playwright.config.js`,
  `src/setupTests.js`.

## Stack

React 19 · Vite 5 · Vitest 2 (jsdom) · Playwright 1.6x · Firebase 11 (Auth, Firestore **lite**
only, Hosting) · Chart.js 4 + react-chartjs-2 · jsPDF + jszip + react-pdf (certificates) ·
framer-motion · react-modal · Stylelint 17 · Node 20 (CI). Plain JS + JSX, no TypeScript.
ESLint config is `react-app` only, via `package.json`; there is no lint script for JS.

## Commands

All from `squadron-tracker/`:

```bash
npm start                 # dev server, localhost:3000 — needs a real .env
npm run dev:offline       # dev server on in-memory DB, no credentials, cannot touch prod
npm test                  # full Vitest suite, single run (~25s)
npm test -- --coverage    # with enforced coverage thresholds
npm test -- -u            # update snapshots (read the diff)
npm run test:watch
npm run test:visual       # Playwright golden-master screenshots, own server on :3247
npm run test:visual:update
npm run lint:css          # Stylelint: no raw colours outside tokens.css
npm run test:rules        # Firestore rules vs emulator; needs a JDK
npm run build             # production build into build/
```

Verify UI work through the `squadron-tracker-offline` preview config in
[.claude/launch.json](.claude/launch.json). Sign-in is instant with no popup; pick the fixture
user via URL (`/?as=user`, `?as=legacy`, `?as=sysadmin`, `?as=new` — see README).

CI ([.github/workflows/test.yml](.github/workflows/test.yml)) runs `lint:css` (currently
`continue-on-error`), `npm test -- --coverage`, `npm run build`, and `test:rules` as a
separate job. Visual tests are **not** in CI — run them locally when styling changes.

## Directory map

```
squadron-tracker/
  src/
    App.jsx, index.jsx        shell (auth, header, menu, Suspense) / provider stack
    setupTests.js             global test setup — MUST stay at this path
    context/                  DataContext, SquadronContext, ThemeContext
    components/
      WelcomePage/            login, squadron selection, new-squadron setup, changelog
      Menu/, Table/, ThemeToggle/
      Dashboards/
        <Name>Dashboard/      one folder per dashboard, most with __snapshots__/
        DashboardComponents/  dashboardList.js (registry), Modal, Popup, Form, LoadingPopup
    firebase/                 db.js (sole Firestore entry point) + per-collection modules
    databaseTools/            shared write hooks (useSaveEvent)
    utils/                    flights, points, cadets, mappings, examList, backupCsv
    Styles/                   tokens.css, index.css, App.css — the only global CSS
    test/                     fakeFirestore, fakeAuth, devAuth, dummyData,
                              renderWithProviders, cssShape, contrast + rules suites
  e2e/                        Playwright specs + committed screenshot baselines
  docs/                       styling-cascade.md, deploy-rules.md
  scripts/test-rules.js       emulator runner
  firestore.rules, firebase.json, vite.config.js, playwright.config.js
```

Adding a dashboard = new component folder + one entry in `dashboardList.js` (`adminOnly` /
`systemAdminOnly` control menu visibility). Dashboards are `React.lazy`-loaded.

## Architecture decisions worth knowing

- **Offline mode is a resolve-time alias, not a runtime branch.** With `REACT_APP_USE_FAKE_DB`,
  `vite.config.js` maps `firebase/firestore/lite` → `src/test/fakeFirestore.js` and
  `firebase/auth` → `src/test/devAuth.js`. An earlier runtime `require()` shipped the fake and
  dummy squadrons to production. Both Firestore *and* Auth must be swapped together.
- **Only the lite SDK.** No `onSnapshot` anywhere — every read is one-shot. All Firestore
  primitives come from `src/firebase/db.js`, never from the SDK directly.
- **Firestore is multi-tenant by squadron number** under `SquadronDatabases/{squadronNumber}`.
  Isolation is enforced by `firestore.rules` and proved by `test:rules`.
- **A cadet's `flight` is a 1-based index into the squadron's `flights` array.** See below.
- Classification is *derived* from exam-event counts, never stored.
- **CSS Modules everywhere** except `src/Styles/`. Colour lives only in `tokens.css`, in two
  tiers; components use the semantic tier (`--color-border`) so dark mode can reassign it.
  Chart.js can't read CSS — colours are pushed into its defaults in `chartTheme.js`.
- Tests run **sequentially** (`fileParallelism: false`): in parallel on Windows, Vitest's
  optimizer cache threw `EBUSY` and silently skipped a varying number of *files* while still
  reporting green.
- Tests use `renderWithProviders` (`src/test/renderWithProviders.jsx`) — real providers over
  the in-memory Firestore, returning `user`, `data`, `props`, `writes()`, `store()`. Assert on
  `writes()` rather than mocking the SDK.
- The clock is frozen to 2025-06-15T12:00:00Z in `setupTests.js` so snapshots don't drift.
  Consequence: two `Date` constructors exist, so `instanceof Date` is unreliable — use
  `Object.prototype.toString.call(v) === "[object Date]"`.
- `src/test/cssShape.test.js` is a ratchet: it fails both when a duplicate class is added and
  when one is fixed without being crossed off its list. `contrast.test.js` checks WCAG AA
  across both themes by reading `tokens.css` from disk.

## Never do this

- **Never remove, reorder or reindex an entry in a squadron's `flights` array.** The index *is*
  the cadet's flight; shifting it silently moves cadets into the wrong flight. Retire a flight
  by setting `archived`, and support both the legacy `string[]` and current object shapes.
- **Never re-enable `fileParallelism`**, and never remove `snapshotFormat.printBasicPrototype`
  or `css.modules.classNameStrategy: "non-scoped"` from `vite.config.js`. Each one turns the
  suite into a false green rather than a red run.
- **Never delete a `.snap` file to make a run pass.** Snapshots are characterization evidence;
  update with `-u` and read the diff.
- **Never lower `threshold`/`maxDiffPixelRatio` from `0`** in `playwright.config.js`, and never
  set `reuseExistingServer: true`. Both have previously produced passes against a page that
  didn't match the baseline.
- **Never build a CSS Module class name by string concatenation, and never find an element by
  class name** — scoped names don't survive it. Use an explicit map (`SIZES` in `Modal.jsx`,
  `PROGRESS` in `AdminDashboard.jsx`) and a ref. A missed `styles[...]` lookup is caught by an
  `afterEach` guard that fails on `class="undefined"`.
- **Never write a raw colour outside `tokens.css`** — hex, `rgb()`/`hsl()` and named colours are
  all Stylelint errors. Exempt-by-design and never themed: PTS badge levels, certificate medals,
  categorical chart series, and everything jsPDF draws.
- **Never move `src/setupTests.js`** or add a global `setTimeout` fake — `useFakeTimers` breaks
  `waitFor` and user-event.
- **Never lower the coverage thresholds** (statements/functions/lines 69, branches 60) to make
  CI pass. Adding untested code can fail CI while every test passes.
- Never commit real Firebase config. `.env` is gitignored; `.env.example` and `.env.test` hold
  fake values only. (The web config values themselves are public by design — access control is
  Auth + rules, never secrecy.)
- `squadron-tracker/.firebase/hosting.YnVpbGQ.cache` is tracked and rewritten by every deploy.
  It will often already show as modified — leave it out of feature commits.

## Git

Claude owns git here: branch off `main`, commit and push every change without being asked. Never
commit directly to `main`. Surface anything destructive (force-push, history rewrite, branch
deletion) before doing it.

## Releasing

Add an entry to `public/changelog.json` and bump `package.json`. The highest changelog version is
what the app displays, so a version bump changes rendering — expect snapshot and screenshot
updates. Deploy: `npm run build && firebase deploy` (project `squadron-tracker-1151`); read
[docs/deploy-rules.md](squadron-tracker/docs/deploy-rules.md) before deploying rules.
