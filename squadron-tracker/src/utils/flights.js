/**
 * Flights.
 *
 * A cadet's `flight` field is a 1-BASED INDEX into the squadron's flights
 * array -- not an id. That is the single most important fact about this file,
 * and it drives every decision here:
 *
 *   - The array only ever grows. Removing or reordering an entry would
 *     silently reassign every cadet after it.
 *   - Retiring a flight is `archived: true`, which hides it from pickers and
 *     charts while leaving its slot, its cadets and its points history intact.
 *
 * Two stored shapes exist and both must keep working:
 *
 *   legacy   ["Staff Team", "Atlas", "Tempest"]
 *   current  [{ name, competing, archived }, ...]
 *
 * Squadrons upgrade lazily -- the object form is written the first time an
 * admin saves. Everything reads through normaliseFlights(), so nothing else
 * needs to know which shape it is looking at.
 */

/**
 * Accepts either stored shape; always returns the object shape.
 *
 * Legacy arrays get `competing: index > 0`, which reproduces the old
 * hardcoded behaviour: the first flight is the staff/training flight and does
 * not compete, everything else does.
 */
export const normaliseFlights = (raw) =>
  (raw || []).map((flight, index) =>
    typeof flight === "string"
      ? { name: flight, competing: index > 0, archived: false }
      : { competing: index > 0, archived: false, ...flight, name: flight?.name ?? "" }
  );

/** `{ 1: "Staff Team", 2: "Alpha", ... }` -- keyed by the cadet's flight value. */
export const toFlightMap = (flights) =>
  normaliseFlights(flights).reduce((map, flight, index) => {
    map[index + 1] = flight.name;
    return map;
  }, {});

/**
 * Flights that appear in the points competition, each carrying its 1-based
 * index so callers can match cadets to it.
 */
export const getCompetingFlights = (flights) =>
  normaliseFlights(flights)
    .map((flight, index) => ({ ...flight, index: index + 1 }))
    .filter((flight) => flight.competing && !flight.archived);

/** Flights a cadet can be assigned to: everything not archived. */
export const getAssignableFlights = (flights) =>
  normaliseFlights(flights)
    .map((flight, index) => ({ ...flight, index: index + 1 }))
    .filter((flight) => !flight.archived);

/** How many cadets are currently in a given 1-based flight index. */
export const countCadetsInFlight = (cadets, flightIndex) =>
  (cadets || []).filter((cadet) => Number(cadet.flight) === Number(flightIndex)).length;

/**
 * Whether a proposed set of flights may be saved.
 *
 * @param options.cadets    current cadets, for the occupancy check
 * @param options.previous  the flights as currently stored
 * @returns null when valid, otherwise a message to show the user
 *
 * The occupancy rule only fires on a flight that is *becoming* archived.
 * A flight can legitimately already be archived while still holding cadets --
 * that is ordinary historical state, and treating it as invalid would make
 * such a squadron unsaveable, blocking every unrelated edit.
 */
export const validateFlights = (flights, { cadets = [], previous = null } = {}) => {
  const normalised = normaliseFlights(flights);
  const before = previous ? normaliseFlights(previous) : null;

  if (normalised.length === 0) return "A squadron needs at least one flight.";

  const blank = normalised.find((flight) => !flight.name.trim());
  if (blank) return "Every flight needs a name.";

  const names = normalised.map((flight) => flight.name.trim().toLowerCase());
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate) return "Two flights cannot share a name.";

  if (!normalised.some((flight) => flight.competing && !flight.archived)) {
    return "At least one flight must be competing, or Flight Points will be empty.";
  }

  // Archiving a flight that still holds cadets would hide them from the
  // picker while leaving them assigned to it. Only newly-archived flights are
  // checked; see the note above.
  const occupied = normalised
    .map((flight, index) => ({ ...flight, index: index + 1 }))
    .filter((flight) => {
      if (!flight.archived) return false;
      const wasArchived = before?.[flight.index - 1]?.archived ?? false;
      if (wasArchived) return false;
      return countCadetsInFlight(cadets, flight.index) > 0;
    });

  if (occupied.length) {
    const flight = occupied[0];
    const count = countCadetsInFlight(cadets, flight.index);
    return `${flight.name} still has ${count} cadet${count === 1 ? "" : "s"}. Move them to another flight before archiving it.`;
  }

  return null;
};

/** Append a flight. The array only grows, so this is the only way to add one. */
export const addFlight = (flights, { name, competing = true }) => [
  ...normaliseFlights(flights),
  { name: name.trim(), competing, archived: false },
];

/** Replace one flight in place, by 1-based index. */
export const updateFlight = (flights, flightIndex, changes) =>
  normaliseFlights(flights).map((flight, index) =>
    index + 1 === Number(flightIndex) ? { ...flight, ...changes } : flight
  );
