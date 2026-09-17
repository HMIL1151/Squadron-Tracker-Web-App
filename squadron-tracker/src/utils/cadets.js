/**
 * Cadet-shaped views over the data already in DataContext.
 *
 * These are pure functions, not database calls. They lived in
 * firebase/firestoreUtils.js purely by accident of history -- nothing here
 * touches Firestore, and keeping them there meant components importing from
 * the data layer to do string formatting.
 */

import { rankMap } from "./mappings";
import { getEventDescription, getEventYear } from "./points";

/**
 * A cadet's achievements, formatted for a certificate.
 *
 * Events with none of the describing fields set are dropped rather than
 * printed as a blank line.
 */
export const getEventsForCadet = (cadetName, data) => {
  const events = data?.events || [];
  return events
    .filter((event) => event.cadetName === cadetName)
    .map((event) => ({ event: getEventDescription(event), date: event.date }))
    .filter(({ event }) => event !== "");
};

/** How a date reads on a certificate: "20 Feb 2025". */
export const formatCertificateDate = (dateString) =>
  new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/**
 * The lines offered for a certificate, oldest first.
 *
 * `year` selects an end-of-year certificate; omitting it gives the end-of-career
 * one, which is the same list taken over the cadet's whole record rather than a
 * single year. One certificate, two windows onto it -- the career version is
 * not a second kind of document.
 *
 * Both callers in CertificateDashboard go through here because they had already
 * drifted: the single preview and the bulk zip each had their own copy of this
 * filter/sort/format, and the zip's copy passed `true` where the other passed
 * `data`, so every certificate in the zip printed "Cadet Not Found" for a rank.
 *
 * Years compare as strings via getEventYear, and dates sort as strings, for the
 * reason recorded at the top of points.js: `new Date("2025-01-01")` is a
 * UTC-midnight instant whose *local* year is 2024 anywhere west of UTC.
 */
export const getCertificateLines = (cadetName, data, year) => {
  const wanted = year === undefined || year === null || year === "" ? null : String(year);

  return getEventsForCadet(cadetName, data)
    .filter((entry) => wanted === null || getEventYear(entry) === wanted)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((entry) => `${entry.event} (${formatCertificateDate(entry.date)})`);
};

/**
 * The period an end-of-career certificate covers, e.g. "2021 - 2025".
 *
 * Service, not logs: it runs from the cadet's start date to today, because a
 * cadet who earned nothing in their final year still served that year. The
 * earliest logged event stands in when a cadet has no start date -- the field
 * is required by the Add Cadet form now, but older records predate it.
 *
 * A plain hyphen, not an en dash: jsPDF's default Helvetica is WinAnsi-encoded
 * and silently mangles anything outside it.
 */
export const getCareerPeriod = (cadetName, data, today = new Date()) => {
  const cadet = (data?.cadets || []).find(
    (c) => `${c.forename} ${c.surname}` === cadetName
  );

  const eventYears = getEventsForCadet(cadetName, data)
    .map((entry) => getEventYear(entry))
    .filter(Boolean)
    .sort();

  const startYear = cadet?.startDate?.slice(0, 4) || eventYears[0];
  const endYear = String(today.getFullYear());

  if (!startYear || startYear >= endYear) return endYear;
  return `${startYear} - ${endYear}`;
};

/** A cadet's rank as a name rather than the stored integer. */
export const getCadetRank = (cadetName, data) => {
  const cadet = (data?.cadets || []).find(
    (c) => `${c.forename} ${c.surname}` === cadetName
  );
  if (!cadet) {
    console.warn(`Cadet ${cadetName} not found in DataContext.`);
    return "Cadet Not Found";
  }
  return rankMap[cadet.rank] || "Unknown Rank";
};
