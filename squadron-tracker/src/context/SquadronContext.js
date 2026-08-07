import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

// Create the context
const SquadronContext = createContext();

/** A flight's display name, from either the legacy string or the object shape. */
const flightName = (flight) => (typeof flight === "string" ? flight : flight?.name ?? "");

/**
 * Holds which squadron is signed in and what its flights are.
 *
 * flights used to be a mutable module-level `let` in utils/mappings.js,
 * mutated through a setFlightMap() setter. Three problems, all fixed by
 * putting it in state:
 *
 *   - Mutating it told React nothing, so a renamed flight kept displaying its
 *     old name in anything already rendered.
 *   - It survived logout, leaking one squadron's flight names into the next.
 *   - It made flights impossible to edit reactively, which blocked the
 *     Add/Edit Flights feature entirely.
 *
 * `squadronDocId` is the SquadronList document's id. Those documents have
 * auto-generated ids but are looked up by their `Number` field, so the id has
 * to be carried around to write flight changes back.
 *
 * The initial* props exist so tests can mount an already-signed-in squadron.
 * Production passes none of them.
 */
export const SquadronProvider = ({
  children,
  initialSquadronNumber = null,
  initialSquadronDocId = null,
  initialFlights = [],
}) => {
  const [squadronNumber, setSquadronNumber] = useState(initialSquadronNumber);
  const [squadronDocId, setSquadronDocId] = useState(initialSquadronDocId);
  const [flights, setFlights] = useState(initialFlights);

  /** Set everything at once on login, or clear it all on logout. */
  const setSquadron = useCallback(({ squadronNumber: n = null, squadronDocId: id = null, flights: f = [] }) => {
    setSquadronNumber(n);
    setSquadronDocId(id);
    setFlights(f || []);
  }, []);

  // Derived from state, so it can never drift from `flights` and every change
  // re-renders consumers. Keys are the 1-based index stored on each cadet's
  // `flight` field.
  const flightMap = useMemo(
    () =>
      (flights || []).reduce((map, flight, index) => {
        map[index + 1] = flightName(flight);
        return map;
      }, {}),
    [flights]
  );

  const value = useMemo(
    () => ({
      squadronNumber,
      setSquadronNumber,
      squadronDocId,
      setSquadronDocId,
      flights: flights || [],
      setFlights,
      flightMap,
      setSquadron,
    }),
    [squadronNumber, squadronDocId, flights, flightMap, setSquadron]
  );

  return <SquadronContext.Provider value={value}>{children}</SquadronContext.Provider>;
};

// Custom hook to use the SquadronContext
export const useSquadron = () => {
  return useContext(SquadronContext);
};
