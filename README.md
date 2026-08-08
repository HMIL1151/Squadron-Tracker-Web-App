# Squadron Tracker

A web app for tracking Air Cadet progression within the RAFAC. Squadron staff log events, badges,
classifications and exams in one place; the app derives flight points, progression charts and
end-of-year certificates from that log.

React 19 + Firebase (Auth, Firestore, Hosting).

---

## Getting started

The app lives in `squadron-tracker/`, **not** the repository root.

```bash
cd squadron-tracker
npm install
```

### Configure Firebase (required)

The app will not run without this. Copy the example file and fill in your Firebase web config:

```bash
cp .env.example .env
```

Values come from **Firebase Console → Project settings → General → Your apps → SDK setup and
configuration**.

These are Firebase *web* config values. They are public project identifiers, not secrets — they
ship in the client bundle by design. Access control is enforced by Firebase Auth and the Firestore
security rules, never by hiding these values.

`.env` is gitignored. `.env.example` and `.env.test` are committed and contain no real credentials.

### Run

```bash
npm start
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server on http://localhost:3000 |
| `npm run dev:offline` | Dev server against an in-memory database (see below) |
| `npm run build` | Production build into `build/` |
| `npm test` | Full test suite, single run |
| `npm run test:watch` | Test suite in watch mode |
| `npm run test:rules` | Firestore security rules, against the emulator |

Built with **Vite** and tested with **Vitest**. The security-rules tests need a
JDK for the Firestore emulator and are not part of `npm test` — they skip
themselves when no emulator is running.

## Deploying

```bash
cd squadron-tracker
npm run build
firebase deploy
```

Hosting config is in `firebase.json`; the project alias is in `.firebaserc`
(`squadron-tracker-1151`).

### Cache headers

`firebase.json` sets `Cache-Control` explicitly because Hosting's default for HTML is
`max-age=3600` — which meant users could sit on an hour-old page after a deploy, and you could
spend that hour debugging a fix that had already shipped.

Everything is `no-cache` except `/assets/**`, which Vite fills with content-hashed filenames and
which is therefore safe to cache forever. `changelog.json` is deliberately in the `no-cache` set:
the version number in the corner of the app is read from it at runtime.

The broad `**` rule is listed **first** and the narrow `/assets/**` rule second, on purpose.
Firebase does not document whether header `source` globs are matched before or after a rewrite, nor
which entry wins when two match. This order is correct either way: if the last match wins, assets
get the long cache and HTML gets `no-cache`; if the first match wins, everything gets `no-cache` —
slower, but never stale. The reverse order would be stale-by-default under one of those readings.

---

## Features

- **Mass Event Log** — log events, badges, exams and awards for one or many cadets at once.
- **Cadet List** — add, edit and discharge cadets. No personally sensitive data is stored.
- **Record Categories** — customise event categories and the points attached to each.
- **Classification Tracker** — plots cadet classification against service length versus the
  expected progression curve.
- **Flight Points** — per-cadet and per-flight point totals over a chosen year.
- **End of Year Certificates** — previewable PDF per cadet, with bulk generation as a `.zip`.
- **PTS Tracker** — badges earned across the Progressive Training Syllabus.
- **Flights** — add and rename flights, and choose which ones compete for
  points (admins only). A squadron can have any number of flights.
- **Admin Area** — approve or deny squadron access requests (admins only).
- **System Admin Area** — approve or deny new squadron accounts (system admins only).

## How it fits together

```
src/
  App.js                  Shell: auth state, header, menu, active dashboard
  index.js                Providers: DataProvider > SquadronProvider > App
  context/
    DataContext.js        Bulk-loaded squadron data (cadets, events, flightPoints)
    SquadronContext.js    Current squadron number
  components/
    WelcomePage/          Login, squadron selection, new-squadron setup, changelog
    Menu/                 Dashboard nav, filtered by admin role
    Table/                Shared sortable/filterable table
    Dashboards/           One folder per dashboard, registered in dashboardList.js
  firebase/               Firebase init and Firestore helpers
  databaseTools/          Shared write hooks (e.g. useSaveEvent)
  utils/                  Static maps (rank, classification) and exam list
```

Adding a dashboard means adding a component and one entry to
`src/components/Dashboards/Dashboard Components/dashboardList.js`. Set `adminOnly` or
`systemAdminOnly` there to control menu visibility.

### Data model

Firestore, multi-tenant by squadron number:

```
SquadronList/{autoId}              { Name, Number, flights }
SquadronDatabases/{squadronNumber}
  Cadets/{autoId}                  { forename, surname, startDate, flight, rank, ... }
  EventLog/{autoId}                { cadetName, date, badgeCategory, badgeLevel, examName, ... }
  FlightPoints/{docName}           "Badge Points" | "Event Category Points" | "Badges"
                                   | "Special Awards" | "TeamPoints"
  AuthorisedUsers/{uid}            { displayName, email, role }
  UserRequests/{autoId}            { displayName, email, uid, progress, timestamp }
MassUserList/{autoId}              { UID, Squadron, systemAdmin? }
NewAccountRequests/{autoId}        { squadronName, squadronNumber, flights, uid, ... }
```

### Flights

A cadet's `flight` is a **1-based index** into the squadron's `flights` array — not an id. That
single fact drives the design of the Flights screen:

- **The array only ever grows.** Removing or reordering an entry would silently move every cadet
  after it into the wrong flight.
- **Retiring a flight means archiving it**, not deleting it. An archived flight disappears from
  the Add Cadet picker and from Flight Points, while its slot, its cadets and its points history
  stay intact.
- **`competing` is per flight.** Flight Points charts whichever flights are marked competing, so a
  squadron can run a competition between two, three or more of them. This used to be hardcoded to
  "flights 2 and 3".

Two stored shapes exist and both work:

```
legacy    ["Staff Team", "Atlas", "Tempest"]
current   [{ name: "Staff Team", competing: false, archived: false }, ...]
```

Legacy squadrons are read correctly (first flight treated as non-competing staff) and upgrade to
the object shape the first time an admin saves. No migration is needed.

Classification is *derived* from the count of exam events, not stored.

## Development

```bash
npm run dev:offline
```

Runs the app against an in-memory database seeded with two dummy squadrons — no Firebase project,
no credentials, no network, and no way to touch production data. Useful for UI work and for trying
flight changes safely. Nothing is saved; reloading resets everything, and the browser console shows
an "OFFLINE MODE" banner so it can't be mistaken for the real thing.

**Click "Sign in with Google" and you are straight in** — there is no popup and no real account.
You sign in as a fixture user, chosen from the URL:

| URL | You are |
|---|---|
| `localhost:3000` | **9999 Faketon, admin** (default) — the flights playground |
| `localhost:3000/?as=user` | 9999 Faketon, ordinary user — no Flights or Admin menu |
| `localhost:3000/?as=legacy` | 9998 Testwood, admin — the old `string[]` flight format |
| `localhost:3000/?as=sysadmin` | System admin — asks which squadron, then adds System Admin Area |
| `localhost:3000/?as=new` | Signed in but authorised for nothing — the request-access flow |

Faketon has an archived flight (Charlie) and a non-competing one (Staff Team) already set up, so
the awkward cases are there to click through. Testwood is deliberately still in the legacy format,
so switching to it shows that old squadrons keep working.

The swap is a build-time alias in [vite.config.js](squadron-tracker/vite.config.js): with the flag
set, `firebase/firestore/lite` resolves to the in-memory fake and `firebase/auth` to a stub that
returns a fixture user. Doing it in resolution rather than in a runtime branch means a production
build contains no reference to the test fixtures at all.

```bash
npm run test:rules
```

Runs the Firestore security rules against the emulator, each suite against a fresh instance. See
[docs/deploy-rules.md](squadron-tracker/docs/deploy-rules.md) before deploying rules.

## Changelog

Shown on the welcome page and read from `public/changelog.json`. Add an entry there when
releasing; the highest version becomes the number displayed in the corner of the app.
