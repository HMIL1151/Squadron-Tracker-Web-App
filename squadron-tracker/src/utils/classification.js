/**
 * Classification, derived rather than stored.
 *
 * A cadet's classification is a count of the exams they have passed, plus one.
 * Nothing writes it to Firestore, and nothing should: an exam record IS the
 * evidence, and a stored classification would be a second answer that could
 * disagree with the first.
 *
 * This logic lived inline inside ClassificationDashboard's effect. It is here
 * now because the Muster interface needs the same numbers -- for its own
 * classification board, for the "one exam from promotion" filter, and for the
 * statistics page -- and two components computing a cadet's classification
 * separately is exactly how they come to disagree.
 *
 * Moved verbatim, quirks included. Two are worth knowing about:
 *
 *   `examName !== ""` counts an event whose examName is UNDEFINED, because
 *   undefined !== "". Every event written by the app carries all its fields,
 *   so in practice only genuine exam records have a name at all -- but a
 *   hand-edited document without the field would inflate someone's
 *   classification. Preserved rather than fixed, because fixing it here would
 *   silently move numbers on a screen people read, and that deserves its own
 *   change with its own evidence.
 *
 *   Service length is whole months from the start date by calendar arithmetic,
 *   so a cadet who joined on the 31st reaches "one month" on the 1st. Close
 *   enough for a target that moves in four-month steps.
 */

import { classificationMap } from "./mappings";

/** The highest classification index the map names. */
const MAX_CLASSIFICATION = 12;

/**
 * Whole months served, by calendar arithmetic rather than elapsed days.
 *
 * Returns 0 rather than NaN for a cadet with no start date -- the field is
 * required by the Add Cadet form now, but older records predate it, and NaN
 * propagates into every comparison downstream as `false`.
 */
export const serviceLengthInMonths = (startDate, today = new Date()) => {
  if (!startDate) return 0;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 0;
  return (
    (today.getFullYear() - start.getFullYear()) * 12 +
    (today.getMonth() - start.getMonth())
  );
};

/**
 * Where a cadet of this service length is expected to have reached.
 *
 * The steps are the squadron's own expectation, not a national standard, which
 * is why they are a plain ladder rather than anything derived.
 */
export const getTargetClassification = (months) => {
  if (months < 2) return 1;
  if (months < 6) return 2;
  if (months < 8) return 3;
  if (months < 10) return 4;
  if (months < 12) return 5;
  if (months < 16) return 6;
  if (months < 20) return 7;
  if (months < 24) return 8;
  if (months < 28) return 9;
  if (months < 32) return 10;
  if (months < 36) return 11;
  return MAX_CLASSIFICATION;
};

/** Every exam this cadet has passed, as event records. */
export const examsPassedBy = (cadetName, events = []) =>
  events.filter((event) => event.cadetName === cadetName && event.examName !== "");

/**
 * One cadet's classification, target, and how they compare.
 *
 * @param today  injectable so the statistics page can ask "where were they in
 *               June?" without the answer depending on when it is run
 */
export const deriveClassification = (cadet, events = [], today = new Date()) => {
  const cadetName = `${cadet.forename} ${cadet.surname}`;
  const months = serviceLengthInMonths(cadet.startDate, today);

  const exams = examsPassedBy(cadetName, events);
  const classification = Math.min(exams.length + 1, MAX_CLASSIFICATION);

  const targetClassification = getTargetClassification(months);

  return {
    cadetName,
    cadet,
    serviceLengthInMonths: months,
    examsPassed: exams.length,
    classification,
    classificationLabel: classificationMap[classification] || classificationMap[1],
    targetClassification,
    targetClassificationLabel: classificationMap[targetClassification] || "Junior",
    // Two names for the same comparison because both readings are used: the
    // dashboard colours a row by whether the cadet is keeping up, and the
    // statistics page counts the ones who are not.
    isOnTarget: classification >= targetClassification,
    isBehind: classification < targetClassification,
  };
};

/** The same for every cadet, in the order given. */
export const deriveClassifications = (cadets = [], events = [], today = new Date()) =>
  cadets.map((cadet) => deriveClassification(cadet, events, today));

/**
 * The exam a cadet needs next, or null once the syllabus is complete.
 *
 * Takes the ordered exam list rather than importing it, so a squadron running
 * a different order does not need this file changed.
 */
export const nextExamFor = (cadetName, events = [], examList = []) => {
  const passed = new Set(examsPassedBy(cadetName, events).map((event) => event.examName));
  return examList.find((exam) => !passed.has(exam)) || null;
};
