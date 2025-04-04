import React, { createContext, useContext, useState } from "react";

// Create the context
const SquadronContext = createContext();

// Create a provider component
export const SquadronProvider = ({ children }) => {
  const [squadronNumber, setSquadronNumber] = useState(null);

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