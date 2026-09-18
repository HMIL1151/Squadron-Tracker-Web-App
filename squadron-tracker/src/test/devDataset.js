/**
 * A squadron big enough to look like a squadron, for offline dev only.
 *
 * Deliberately NOT part of dummyData.
 *
 * dummyData is the test fixture, and almost every value in it is load-bearing:
 * the 1 January event that makes the three points implementations disagree, the
 * archived flight, the cadet with no records at all, the hyphenated surname.
 * Ten cadets that each mean something is exactly what a test suite wants, and
 * exactly what a UI is impossible to judge on -- a table of ten rows tells you
 * nothing about how it behaves at forty, and a year filter over one year of
 * history tells you nothing at all.
 *
 * So this layers on top: the fixture squadron keeps its ten deliberate cadets
 * and gains thirty ordinary ones, plus four training years of records. Tests
 * import dummyData and never see any of it; only db.js's offline branch pulls
 * this in, and that branch is dropped from production builds at resolution
 * time (see firebase/db.js).
 *
 * Generated from a fixed seed, so reloading the dev server gives the same
 * squadron every time. A dataset that reshuffled on every reload would make it
 * impossible to tell a rendering bug from new data.
 */

import { timestamp } from "./dummyData";

const SQUADRON = 9999;

/*
 * Mulberry32. Thirty lines of Math.random() would be a different squadron on
 * every reload, and "is that number wrong or just different?" is not a question
 * anyone should have to ask while looking at a screen.
 */
const makeRandom = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const FORENAMES = [
  "Aisha", "Callum", "Priya", "Rory", "Maya", "Ellis", "Nadia", "Theo",
  "Leila", "Marcus", "Sian", "Oscar", "Amara", "Finlay", "Zara", "Duncan",
  "Bethan", "Kwame", "Imogen", "Rhys", "Tilly", "Joss", "Meena", "Alfie",
  "Rosa", "Hamish", "Freya", "Idris", "Lottie", "Nathan",
];

const SURNAMES = [
  "Ashworth", "Brennan", "Cardoso", "Doherty", "Eriksen", "Fairbairn",
  "Gallagher", "Hollis", "Iqbal", "Jarvis", "Kowalski", "Lindqvist",
  "Mensah", "Novak", "Oyelaran", "Pemberton", "Quayle", "Rahman",
  "Sinclair", "Tremayne", "Ubani", "Vasquez", "Whitlock", "Xiao",
  "Yardley", "Zielinski", "Ashby", "Buchanan", "Crowther", "Delaney",
];

/** Matches FAKETON_FLIGHTS: 1 Staff Team, 2 Alpha, 3 Bravo, 4 Charlie (archived). */
const ASSIGNABLE_FLIGHTS = [2, 3];

const BADGE_TYPES = ["Radio", "First Aid", "Shooting", "Adventure Training", "Sports", "Music"];
const BADGE_LEVELS = ["Blue", "Bronze", "Silver", "Gold"];
const EVENT_CATEGORIES = ["Parade Night", "Squadron Event", "Wing Event", "Regional Event", "National Event"];
const SPECIAL_AWARDS = ["Cadet of the Year", "Most Improved Cadet", "Commandant's Commendation"];

const EXAMS = [
  "Second Class Cadet",
  "First Class Cadet",
  "Leading: Principles of Flight Exam",
  "Leading: Airmanship Knowledge Exam",
  "Leading: Basic Navigation using a Map and Compass Exam",
  "Senior/Master: Air Power Exam",
  "Senior/Master: Airframes Exam",
  "Senior/Master: Piston Engine Propulsion Exam",
  "Senior/Master: Jet Engine Propulsion Exam",
  "Senior/Master: Principles of Rocketry Exam",
];

const SQUADRON_EVENTS = [
  ["Weekly Parade", "Parade Night"],
  ["Sqn Fieldcraft Day", "Squadron Event"],
  ["Station Visit", "Squadron Event"],
  ["Wing Athletics", "Wing Event"],
  ["Wing Swimming Gala", "Wing Event"],
  ["Wing Field Day", "Wing Event"],
  ["Regional Shooting Competition", "Regional Event"],
  ["Regional Sports Finals", "Regional Event"],
  ["National Air Cadet Camp", "National Event"],
  ["Sqn Open Evening", "Squadron Event"],
  ["Range Day", "Squadron Event"],
  ["Adventure Training Weekend", "Squadron Event"],
];

/** Every EventLog document carries all nine fields; the blanks are meaningful. */
const event = (over) => ({
  addedBy: "Admin User",
  createdAt: timestamp("2025-01-05T10:00:00Z"),
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

const pad = (n) => String(n).padStart(2, "0");

/**
 * The four training years the dev squadron has history for.
 *
 * Four rather than one because the statistics screen compares a year against
 * the ones before it, and a comparison needs something to compare to. The last
 * is partial, which is what a training year in progress actually looks like.
 */
const YEARS = [2023, 2024, 2025, 2026];

/**
 * Generates the extra cadets and their records.
 *
 * Returns a flat path -> document map, the same shape dummyData uses, ready to
 * be merged over it.
 */
export const buildDevSquadron = () => {
  const random = makeRandom(20260918);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const between = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));

  const docs = {};
  const base = `SquadronDatabases/${SQUADRON}`;

  const cadets = [];
  for (let i = 0; i < 30; i += 1) {
    const forename = FORENAMES[i];
    const surname = SURNAMES[i];
    const joinYear = pick([2021, 2022, 2022, 2023, 2023, 2024, 2024, 2025, 2025, 2026]);
    const cadet = {
      forename,
      surname,
      startDate: `${joinYear}-${pad(between(1, 12))}-${pad(between(1, 28))}`,
      flight: pick(ASSIGNABLE_FLIGHTS),
      /*
       * Ranks thin out towards the top, the way a squadron's do. Nobody is
       * made a Cadet Warrant Officer in their first year.
       */
      rank: joinYear <= 2022 ? pick([1, 2, 2, 3, 3, 4, 5]) : joinYear <= 2024 ? pick([1, 1, 1, 2, 2, 3]) : 1,
      addedBy: "Admin User",
      createdAt: timestamp("2025-01-05T10:00:00Z"),
    };
    cadets.push(cadet);
    docs[`${base}/Cadets/dev-cadet-${pad(i + 1)}`] = cadet;
  }

  let eventId = 0;

  /*
   * Records are entered after the thing happened, and the gap is the point.
   *
   * Every generated event used to carry the same createdAt, which made the
   * Record Keeping statistics report a typical lag of MINUS 23 days -- one
   * entry stamp sitting before most of the dates it was meant to follow. The
   * real squadron backup this screen was written against had a median of 44
   * days with a long tail, so that is the shape generated here: most things
   * written up within a few weeks, a minority caught up on months later.
   */
  const lag = () => {
    const roll = random();
    if (roll < 0.55) return between(0, 21);
    if (roll < 0.85) return between(22, 120);
    return between(121, 500);
  };

  const enteredAfter = (date, days) => {
    const entered = new Date(`${date}T19:30:00Z`);
    entered.setUTCDate(entered.getUTCDate() + days);
    return timestamp(entered.toISOString());
  };

  /*
   * One person enters 86% of the log in the real squadron. That concentration
   * is the finding, so it is generated rather than smoothed away -- but not as
   * 100%, or the "who enters records" panel has nothing to compare against.
   */
  const OTHER_STAFF = ["Flt Lt Reed", "Sgt Okafor", "CI Mwangi"];

  const add = (over) => {
    eventId += 1;
    const defaults = { addedBy: random() < 0.86 ? "Admin User" : pick(OTHER_STAFF) };
    if (over.date) defaults.createdAt = enteredAfter(over.date, lag());
    docs[`${base}/EventLog/dev-event-${String(eventId).padStart(4, "0")}`] = event({
      ...defaults,
      ...over,
    });
  };

  cadets.forEach((cadet) => {
    const name = `${cadet.forename} ${cadet.surname}`;
    const joined = Number(cadet.startDate.slice(0, 4));

    /*
     * How active a cadet is stays constant across years. Real squadrons have
     * keen cadets and quiet ones, and a dataset where everyone is equally
     * active makes the "is recognition reaching everyone" question meaningless.
     */
    const keenness = random();
    const examsTaken = [];

    YEARS.forEach((year) => {
      if (year < joined) return;

      // A partial final year, the way a year in progress actually looks.
      const lastMonth = year === YEARS.at(-1) ? 9 : 12;

      const parades = Math.round((3 + keenness * 9) * (lastMonth / 12));
      for (let p = 0; p < parades; p += 1) {
        const [eventName, eventCategory] = pick(SQUADRON_EVENTS);
        add({
          cadetName: name,
          date: `${year}-${pad(between(1, lastMonth))}-${pad(between(1, 28))}`,
          eventName,
          eventCategory,
        });
      }

      const badges = Math.round(keenness * 3);
      for (let b = 0; b < badges; b += 1) {
        add({
          cadetName: name,
          date: `${year}-${pad(between(1, lastMonth))}-${pad(between(1, 28))}`,
          badgeCategory: pick(BADGE_TYPES),
          badgeLevel: pick(BADGE_LEVELS.slice(0, Math.min(4, 1 + Math.floor(keenness * 4)))),
        });
      }

      // Exams are taken in order, so classification comes out sensible.
      const exams = Math.round(keenness * 2.5);
      for (let e = 0; e < exams; e += 1) {
        const next = EXAMS[examsTaken.length];
        if (!next) break;
        examsTaken.push(next);
        add({
          cadetName: name,
          date: `${year}-${pad(between(1, lastMonth))}-${pad(between(1, 28))}`,
          examName: next,
        });
      }

      if (keenness > 0.86 && random() > 0.6) {
        add({
          cadetName: name,
          date: `${year}-${pad(between(6, lastMonth))}-${pad(between(1, 28))}`,
          specialAward: pick(SPECIAL_AWARDS),
        });
      }
    });
  });

  /*
   * Cadets who have left, which is a thing this dataset could not previously
   * represent at all.
   *
   * Discharging a cadet deletes the Cadets document and leaves the EventLog
   * alone, so a leaver exists in the data ONLY as a name in the log with
   * nobody on strength to match it. Generating cadets and then generating
   * records for them can never produce that shape: it has to be records
   * written for people who were deliberately never added.
   *
   * Without these the Retention panel reads zero on a squadron with four
   * years of history, which looks like a broken panel rather than a squadron
   * that has never lost anybody.
   */
  const LEAVERS = [
    { name: "Dominic Farrow", from: 2023, to: 2024 },
    { name: "Priya Chandra", from: 2023, to: 2025 },
    { name: "Ewan Tait", from: 2023, to: 2023 },
    { name: "Cerys Pritchard", from: 2024, to: 2026 },
    { name: "Malachi Owusu", from: 2024, to: 2025 },
    { name: "Sofia Renzi", from: 2024, to: 2024 },
    { name: "Hector Vane", from: 2025, to: 2026 },
    { name: "Nell Ashcombe", from: 2025, to: 2025 },
  ];

  LEAVERS.forEach((leaver) => {
    for (let year = leaver.from; year <= leaver.to; year += 1) {
      const lastMonth = year === YEARS.at(-1) ? 9 : 12;
      const count = between(3, 9);
      for (let i = 0; i < count; i += 1) {
        const [eventName, eventCategory] = pick(SQUADRON_EVENTS);
        add({
          cadetName: leaver.name,
          date: `${year}-${pad(between(1, lastMonth))}-${pad(between(1, 28))}`,
          eventName,
          eventCategory,
        });
      }
      if (random() > 0.5) {
        add({
          cadetName: leaver.name,
          date: `${year}-${pad(between(1, lastMonth))}-${pad(between(1, 28))}`,
          examName: pick(EXAMS.slice(0, 4)),
        });
      }
    }
  });

  return docs;
};

export default buildDevSquadron;
