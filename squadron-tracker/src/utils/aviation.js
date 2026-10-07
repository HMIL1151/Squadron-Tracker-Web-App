/**
 * Flying and gliding: which event log records are a flight or a glide, and
 * how many of each a cadet has had.
 *
 * A flight is an ordinary Event/Other record -- "AEF at RAF Benson", Squadron
 * Event, three points -- that ALSO carries `aviation: "flying"` (or
 * "gliding"). It was nearly a pair of event categories called Flying and
 * Gliding, which is less code, but a record has one category and squadrons
 * already use it for what a record is worth: an AEF day logged as a Wing
 * Event would have had to choose between scoring properly and counting as a
 * flight. A tag beside the category asks it to do neither job twice.
 *
 * Records written before the tag existed have no `aviation` at all, and four
 * years of "Gliding Induction Course" records that count for nothing would
 * make the columns look broken on the day they ship. So an untagged record is
 * GUESSED from its description, then its category -- see guessAviation. An
 * explicit tag always beats the guess, including `"none"`, which is how a
 * record called "RAF Museum Flying Display" is told it was not a flight.
 *
 * Totals a cadet's logged records cannot reach -- the flights from before the
 * squadron used this app -- are set by hand on the PTS board and stored on the
 * cadet as an override; see summariseAviation for how the two combine.
 *
 * Dates stay "YYYY-MM-DD" strings and are compared as strings, for the reason
 * given at the top of points.js.
 */

/*
 * The field names are the stored values. `none` is only ever written when it
 * overrules a guess, so a parade night record carries no aviation field at
 * all and is stored exactly as it always was.
 */
export const AVIATION_KINDS = ["flying", "gliding"];
export const AVIATION_NONE = "none";

export const AVIATION = {
  flying: {
    key: "flying",
    field: "flyingOverride",
    group: "Flying",
    countHeader: "Flights",
    lastHeader: "Last Flight",
    noun: "flight",
    nouns: "flights",
    tag: "Flight",
  },
  gliding: {
    key: "gliding",
    field: "glidingOverride",
    group: "Gliding",
    countHeader: "Glides",
    lastHeader: "Last Glide",
    noun: "glide",
    nouns: "glides",
    tag: "Glide",
  },
};

/*
 * Deliberately narrow.
 *
 * "Flight" is NOT a flying word here: every cadet is in a flight, and "Alpha
 * Flight Quiz Night" counting as a sortie would be wrong on the first day.
 * Neither is "air" alone. What is left is the vocabulary RAFAC actually uses
 * for the two things -- AEF, Air Experience, flying; gliding, GIF, GIC, and
 * the gliders by name -- and a miss costs one click to retag, where a false
 * hit quietly inflates a total nobody checks.
 */
const FLYING_WORDS = /\bfly(ing)?\b|\bflew\b|\baef\b|air experience/i;
const GLIDING_WORDS = /glid(e|er|ers|es|ing)\b|\bgif\b|\bgic\b|\bviking\b|\bvigilant\b/i;

const kindsIn = (text) => {
  const found = [];
  if (FLYING_WORDS.test(text || "")) found.push("flying");
  if (GLIDING_WORDS.test(text || "")) found.push("gliding");
  return found;
};

/**
 * What a description and category look like: "flying", "gliding" or null.
 *
 * The description is asked first, because it is the specific thing: a
 * squadron with one "Flying/Gliding" category can only be told apart by what
 * the record was called. The category is the fallback for records whose name
 * says nothing -- "Day out at RAF Syerston" filed under Gliding. Anything that
 * matches both at the same level is left alone rather than guessed.
 */
export const guessAviation = ({ eventName = "", eventCategory = "" } = {}) => {
  const fromName = kindsIn(eventName);
  if (fromName.length === 1) return fromName[0];
  if (fromName.length > 1) return null;
  const fromCategory = kindsIn(eventCategory);
  return fromCategory.length === 1 ? fromCategory[0] : null;
};

/**
 * Whether a record is an Event/Other one, the only kind that can be a flight.
 *
 * A Silver Radio badge, an exam called "Aircraft Handling and Flying
 * Techniques", a special award and a weapon handling test are never a sortie,
 * whatever they are called.
 */
export const isActivity = (event) =>
  Boolean(event) &&
  !event.badgeCategory &&
  !event.badgeLevel &&
  !event.examName &&
  !event.specialAward &&
  !event.weaponName &&
  Boolean(event.eventName || event.eventCategory);

/** "flying", "gliding" or null for one record: its tag, else the guess. */
export const aviationOf = (event) => {
  if (!isActivity(event)) return null;
  if (AVIATION_KINDS.includes(event.aviation)) return event.aviation;
  if (event.aviation === AVIATION_NONE) return null;
  return guessAviation(event);
};

/**
 * The value to store on a new or retagged record, or undefined for "store
 * nothing". A choice that matches what the record would be guessed as anyway
 * is still written when it is a flight or glide -- so improving the guess
 * later can never take a confirmed sortie away -- but "none" on a record that
 * looks like nothing is left off, which keeps every ordinary record unchanged.
 */
export const aviationToStore = (choice, record) => {
  if (AVIATION_KINDS.includes(choice)) return choice;
  return guessAviation(record) ? AVIATION_NONE : undefined;
};

/**
 * Every cadet's flights and glides: { cadetName: { flying: [...], gliding: [...] } },
 * each entry { id, date }.
 */
export const aviationRecords = (events = []) => {
  const byCadet = {};
  events.forEach((event) => {
    const kind = aviationOf(event);
    if (!kind || !event.cadetName) return;
    const own = (byCadet[event.cadetName] = byCadet[event.cadetName] || { flying: [], gliding: [] });
    own[kind].push({ id: event.id, date: event.date || "" });
  });
  return byCadet;
};

const latest = (dates) => dates.filter(Boolean).reduce((max, date) => (date > max ? date : max), "");

/** Whether a stored override is one this code can use. */
const isOverride = (value) =>
  Boolean(value) && typeof value === "object" && Number.isInteger(value.count) && value.count >= 0;

/**
 * One cadet's total and last date for one kind.
 *
 * With no override it is just the log. With one, the override's figure is
 * taken as the truth AT THE MOMENT IT WAS SET, and every record the log
 * gains afterwards is added on top: set 10, log a flight, read 11.
 *
 * "Afterwards" is decided by record id, not by date or entry time. The
 * override remembers the ids of the records it already accounted for, in
 * `counted`, and anything else is new. Dates were the first idea and fail
 * twice: a flight from last March typed in today is new to the total but old
 * by date, and two records written in the same second -- which the frozen test
 * clock makes every record -- cannot be ordered at all. Ids have neither
 * problem, and they give the right answer to the awkward cases too: deleting
 * a mistaken record from BEFORE the override leaves the total alone, because
 * the hand-set figure never depended on it; deleting one from after takes one
 * off.
 *
 * The last date is the later of the override's date and anything new.
 */
export const summariseAviation = (records = [], override = null) => {
  const logged = records.length;
  const loggedLast = latest(records.map((record) => record.date));

  if (!isOverride(override)) {
    return { count: logged, last: loggedLast, manual: false, logged, loggedLast, added: 0 };
  }

  const counted = new Set(Array.isArray(override.counted) ? override.counted : []);
  const fresh = records.filter((record) => !counted.has(record.id));

  return {
    count: override.count + fresh.length,
    last: latest([override.lastDate || "", ...fresh.map((record) => record.date)]),
    manual: true,
    logged,
    loggedLast,
    added: fresh.length,
    setAt: override.setAt || "",
    setBy: override.setBy || "",
  };
};

/**
 * The override to store when someone sets a total by hand.
 *
 * `records` is the cadet's logged records of this kind right now; every one
 * of them is taken to be included in `count`, which is what the person
 * setting it was shown and is the only sensible reading of "they have had 10".
 */
export const buildOverride = ({ count, lastDate, records = [], setBy, now = new Date() }) => ({
  count,
  lastDate: lastDate || "",
  counted: records.map((record) => record.id).filter(Boolean),
  setAt: now.toISOString(),
  setBy: setBy || "Unknown",
});

/**
 * A user-showable problem with a hand-set total, or null.
 *
 * `count` arrives as the raw text of a number input.
 */
export const validateOverride = ({ count, lastDate, today, kind }) => {
  const { nouns } = AVIATION[kind];
  const text = String(count ?? "").trim();
  if (!/^\d+$/.test(text)) return `Enter the number of ${nouns} as a whole number, 0 or more.`;
  const value = Number(text);
  if (value > 9999) return `That is a lot of ${nouns}. Check the number and try again.`;
  if (lastDate && !/^\d{4}-\d{2}-\d{2}$/.test(lastDate)) return "Enter the date in full.";
  if (lastDate && today && lastDate > today) return "That date has not happened yet.";
  if (value === 0 && lastDate) return `A last date with no ${nouns} does not add up. Clear the date or raise the total.`;
  return null;
};
