import React, { createContext, useContext, useState } from "react";

// Create the context
const SquadronContext = createContext();

// `initialSquadronNumber` exists so tests can mount a dashboard already scoped
// to a squadron. Production never passes it, so the starting state is unchanged.
export const SquadronProvider = ({ children, initialSquadronNumber = null }) => {
  const [squadronNumber, setSquadronNumber] = useState(initialSquadronNumber);

  return (
    <SquadronContext.Provider value={{ squadronNumber, setSquadronNumber }}>
      {children}
    </SquadronContext.Provider>
  );
};

// Custom hook to use the SquadronContext
export const useSquadron = () => {
  return useContext(SquadronContext);
};