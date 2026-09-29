/**
 * Weapon handling tests: which weapons a squadron qualifies cadets on, how
 * long a pass lasts, and whether a cadet's pass has run out.
 *
 * A pass is an ordinary EventLog record carrying `weaponName`, written through
 * useSaveEvent like every other record. It was nearly a field on the cadet --
 * `weaponTests: { SA80: "2025-03-01" }` -- which is less code, but keeps only
 * the latest pass and gives staff no way to see or undo one they entered
 * wrong. As a record it shows in the event log, can be deleted from there, and
 * follows the cadet through a rename like every other record does.
 *
 * The list of weapons lives in FlightPoints/Weapons as { name: monthsValid },
 * beside the other things a squadron configures. Validity is DERIVED at render
 * time from the pass date and that number, never stored -- the same reason
 * classification is derived: change a weapon from 12 to 6 months and every
 * cell recolours, with nothing to migrate.
 *
 * Dates stay "YYYY-MM-DD" strings throughout and are compared as strings. A
 * round trip through `new Date("2025-01-01")` lands on the previous day
 * anywhere west of UTC; see the note at the top of points.js.
 */

export const WEAPONS_DOC = "Weapons";

/** The squadron's weapons, alphabetical: [{ name, months }]. */
export const getWeapons = (flightPoints) =>
  Object.entries(flightPoints?.[WEAPONS_DOC] || {})
    .map(([name, months]) => ({ name, months: parseInt(months, 10) || 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));

const pad = (value) => String(value).padStart(2, "0");

/**
 * The date a pass runs out: the pass date plus `months`, clamped to the end
 * of a shorter month, so 31 August plus six months is 28 (or 29) February
 * rather than rolling into March.
 *
 * The qualification is valid up to the day BEFORE this date; on it, the cell
 * goes red.
 */
export const weaponExpiry = (passDate, months) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(passDate || "");
  if (!match) return "";
  const [, y, m, d] = match.map(Number);
  const monthIndex = m - 1 + Number(months || 0);
  const year = y + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${pad(month + 1)}-${pad(Math.min(d, lastDay))}`;
};

/** Today, as the local "YYYY-MM-DD" a staff member would write it. */
export const todayIso = (now = new Date()) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

export const isExpired = (expiry, today = todayIso()) => Boolean(expiry) && today >= expiry;

/**
 * Each cadet's most recent pass per weapon: { cadetName: { weapon: date } }.
 *
 * Only the latest counts. A re-test is a new record rather than an edit, so a
 * cadet who has qualified every year for five years has five records, and the
 * oldest four say nothing about whether they are in date today.
 */
export const latestWeaponPasses = (events = []) => {
  const latest = {};
  events.forEach((event) => {
    if (!event?.weaponName || !event.cadetName || !event.date) return;
    const own = (latest[event.cadetName] = latest[event.cadetName] || {});
    if (!own[event.weaponName] || event.date > own[event.weaponName]) {
      own[event.weaponName] = event.date;
    }
  });
  return latest;
};
