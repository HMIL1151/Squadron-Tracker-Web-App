/**
 * Squadron-level derivations for the statistics screen.
 *
 * Pure functions over the arrays DataContext already holds, so every figure on
 * that screen can be checked without rendering it. The screen itself decides
 * what to show; nothing here knows about React.
 *
 * Written against a real squadron's five-year backup rather than the test
 * fixture, which is where most of these came from. Several exist because that
 * data made a gap obvious:
 *
 *   A squadron had awarded a hundred Radio badges and never got anyone past
 *   Bronze. Nothing in the app said so, because every screen counted badges
 *   held rather than how far up each ladder people reached.
 *
 *   Seven per cent of its cadets had been to a camp. The event log knew; no
 *   screen asked.
 *
 *   Forty-five per cent of its records were entered more than ninety days
 *   after the thing happened, and eighty-six per cent of them by one person.
 *
 * Two facts about the data shape almost everything here:
 *
 *   Discharging a cadet deletes the CADET but not their RECORDS. In that
 *   backup, 738 of 1,522 records -- just under half -- belonged to people no
 *   longer on strength. That is how leavers are counted below: not from a
 *   discharge date, which does not exist, but from names in the log that are
 *   no longer on the books.
 *
 *   Dates are user-entered strings. That backup contained "20222-11-22". Every
 *   date here goes through parseDate, which returns null rather than throwing,
 *   and the unparseable ones are surfaced by dataQuality instead of silently
 *   vanishing from a total.
 */

import { classificationMap } from "./mappings";
import { getEventYear } from "./points";
import { normaliseFlights } from "./flights";

/** The badge ladder, low to high. Index is the rung. */
export const BADGE_ORDER = ["Blue", "Bronze", "Silver", "Gold"];

/**
 * A date, or null.
 *
 * Deliberately strict about the shape before handing anything to Date: the app
 * writes "YYYY-MM-DD", and `new Date("20222-11-22")` is not an error in
 * JavaScript, it is a date in the year 20222. Letting that through puts a
 * five-digit year on an axis and no warning anywhere.
 */
export const parseDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Whole months between two dates, by calendar arithmetic. */
const monthsBetween = (from, to) =>
  (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());

const fullName = (cadet) => `${cadet.forename} ${cadet.surname}`;

/** Records grouped by cadet name, trimmed -- stored names carry stray spaces. */
const groupByCadet = (events) => {
  const map = new Map();
  events.forEach((event) => {
    const name = String(event.cadetName || "").trim();
    if (!name) return;
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(event);
  });
  return map;
};

const isBadge = (event) => Boolean(event.badgeLevel && event.badgeCategory);

/**
 * How far up each badge ladder the squadron actually gets.
 *
 * Counts AWARDS at each level, and the conversion from one rung to the next.
 * A subject with sixty Blues and no Silvers is not a subject the squadron is
 * bad at -- it is usually a subject nobody is qualified to take further, which
 * is a staffing answer rather than a cadet one.
 *
 * `holders` is distinct cadets rather than awards, because one keen cadet
 * collecting four levels is not four cadets reached.
 */
export const badgeLadder = (events = []) => {
  const subjects = new Map();

  events.filter(isBadge).forEach((event) => {
    const subject = event.badgeCategory;
    if (!subjects.has(subject)) {
      subjects.set(subject, { subject, levels: {}, holders: new Set(), total: 0 });
    }
    const entry = subjects.get(subject);
    entry.levels[event.badgeLevel] = (entry.levels[event.badgeLevel] || 0) + 1;
    entry.holders.add(String(event.cadetName || "").trim());
    entry.total += 1;
  });

  return [...subjects.values()]
    .map((entry) => {
      const counts = BADGE_ORDER.map((level) => entry.levels[level] || 0);
      /*
       * The rung where the ladder stops.
       *
       * Reported as the highest level anyone has ever reached, which is the
       * blunt version of the question: "has this squadron ever produced a
       * Silver in this subject."
       */
      const reached = BADGE_ORDER.filter((level) => (entry.levels[level] || 0) > 0);
      return {
        subject: entry.subject,
        counts,
        levels: entry.levels,
        holders: entry.holders.size,
        total: entry.total,
        ceiling: reached.length ? reached[reached.length - 1] : null,
        /*
         * Conversion from each rung to the next. Null where the lower rung is
         * empty -- Cyber starts at Bronze in some squadrons, and reporting
         * "0% Blue to Bronze" for a subject with no Blue is nonsense.
         */
        conversion: BADGE_ORDER.slice(0, -1).map((level, index) => {
          const below = entry.levels[level] || 0;
          const above = entry.levels[BADGE_ORDER[index + 1]] || 0;
          return below === 0 ? null : above / below;
        }),
      };
    })
    .sort((a, b) => b.total - a.total);
};

/**
 * How many cadets have EVER had a record in each category.
 *
 * Reach, not volume. "Twenty-eight flying records" can be four cadets going
 * seven times; "twelve of forty-two cadets have flown" is the thing a squadron
 * is asked about and the thing that identifies who is missing out.
 *
 * Every configured category appears, including the ones nobody has ever used,
 * because a category at zero is either an opportunity the squadron does not
 * offer or a dropdown entry that should be retired -- and both are worth
 * seeing.
 */
export const categoryReach = (cadets = [], events = [], configured = []) => {
  const onStrength = new Set(cadets.map(fullName));
  const reach = new Map();

  configured.forEach((category) => {
    reach.set(category, { category, cadets: new Set(), records: 0, last: null, configured: true });
  });

  events.forEach((event) => {
    const category = event.eventCategory;
    if (!category) return;
    if (!reach.has(category)) {
      reach.set(category, { category, cadets: new Set(), records: 0, last: null, configured: false });
    }
    const entry = reach.get(category);
    entry.records += 1;
    const name = String(event.cadetName || "").trim();
    if (onStrength.has(name)) entry.cadets.add(name);
    if (event.date && (!entry.last || event.date > entry.last)) entry.last = event.date;
  });

  const total = onStrength.size || 1;
  return [...reach.values()]
    .map((entry) => ({
      category: entry.category,
      cadets: entry.cadets.size,
      share: entry.cadets.size / total,
      records: entry.records,
      last: entry.last,
      configured: entry.configured,
    }))
    .sort((a, b) => a.cadets - b.cadets || a.category.localeCompare(b.category));
};

/**
 * How long it takes a cadet here to reach each classification.
 *
 * From their start date to the date of the exam, in whole months. Only cadets
 * who have passed it appear in the distribution -- adding the ones who have
 * not as "infinity" would make the median meaningless -- so `outstanding`
 * carries the others, which is the number that matters for planning.
 */
export const timeToClassification = (cadets = [], events = [], examNames = []) => {
  const byCadet = groupByCadet(events);

  return examNames.map((examName) => {
    const months = [];
    const outstanding = [];

    cadets.forEach((cadet) => {
      const name = fullName(cadet);
      const start = parseDate(cadet.startDate);
      const passes = (byCadet.get(name) || [])
        .filter((event) => event.examName === examName)
        .map((event) => parseDate(event.date))
        .filter(Boolean)
        .sort((a, b) => a - b);

      if (!passes.length) {
        outstanding.push({
          id: cadet.id,
          name,
          flight: cadet.flight,
          months: start ? monthsBetween(start, new Date()) : null,
        });
        return;
      }
      if (!start) return;
      const gap = monthsBetween(start, passes[0]);
      if (gap >= 0) months.push(gap);
    });

    months.sort((a, b) => a - b);
    return {
      examName,
      passed: months.length,
      median: months.length ? months[Math.floor(months.length / 2)] : null,
      fastest: months.length ? months[0] : null,
      slowest: months.length ? months[months.length - 1] : null,
      months,
      /* Longest-serving first: the ones most overdue. */
      outstanding: outstanding.sort((a, b) => (b.months ?? -1) - (a.months ?? -1)),
    };
  });
};

/**
 * Whether the log is being kept up, rather than what is in it.
 *
 * The gap between a thing happening and somebody typing it in is the single
 * best predictor of whether a record exists at all: the real squadron this was
 * written against had a median lag of 44 days and a tail past a year, and 346
 * of its records were entered on one afternoon. A screen that only ever shows
 * what IS recorded cannot show that.
 *
 * `contributors` matters for a different reason. One person entering 86% of
 * everything is not a data problem, it is a succession problem.
 */
export const recordingHealth = (events = [], today = new Date()) => {
  const lags = [];
  let future = 0;

  events.forEach((event) => {
    const happened = parseDate(event.date);
    if (!happened) return;
    if (happened > today) future += 1;

    const createdAt = event.createdAt?.toDate
      ? event.createdAt.toDate()
      : event.createdAt
      ? new Date(event.createdAt)
      : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) return;

    lags.push(Math.round((createdAt - happened) / 86400000));
  });

  lags.sort((a, b) => a - b);

  const sessions = new Map();
  events.forEach((event) => {
    const createdAt = event.createdAt?.toDate
      ? event.createdAt.toDate()
      : event.createdAt
      ? new Date(event.createdAt)
      : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) return;
    const day = createdAt.toISOString().slice(0, 10);
    sessions.set(day, (sessions.get(day) || 0) + 1);
  });

  const contributors = new Map();
  events.forEach((event) => {
    const who = event.addedBy || "Unknown";
    contributors.set(who, (contributors.get(who) || 0) + 1);
  });
  const totalWithAuthor = [...contributors.values()].reduce((a, b) => a + b, 0) || 1;

  return {
    measured: lags.length,
    median: lags.length ? lags[Math.floor(lags.length / 2)] : null,
    sameWeek: lags.filter((lag) => lag >= 0 && lag <= 7).length,
    enteredEarly: lags.filter((lag) => lag < 0).length,
    overNinety: lags.filter((lag) => lag > 90).length,
    overAYear: lags.filter((lag) => lag > 365).length,
    future,
    entryDays: sessions.size,
    busiestDay: [...sessions.entries()].sort((a, b) => b[1] - a[1])[0] || null,
    contributors: [...contributors.entries()]
      .map(([name, count]) => ({ name, count, share: count / totalWithAuthor }))
      .sort((a, b) => b.count - a.count),
  };
};

/**
 * Cadets who have left, reconstructed from the records they left behind.
 *
 * There is no discharge date -- the Admin Area deletes a cadet outright -- so
 * this works backwards: a name that appears in the event log and is no longer
 * on strength belonged to someone who has gone.
 *
 * The span between their first and last record stands in for length of
 * service. It is a floor rather than a measurement: it cannot see time served
 * before their first record or after their last, and it cannot see a cadet who
 * left having never had anything logged. It is still the difference between
 * "we do not know" and "half of them were gone inside two and a half years".
 */
export const formerCadets = (cadets = [], events = []) => {
  const onStrength = new Set(cadets.map(fullName));
  const byCadet = groupByCadet(events);

  const leavers = [];
  byCadet.forEach((own, name) => {
    if (onStrength.has(name)) return;
    const dates = own.map((event) => parseDate(event.date)).filter(Boolean).sort((a, b) => a - b);
    if (!dates.length) return;

    const first = dates[0];
    const last = dates[dates.length - 1];
    leavers.push({
      name,
      records: own.length,
      first: first.toISOString().slice(0, 10),
      last: last.toISOString().slice(0, 10),
      months: monthsBetween(first, last),
      leftYear: last.getUTCFullYear(),
    });
  });

  const spans = leavers.map((leaver) => leaver.months).sort((a, b) => a - b);
  const byYear = new Map();
  leavers.forEach((leaver) => byYear.set(leaver.leftYear, (byYear.get(leaver.leftYear) || 0) + 1));

  return {
    leavers: leavers.sort((a, b) => b.last.localeCompare(a.last)),
    count: leavers.length,
    records: leavers.reduce((sum, leaver) => sum + leaver.records, 0),
    medianMonths: spans.length ? spans[Math.floor(spans.length / 2)] : null,
    underAYear: spans.filter((span) => span < 12).length,
    byYear: [...byYear.entries()].map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year),
  };
};

/**
 * When cadets join.
 *
 * Intake is seasonal -- the squadron this was written against took eleven of
 * its forty-two in August alone -- and a Second Class syllabus planned for a
 * steady trickle does not fit a squadron that recruits in waves.
 */
export const intake = (cadets = []) => {
  const byMonth = new Array(12).fill(0);
  const byYear = new Map();

  cadets.forEach((cadet) => {
    const start = parseDate(cadet.startDate);
    if (!start) return;
    byMonth[start.getUTCMonth()] += 1;
    const year = start.getUTCFullYear();
    byYear.set(year, (byYear.get(year) || 0) + 1);
  });

  return {
    byMonth,
    byYear: [...byYear.entries()].map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year),
    withoutStartDate: cadets.filter((cadet) => !parseDate(cadet.startDate)).length,
  };
};

/**
 * Rank against exams passed, and who is qualified but not promoted.
 *
 * Promotion is a judgement, not an arithmetic result, so this does not
 * recommend anybody. It shows the shape -- in the real squadron, Sergeants had
 * a median of eleven exams and Cadets two -- and then names the cadets who are
 * at or above the median of the rank ABOVE them, which is the succession
 * conversation rather than the answer to it.
 */
export const rankLadder = (cadets = [], events = [], rankMap = {}) => {
  const byCadet = groupByCadet(events);
  const examsFor = (name) => (byCadet.get(name) || []).filter((event) => event.examName).length;

  const rows = cadets.map((cadet) => ({
    id: cadet.id,
    name: fullName(cadet),
    flight: cadet.flight,
    rank: Number(cadet.rank) || 1,
    rankName: rankMap[cadet.rank] || "Cadet",
    exams: examsFor(fullName(cadet)),
  }));

  const ranks = [...new Set(rows.map((row) => row.rank))].sort((a, b) => a - b);
  const byRank = ranks.map((rank) => {
    const members = rows.filter((row) => row.rank === rank);
    const exams = members.map((member) => member.exams).sort((a, b) => a - b);
    return {
      rank,
      rankName: rankMap[rank] || `Rank ${rank}`,
      count: members.length,
      median: exams.length ? exams[Math.floor(exams.length / 2)] : 0,
    };
  });

  const medianOf = (rank) => byRank.find((entry) => entry.rank === rank)?.median ?? null;

  const ready = rows
    .filter((row) => {
      const next = medianOf(row.rank + 1);
      return next !== null && row.exams >= next;
    })
    .sort((a, b) => b.exams - a.exams);

  return { byRank, ready, rows };
};

/**
 * Things in the data that are almost certainly mistakes.
 *
 * Every one of these was found in a real backup, and every one is invisible on
 * every other screen: a record with an unparseable date silently drops out of
 * each total rather than showing up wrong, and a name with a double space
 * matches nothing.
 */
export const dataQuality = (cadets = [], events = [], configured = [], today = new Date()) => {
  const issues = [];

  const badDates = events.filter((event) => event.date && !parseDate(event.date));
  if (badDates.length) {
    issues.push({
      key: "bad-dates",
      severity: "high",
      title: `${badDates.length} ${badDates.length === 1 ? "record has" : "records have"} an impossible date`,
      detail:
        "Usually a typo in the year. These drop out of every total silently rather than showing up wrong.",
      examples: badDates.slice(0, 4).map((event) => `${event.cadetName || "?"} — ${event.date}`),
    });
  }

  const future = events.filter((event) => {
    const date = parseDate(event.date);
    return date && date > today;
  });
  if (future.length) {
    issues.push({
      key: "future",
      severity: "medium",
      title: `${future.length} ${future.length === 1 ? "record is" : "records are"} dated in the future`,
      detail: "Fine for something already booked; usually a mistyped year.",
      examples: future.slice(0, 4).map((event) => `${event.cadetName || "?"} — ${event.date}`),
    });
  }

  const uncategorised = events.filter(
    (event) => !event.badgeLevel && !event.examName && !event.eventCategory && !event.specialAward
  );
  if (uncategorised.length) {
    issues.push({
      key: "uncategorised",
      severity: "medium",
      title: `${uncategorised.length} ${uncategorised.length === 1 ? "record scores" : "records score"} nothing`,
      detail:
        "No badge, exam, category or award, so there is no price to look up. They count towards no total anywhere.",
      examples: uncategorised.slice(0, 4).map((event) => `${event.cadetName || "?"} — ${event.date || "no date"}`),
    });
  }

  const messy = cadets.filter((cadet) => {
    const raw = `${cadet.forename} ${cadet.surname}`;
    return raw !== raw.trim() || /\s{2,}/.test(raw) || cadet.forename !== cadet.forename?.trim();
  });
  if (messy.length) {
    issues.push({
      key: "whitespace",
      severity: "high",
      title: `${messy.length} cadet ${messy.length === 1 ? "name has" : "names have"} stray spaces`,
      detail:
        "Records are matched to cadets by name, so a double space or a trailing space quietly detaches a cadet from their own history.",
      examples: messy.slice(0, 4).map((cadet) => `"${cadet.forename} ${cadet.surname}"`),
    });
  }

  const missingStart = cadets.filter((cadet) => !parseDate(cadet.startDate));
  if (missingStart.length) {
    issues.push({
      key: "no-start",
      severity: "medium",
      title: `${missingStart.length} ${missingStart.length === 1 ? "cadet has" : "cadets have"} no usable start date`,
      detail: "Service length, classification targets and time-to-classification all need it.",
      examples: missingStart.slice(0, 4).map((cadet) => fullName(cadet)),
    });
  }

  const used = new Set(events.map((event) => event.eventCategory).filter(Boolean));
  const unused = configured.filter((category) => !used.has(category));
  if (unused.length) {
    issues.push({
      key: "unused-categories",
      severity: "low",
      title: `${unused.length} event ${unused.length === 1 ? "category has" : "categories have"} never been used`,
      detail:
        "Every one is a line in the Add Record dropdown. Retiring the ones you do not run makes the list quicker to work.",
      examples: unused.slice(0, 6),
    });
  }

  return issues;
};

/**
 * Each flight's age, from the earliest start date among its cadets.
 *
 * A flight three months old looks catastrophic next to one four years old, and
 * the comparison is meaningless without saying so. The real squadron this was
 * written against had a flight of ten cadets who had all joined that year.
 */
export const flightAges = (cadets = [], flights = []) =>
  normaliseFlights(flights)
    .map((flight, index) => {
      const members = cadets.filter((cadet) => Number(cadet.flight) === index + 1);
      const starts = members.map((cadet) => parseDate(cadet.startDate)).filter(Boolean).sort((a, b) => a - b);
      return {
        index: index + 1,
        name: flight.name,
        competing: flight.competing,
        archived: flight.archived,
        size: members.length,
        oldest: starts.length ? starts[0].toISOString().slice(0, 10) : null,
        months: starts.length ? monthsBetween(starts[0], new Date()) : null,
      };
    })
    .filter((flight) => !flight.archived);

/** Where every cadet sits on the classification ladder, as named rungs. */
export const classificationSpread = (derived = []) => {
  const RUNGS = ["Junior", "Second Class", "First Class", "Leading", "Senior", "Master"];
  return RUNGS.map((rung) => ({
    rung,
    count: derived.filter((entry) => String(entry.classificationLabel).startsWith(rung)).length,
  }));
};

/** The exam names this squadron has ever recorded, in syllabus order. */
export const examsUsed = (events = [], examList = []) => {
  const seen = new Map();
  events.forEach((event) => {
    if (!event.examName) return;
    seen.set(event.examName, (seen.get(event.examName) || 0) + 1);
  });
  const ordered = examList.filter((exam) => seen.has(exam));
  const extra = [...seen.keys()].filter((exam) => !examList.includes(exam));
  return [...ordered, ...extra].map((exam) => ({ exam, count: seen.get(exam) }));
};

/** A percentage, or an em dash when there is nothing to divide by. */
export const percent = (value) => (value === null || value === undefined ? "—" : `${Math.round(value * 100)}%`);

/** The classification label for a count of exams, matching the derived rule. */
export const labelForClassification = (index) => classificationMap[index] || classificationMap[1];

export default {
  badgeLadder,
  categoryReach,
  timeToClassification,
  recordingHealth,
  formerCadets,
  intake,
  rankLadder,
  dataQuality,
  flightAges,
  classificationSpread,
  examsUsed,
};
