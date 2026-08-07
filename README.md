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
| `npm run build` | Production build into `build/` |
| `npm test` | Test suite (watch mode) |
| `npm test -- --watchAll=false` | Test suite, single run — use this in CI |

## Deploying

```bash
cd squadron-tracker
npm run build
firebase deploy
```

Hosting config is in `firebase.json`; the project alias is in `.firebaserc`
(`squadron-tracker-1151`).

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

A cadet's `flight` is a **1-based index** into the squadron's `flights` array. Classification is
*derived* from the count of exam events, not stored.

## Changelog

Shown on the welcome page and read from `public/changelog.json`. Add an entry there when
releasing; the highest version becomes the number displayed in the corner of the app.
