/**
 * Squadron backup, as CSV.
 *
 * Turns a squadron's stored documents into spreadsheet files. Pure functions
 * only -- fetching lives in src/firebase/backup.js and the zipping in the
 * dashboard, so everything here can be tested without Firestore or a browser.
 *
 * Two rules shape the output:
 *
 *   1. Stored values go out verbatim. Dates are held as "YYYY-MM-DD" strings,
 *      and reparsing them with `new Date()` shifts the day west of UTC -- the
 *      divergence pointsDivergence.test.js exists to document. A backup that
 *      quietly moved a date by one day would be worse than no backup, so
 *      strings are copied across untouched.
 *
 *   2. Raw values first, readable ones alongside. A cadet's flight and rank are
 *      stored as numbers, and those numbers are what a restore needs; the names
 *      are added in extra columns for the human opening the file.
 */

import { rankMap } from "./mappings";
import { normaliseFlights } from "./flights";

/** Values needing quotes per RFC 4180: separator, quote, or a line break. */
const NEEDS_QUOTING = /[",\r\n]/;

/** One CSV cell. Null and undefined become empty, never the string "null". */
export const escapeCsv = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return NEEDS_QUOTING.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * A whole CSV file.
 *
 * CRLF line endings and a trailing newline, which is what RFC 4180 specifies
 * and what Excel expects; a lone \n makes older Excel builds read the file as
 * a single row.
 */
export const toCsv = (headers, rows) =>
  [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n") + "\r\n";

/** Firestore Timestamp, or a plain Date the app stored before Timestamps. */
const isTemporal = (value) =>
  typeof value?.toDate === "function" ||
  Object.prototype.toString.call(value) === "[object Date]";

/**
 * A timestamp as ISO 8601.
 *
 * Handles all three shapes the data actually holds: a Firestore Timestamp, a
 * plain Date (EventLog event-9999-17 has one), and an already-formatted string
 * -- which is passed straight through rather than reparsed, per rule 1 above.
 *
 * Date is detected by its internal tag rather than `instanceof`, because
 * setupTests.js replaces the global Date constructor and leaves two of them
 * alive; `instanceof` then depends on which one built the value.
 */
export const timestampToIso = (value) => {
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (Object.prototype.toString.call(value) === "[object Date]") return value.toISOString();
  if (typeof value === "string") return value;
  return "";
};

/** Doc id order, so re-running a backup on unchanged data gives byte-identical files. */
const byId = (docs) => [...(docs || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));

// -- Cadets -----------------------------------------------------------------

const CADET_HEADERS = [
  "Doc ID",
  "Forename",
  "Surname",
  "Start Date",
  "Flight Index",
  "Flight Name",
  "Rank",
  "Rank Name",
  "Added By",
  "Created At",
];

/**
 * @param cadets  [{ id, forename, surname, startDate, flight, rank, ... }]
 * @param flights the squadron's flights, either stored shape
 */
export const cadetsCsv = (cadets, flights) => {
  // Both flight shapes resolve through the same helper the dashboards use, so
  // a backup names flights exactly the way the app does.
  const named = normaliseFlights(flights);

  return toCsv(
    CADET_HEADERS,
    byId(cadets).map((cadet) => [
      cadet.id,
      cadet.forename,
      cadet.surname,
      cadet.startDate,
      cadet.flight,
      named[cadet.flight - 1]?.name ?? "",
      cadet.rank,
      rankMap[cadet.rank] ?? "",
      cadet.addedBy,
      timestampToIso(cadet.createdAt),
    ])
  );
};

// -- Event log ---------------------------------------------------------------

const EVENT_HEADERS = [
  "Doc ID",
  "Cadet Name",
  "Date",
  "Badge Category",
  "Badge Level",
  "Exam Name",
  "Event Name",
  "Event Category",
  "Special Award",
  "Added By",
  "Created At",
];

/** Every stored field. Unused ones are "" in the data and stay "" here. */
export const eventLogCsv = (events) =>
  toCsv(
    EVENT_HEADERS,
    byId(events).map((event) => [
      event.id,
      event.cadetName,
      event.date,
      event.badgeCategory,
      event.badgeLevel,
      event.examName,
      event.eventName,
      event.eventCategory,
      event.specialAward,
      event.addedBy,
      timestampToIso(event.createdAt),
    ])
  );

// -- Flight points -----------------------------------------------------------

/** One field value, flattened to something a cell can hold. */
const cellValue = (value) => {
  if (isTemporal(value)) return timestampToIso(value);
  // Defensive: no nested objects exist in FlightPoints today, but a future one
  // should land in the backup as legible JSON rather than "[object Object]".
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return value;
};

/**
 * The five FlightPoints documents, as one long-format table.
 *
 * Each document has a different shape -- two are price maps, two wrap a single
 * array, and TeamPoints mixes per-flight integers with a timestamp. A column
 * per field would need five separate files or a very sparse one, so this
 * flattens to Document/Field/Value instead. Array fields get a row per
 * element, in stored order.
 */
export const flightPointsCsv = (docs) => {
  const rows = [];

  byId(docs).forEach(({ id, ...fields }) => {
    Object.keys(fields)
      .sort()
      .forEach((field) => {
        const value = fields[field];
        if (Array.isArray(value)) {
          value.forEach((entry) => rows.push([id, field, cellValue(entry)]));
        } else {
          rows.push([id, field, cellValue(value)]);
        }
      });
  });

  return toCsv(["Document", "Field", "Value"], rows);
};

// -- Squadron info -----------------------------------------------------------

const SQUADRON_HEADERS = [
  "Squadron Name",
  "Squadron Number",
  "Flight Index",
  "Flight Name",
  "Competing",
  "Archived",
];

/**
 * The squadron's directory entry, one row per flight.
 *
 * Flight names live in SquadronList rather than in the squadron database, so
 * without this file a cadet's `flight: 2` is unreadable. Denormalising the
 * name and number onto every row keeps it usable as a standalone spreadsheet.
 *
 * A missing directory entry still produces a row: the number is known from the
 * caller, and a backup that fails outright over a missing name would be a
 * worse trade than one with a blank cell.
 */
export const squadronInfoCsv = (squadronDoc, squadronNumber) => {
  const name = squadronDoc?.Name ?? "";
  const number = squadronDoc?.Number ?? squadronNumber;
  const flights = normaliseFlights(squadronDoc?.flights);

  const rows = flights.length
    ? flights.map((flight, index) => [
        name,
        number,
        index + 1,
        flight.name,
        flight.competing,
        flight.archived,
      ])
    : [[name, number, "", "", "", ""]];

  return toCsv(SQUADRON_HEADERS, rows);
};

// -- The backup as a whole ---------------------------------------------------

/** Squadron number and date, so backups from different days sort and read clearly. */
export const backupFileName = (squadronNumber, now = new Date()) =>
  `Squadron_${squadronNumber}_Backup_${now.toISOString().slice(0, 10)}.zip`;

/**
 * Every file in the backup, keyed by the name it takes inside the zip.
 *
 * All four are always present. An empty collection produces a header-only
 * file, which says "this was empty" -- a missing file would instead look like
 * the backup failed partway.
 */
export const buildBackupFiles = ({ cadets, events, flightPoints, squadron }, squadronNumber) => ({
  "cadets.csv": cadetsCsv(cadets, squadron?.flights),
  "event-log.csv": eventLogCsv(events),
  "flight-points.csv": flightPointsCsv(flightPoints),
  "squadron-info.csv": squadronInfoCsv(squadron, squadronNumber),
});
