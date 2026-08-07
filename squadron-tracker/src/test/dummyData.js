/**
 * The dummy squadrons.
 *
 * One dataset, four consumers:
 *   1. DataContext seeding for component tests    -> dataContextFor(9999)
 *   2. The in-memory fake Firestore               -> dummyData (flat path map)
 *   3. Emulator seeding for the rules tests       -> dummyData
 *   4. Offline dev mode                           -> dummyData
 *
 * Authoring it once and driving all four stops the test fixture and the
 * hand-testing dataset from drifting apart.
 *
 * Two squadrons on purpose:
 *
 *   9998 "Testwood"  flights are a legacy string[]. Proves the old shape keeps
 *                    working forever, not just during a migration window.
 *   9999 "Faketon"   flights are the new object[] shape, including an archived
 *                    flight and a non-competing one, so the Add/Edit Flights
 *                    edge cases have data from day one.
 *
 * Every date is chosen relative to FROZEN_NOW. Do not use `new Date()` here.
 */

/** The instant the test suite pretends it is. Fixed so snapshots never drift. */
export const FROZEN_NOW = new Date("2025-06-15T12:00:00Z");

/**
 * Firestore Timestamp stand-in. The app reads `.seconds`
 * (CadetsDashboardPopupManager.js, EventDetailsPopup.js) and `.toDate()`
 * (firestoreUtils.js fetchTeamPoints), so both are provided.
 */
export const timestamp = (iso) => {
  const ms = new Date(iso).getTime();
  return {
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1e6,
    toDate: () => new Date(ms),
  };
};

// ---------------------------------------------------------------------------
// Shared reference data (identical in both squadrons)
// ---------------------------------------------------------------------------

const BADGE_TYPES = ["Radio", "First Aid", "Shooting", "Adventure Training", "Sports", "Music"];

const BADGE_POINTS = {
  "Blue Badge": 5,
  "Bronze Badge": 10,
  "Silver Badge": 15,
  "Gold Badge": 20,
  Exam: 8,
  Special: 25,
};

const EVENT_CATEGORY_POINTS = {
  "Parade Night": 1,
  "Squadron Event": 3,
  "Wing Event": 5,
  "Regional Event": 8,
  "National Event": 12,
};

const SPECIAL_AWARDS = ["Cadet of the Year", "Most Improved Cadet", "Commandant's Commendation"];

/**
 * Blank event. Every EventLog document carries all nine fields with "" for the
 * unused ones -- that is what the app writes (databaseTools.js saveEvent), and
 * the points branches test truthiness, so the blanks matter.
 */
const event = (over) => ({
  addedBy: "Admin User",
  createdAt: timestamp("2025-06-01T09:00:00Z"),
  cadetName: "",
  date: "",
  badgeCategory: "",
  badgeLevel: "",
  examName: "",
  eventName: "",
  eventCategory: "",
  specialAward: "",
  ...over,
});

// ---------------------------------------------------------------------------
// Squadron 9999 "Faketon" -- new flight shape
// ---------------------------------------------------------------------------

/**
 * Index is identity: a cadet's `flight` field is a 1-based index into this
 * array. Charlie is archived; Staff Team does not compete.
 */
export const FAKETON_FLIGHTS = [
  { name: "Staff Team", competing: false, archived: false },
  { name: "Alpha", competing: true, archived: false },
  { name: "Bravo", competing: true, archived: false },
  { name: "Charlie", competing: true, archived: true },
];

const FAKETON_CADETS = {
  // Long service, decorated -- exercises most scoring branches at once.
  "cadet-9999-01": { forename: "Amelia", surname: "Hart", startDate: "2021-09-06", flight: 2, rank: 3 },
  "cadet-9999-02": { forename: "Ben", surname: "Okafor", startDate: "2024-01-15", flight: 2, rank: 1 },
  "cadet-9999-03": { forename: "Chloe", surname: "Ramsey", startDate: "2023-03-20", flight: 2, rank: 2 },
  "cadet-9999-04": { forename: "Daniel", surname: "Foster", startDate: "2024-09-02", flight: 3, rank: 1 },
  "cadet-9999-05": { forename: "Eve", surname: "Nakamura", startDate: "2020-05-11", flight: 3, rank: 4 },
  // Joined four months before FROZEN_NOW -- short service length.
  "cadet-9999-06": { forename: "Femi", surname: "Adeyemi", startDate: "2025-02-10", flight: 3, rank: 1 },
  // Sits in the archived flight -- must still render and keep their points.
  "cadet-9999-07": { forename: "Grace", surname: "O'Neill", startDate: "2023-11-01", flight: 4, rank: 1 },
  // Hyphenated surname, and in the non-competing staff flight.
  "cadet-9999-08": { forename: "Harry", surname: "Blythe-Jones", startDate: "2019-04-08", flight: 1, rank: 5 },
  // No events at all -- the empty case every aggregate has to survive.
  "cadet-9999-09": { forename: "Isla", surname: "Muir", startDate: "2025-05-01", flight: 2, rank: 1 },
  "cadet-9999-10": { forename: "Jack", surname: "Petrov", startDate: "2022-07-19", flight: 3, rank: 2 },
};

const FAKETON_EVENTS = {
  // -- Amelia Hart: badges at three levels, two exams, an event, an award
  "event-9999-01": event({ cadetName: "Amelia Hart", date: "2024-03-12", badgeCategory: "Radio", badgeLevel: "Blue" }),
  "event-9999-02": event({ cadetName: "Amelia Hart", date: "2024-11-05", badgeCategory: "Radio", badgeLevel: "Bronze" }),
  "event-9999-03": event({ cadetName: "Amelia Hart", date: "2025-04-18", badgeCategory: "Radio", badgeLevel: "Silver" }),
  "event-9999-04": event({ cadetName: "Amelia Hart", date: "2024-06-01", examName: "First Class Cadet" }),
  "event-9999-05": event({ cadetName: "Amelia Hart", date: "2025-02-20", examName: "Leading: Airmanship Knowledge Exam" }),
  "event-9999-06": event({ cadetName: "Amelia Hart", date: "2025-05-10", eventName: "Wing Athletics", eventCategory: "Wing Event" }),
  "event-9999-07": event({ cadetName: "Amelia Hart", date: "2024-12-15", specialAward: "Cadet of the Year" }),

  // -- Ben Okafor
  // THE BOUNDARY EVENT. `new Date("2025-01-01").getFullYear()` is 2024 west of
  // UTC, while `"2025-01-01".slice(0,4)` is 2025. FightPointsDashboard uses the
  // former and firestoreUtils the latter, so this one row makes the three points
  // implementations disagree. Phase 6 exists to fix that; do not move this date.
  "event-9999-08": event({ cadetName: "Ben Okafor", date: "2025-01-01", badgeCategory: "First Aid", badgeLevel: "Blue" }),
  "event-9999-09": event({ cadetName: "Ben Okafor", date: "2025-03-06", eventName: "Weekly Parade", eventCategory: "Parade Night" }),

  // -- Chloe Ramsey
  "event-9999-10": event({ cadetName: "Chloe Ramsey", date: "2024-05-14", badgeCategory: "Shooting", badgeLevel: "Blue" }),
  "event-9999-11": event({ cadetName: "Chloe Ramsey", date: "2025-03-22", badgeCategory: "Shooting", badgeLevel: "Bronze" }),
  "event-9999-12": event({ cadetName: "Chloe Ramsey", date: "2024-09-10", examName: "Second Class Cadet" }),
  "event-9999-13": event({ cadetName: "Chloe Ramsey", date: "2025-04-05", eventName: "Sqn Fieldcraft Day", eventCategory: "Squadron Event" }),

  // -- Daniel Foster
  "event-9999-14": event({ cadetName: "Daniel Foster", date: "2025-02-28", badgeCategory: "Sports", badgeLevel: "Blue" }),
  "event-9999-15": event({ cadetName: "Daniel Foster", date: "2025-05-08", eventName: "Weekly Parade", eventCategory: "Parade Night" }),

  // -- Eve Nakamura: the only Gold badge, plus a plain JS Date createdAt to
  //    cover EventDetailsPopup's non-Timestamp branch.
  "event-9999-16": event({ cadetName: "Eve Nakamura", date: "2024-08-19", badgeCategory: "Adventure Training", badgeLevel: "Silver" }),
  "event-9999-17": event({ cadetName: "Eve Nakamura", date: "2025-01-30", badgeCategory: "Adventure Training", badgeLevel: "Gold", createdAt: new Date("2025-01-30T18:30:00Z") }),
  "event-9999-18": event({ cadetName: "Eve Nakamura", date: "2025-03-11", examName: "Senior/Master: Air Power Exam" }),
  "event-9999-19": event({ cadetName: "Eve Nakamura", date: "2024-07-22", eventName: "National Aerospace Camp", eventCategory: "National Event" }),
  "event-9999-20": event({ cadetName: "Eve Nakamura", date: "2025-05-30", specialAward: "Most Improved Cadet" }),

  // -- Femi Adeyemi
  "event-9999-21": event({ cadetName: "Femi Adeyemi", date: "2025-04-12", badgeCategory: "Music", badgeLevel: "Blue" }),

  // -- Grace O'Neill (archived flight -- points must survive archiving)
  "event-9999-22": event({ cadetName: "Grace O'Neill", date: "2024-10-08", badgeCategory: "Radio", badgeLevel: "Blue" }),
  "event-9999-23": event({ cadetName: "Grace O'Neill", date: "2025-02-14", eventName: "Regional Band Camp", eventCategory: "Regional Event" }),

  // -- Harry Blythe-Jones (staff flight -- scores points but does not compete)
  "event-9999-24": event({ cadetName: "Harry Blythe-Jones", date: "2024-04-02", badgeCategory: "Shooting", badgeLevel: "Gold" }),
  "event-9999-25": event({ cadetName: "Harry Blythe-Jones", date: "2025-01-20", specialAward: "Commandant's Commendation" }),

  // -- Isla Muir: intentionally none.

  // -- Jack Petrov
  "event-9999-26": event({ cadetName: "Jack Petrov", date: "2024-12-03", badgeCategory: "First Aid", badgeLevel: "Bronze" }),
  "event-9999-27": event({ cadetName: "Jack Petrov", date: "2025-06-01", badgeCategory: "First Aid", badgeLevel: "Silver" }),
  "event-9999-28": event({ cadetName: "Jack Petrov", date: "2025-01-15", examName: "Leading: Principles of Flight Exam" }),
  // eventName set but eventCategory blank. MassEventLog keys category points off
  // eventName, FightPointsDashboard off eventCategory -- so this row scores
  // differently in the two dashboards today. Second input to Phase 6.
  "event-9999-29": event({ cadetName: "Jack Petrov", date: "2025-03-29", eventName: "Ad-hoc Range Day" }),
};

// ---------------------------------------------------------------------------
// Squadron 9998 "Testwood" -- legacy flight shape
// ---------------------------------------------------------------------------

/** Legacy string[]. normaliseFlights() must keep treating index 0 as staff. */
export const TESTWOOD_FLIGHTS = ["Staff Team", "Atlas", "Tempest"];

const TESTWOOD_CADETS = {
  "cadet-9998-01": { forename: "Katie", surname: "Lawson", startDate: "2022-09-05", flight: 2, rank: 2 },
  "cadet-9998-02": { forename: "Liam", surname: "Doyle", startDate: "2024-02-12", flight: 2, rank: 1 },
  "cadet-9998-03": { forename: "Maya", surname: "Sharma", startDate: "2021-01-11", flight: 3, rank: 3 },
  "cadet-9998-04": { forename: "Noah", surname: "Bright", startDate: "2018-06-04", flight: 1, rank: 5 },
};

const TESTWOOD_EVENTS = {
  "event-9998-01": event({ addedBy: "Testwood Admin", cadetName: "Katie Lawson", date: "2024-06-18", badgeCategory: "Radio", badgeLevel: "Blue" }),
  "event-9998-02": event({ addedBy: "Testwood Admin", cadetName: "Katie Lawson", date: "2025-03-04", examName: "First Class Cadet" }),
  "event-9998-03": event({ addedBy: "Testwood Admin", cadetName: "Liam Doyle", date: "2025-04-22", eventName: "Weekly Parade", eventCategory: "Parade Night" }),
  "event-9998-04": event({ addedBy: "Testwood Admin", cadetName: "Maya Sharma", date: "2024-10-30", badgeCategory: "First Aid", badgeLevel: "Bronze" }),
  "event-9998-05": event({ addedBy: "Testwood Admin", cadetName: "Maya Sharma", date: "2025-05-16", specialAward: "Cadet of the Year" }),
  "event-9998-06": event({ addedBy: "Testwood Admin", cadetName: "Noah Bright", date: "2025-02-08", badgeCategory: "Sports", badgeLevel: "Silver" }),
};

// ---------------------------------------------------------------------------
// FlightPoints documents
// ---------------------------------------------------------------------------

/**
 * TeamPoints are bonus points an admin allocates directly to a flight, keyed by
 * the same 1-based flight index. fetchTeamPoints zeroes them when LastLoginDate
 * is not the current year, so both variants are needed to test that branch.
 */
const teamPoints = (points, loginIso) => ({ ...points, LastLoginDate: timestamp(loginIso) });

const flightPointsDocs = (points, loginIso) => ({
  "Badge Points": { ...BADGE_POINTS },
  "Event Category Points": { ...EVENT_CATEGORY_POINTS },
  Badges: { "Badge Types": [...BADGE_TYPES] },
  "Special Awards": { "Special Awards": [...SPECIAL_AWARDS] },
  TeamPoints: teamPoints(points, loginIso),
});

/** Same year as FROZEN_NOW -- fetchTeamPoints returns these unchanged. */
const FAKETON_TEAM_POINTS = { 1: 0, 2: 40, 3: 25, 4: 10 };

/**
 * Prior-year login. fetchTeamPoints must zero every field. Not part of the main
 * dataset -- swap it in for the rollover test.
 */
export const STALE_TEAM_POINTS = teamPoints(FAKETON_TEAM_POINTS, "2024-11-02T20:15:00Z");

// ---------------------------------------------------------------------------
// Users, requests, and the top-level template collection
// ---------------------------------------------------------------------------

export const UIDS = {
  faketonAdmin: "uid-faketon-admin",
  faketonUser: "uid-faketon-user",
  testwoodAdmin: "uid-testwood-admin",
  systemAdmin: "uid-system-admin",
  // Signed in, but authorised for nothing. checkUserRole -> "First Login".
  stranger: "uid-stranger",
};

/**
 * Top-level FlightPoints collection. Copied wholesale into a new squadron on
 * creation (WelcomePage handleSetupConfirm, SystemAdminDashboard handleApprove).
 */
const TEMPLATE_FLIGHT_POINTS = flightPointsDocs({ 1: 0, 2: 0, 3: 0 }, "2025-06-15T08:00:00Z");

// ---------------------------------------------------------------------------
// Flatten to Firestore paths
// ---------------------------------------------------------------------------

const flatten = (out, prefix, docs) => {
  Object.entries(docs).forEach(([id, data]) => {
    out[`${prefix}/${id}`] = data;
  });
  return out;
};

const squadronDocs = (number, { cadets, events, flightPoints, authorised, requests }) => {
  const base = `SquadronDatabases/${number}`;
  const out = { [base]: {} };
  flatten(out, `${base}/Cadets`, cadets);
  flatten(out, `${base}/EventLog`, events);
  flatten(out, `${base}/FlightPoints`, flightPoints);
  flatten(out, `${base}/AuthorisedUsers`, authorised);
  flatten(out, `${base}/UserRequests`, requests);
  return out;
};

const withMeta = (cadets, addedBy) =>
  Object.fromEntries(
    Object.entries(cadets).map(([id, c]) => [
      id,
      { ...c, addedBy, createdAt: timestamp("2025-01-05T10:00:00Z") },
    ])
  );

/**
 * Every document, keyed by full Firestore path. Collections are implied by the
 * path prefix -- the same model Firestore itself uses, and what the fake and the
 * emulator seeder both consume.
 */
export const dummyData = {
  // -- Top level ------------------------------------------------------------
  "SquadronList/sqnlist-faketon": { Name: "Faketon", Number: 9999, flights: FAKETON_FLIGHTS },
  "SquadronList/sqnlist-testwood": { Name: "Testwood", Number: 9998, flights: TESTWOOD_FLIGHTS },

  "MassUserList/mul-01": { UID: UIDS.faketonAdmin, Squadron: 9999 },
  "MassUserList/mul-02": { UID: UIDS.faketonUser, Squadron: 9999 },
  "MassUserList/mul-03": { UID: UIDS.testwoodAdmin, Squadron: 9998 },
  "MassUserList/mul-04": { UID: UIDS.systemAdmin, systemAdmin: true },

  "NewAccountRequests/nar-01": {
    squadronName: "Newtown",
    squadronNumber: 9997,
    flight1Name: "Staff Team",
    flight2Name: "Vulcan",
    flight3Name: "Lightning",
    displayName: "Hopeful Admin",
    uid: "uid-hopeful",
    email: "hopeful@example.test",
    timestamp: "2025-06-10T14:00:00.000Z",
  },

  ...flatten({}, "FlightPoints", TEMPLATE_FLIGHT_POINTS),

  // -- Squadron 9999 "Faketon" ---------------------------------------------
  ...squadronDocs(9999, {
    cadets: withMeta(FAKETON_CADETS, "Admin User"),
    events: FAKETON_EVENTS,
    flightPoints: flightPointsDocs(FAKETON_TEAM_POINTS, "2025-06-14T19:45:00Z"),
    authorised: {
      [UIDS.faketonAdmin]: { displayName: "Admin User", email: "admin@faketon.test", role: "admin" },
      [UIDS.faketonUser]: { displayName: "Plain User", email: "user@faketon.test", role: "user" },
    },
    requests: {
      "req-9999-pending": {
        displayName: "Pending Person",
        email: "pending@faketon.test",
        uid: "uid-pending",
        progress: "pending",
        timestamp: "2025-06-12T11:30:00.000Z",
      },
      "req-9999-granted": {
        displayName: "Plain User",
        email: "user@faketon.test",
        uid: UIDS.faketonUser,
        progress: "granted",
        timestamp: "2025-02-01T09:00:00.000Z",
      },
      "req-9999-denied": {
        displayName: "Denied Person",
        email: "denied@faketon.test",
        uid: "uid-denied",
        progress: "denied",
        timestamp: "2025-04-20T16:00:00.000Z",
      },
    },
  }),

  // -- Squadron 9998 "Testwood" --------------------------------------------
  ...squadronDocs(9998, {
    cadets: withMeta(TESTWOOD_CADETS, "Testwood Admin"),
    events: TESTWOOD_EVENTS,
    flightPoints: flightPointsDocs({ 1: 0, 2: 30, 3: 15 }, "2025-06-13T20:00:00Z"),
    authorised: {
      [UIDS.testwoodAdmin]: { displayName: "Testwood Admin", email: "admin@testwood.test", role: "admin" },
    },
    requests: {
      "req-9998-granted": {
        displayName: "Testwood Admin",
        email: "admin@testwood.test",
        uid: UIDS.testwoodAdmin,
        progress: "granted",
        timestamp: "2025-01-02T09:00:00.000Z",
      },
    },
  }),
};

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

const docsUnder = (collectionPath) =>
  Object.entries(dummyData)
    .filter(([path]) => {
      if (!path.startsWith(`${collectionPath}/`)) return false;
      // Direct children only -- "A/b" under "A", not "A/b/C/d".
      return path.slice(collectionPath.length + 1).indexOf("/") === -1;
    })
    .map(([path, data]) => ({ id: path.split("/").pop(), ...data }));

/**
 * The shape DataContext holds, for seeding component tests. Mirrors
 * DataContext.fetchData exactly, including its sort by forename.
 */
export const dataContextFor = (squadronNumber) => {
  const base = `SquadronDatabases/${squadronNumber}`;
  const flightPoints = {};
  docsUnder(`${base}/FlightPoints`).forEach(({ id, ...rest }) => {
    flightPoints[id] = rest;
  });

  return {
    cadets: docsUnder(`${base}/Cadets`).sort((a, b) => a.forename.localeCompare(b.forename)),
    events: docsUnder(`${base}/EventLog`),
    flightPoints,
  };
};

/** The `user` prop App passes to every dashboard. */
export const userFor = (squadronNumber, { role = "admin", systemAdmin = false } = {}) => {
  const isFaketon = Number(squadronNumber) === 9999;
  return {
    displayName: isFaketon ? "Admin User" : "Testwood Admin",
    uid: isFaketon ? UIDS.faketonAdmin : UIDS.testwoodAdmin,
    squadronName: isFaketon ? "Faketon" : "Testwood",
    squadronNumber: Number(squadronNumber),
    flightNames: isFaketon ? FAKETON_FLIGHTS : TESTWOOD_FLIGHTS,
    role,
    systemAdmin,
  };
};

export const SQUADRONS = { FAKETON: 9999, TESTWOOD: 9998 };
