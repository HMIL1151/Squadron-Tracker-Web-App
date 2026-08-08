// mappings.js

export const rankMap = {
    1: "Cadet",
    2: "Corporal",
    3: "Sergeant",
    4: "Flight Sergeant",
    5: "Cadet Warrant Officer"
  };

// NOTE: flightMap used to live here as a mutable `let` with a setFlightMap()
// setter. Flight names vary per squadron and change at runtime, so they are
// state, not a constant -- they now live in SquadronContext, where updating
// them actually re-renders. The maps below are genuinely static.

export const classificationMap = {
    1: "Junior",
    2: "Second Class",
    3: "First Class",
    4: "First Class +1",
    5: "First Class +2",
    6: "Leading",
    7: "Leading +1",
    8: "Leading +2",
    9: "Senior",
    10: "Senior +1",
    11: "Senior +2",
    12: "Master",
    13: " "
    };