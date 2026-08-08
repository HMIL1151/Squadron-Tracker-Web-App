import React, { createContext, useState } from "react";
import { getDocs, squadronCollection } from "../firebase/db";

export const DataContext = createContext();

const EMPTY_DATA = {
  cadets: [],
  events: [],
  flightPoints: {},
  // Add other collections as needed
};

// `initialData` exists so tests can render a dashboard against a known dataset
// without going near Firestore. Production never passes it, so the starting
// state is unchanged.
export const DataProvider = ({ children, initialData }) => {
  const [data, setData] = useState(initialData || EMPTY_DATA);

  const fetchData = async (squadronNumber) => {
    try {
      const [cadetsSnapshot, eventsSnapshot, flightPointsSnapshot] = await Promise.all([
        getDocs(squadronCollection(squadronNumber, "Cadets")),
        getDocs(squadronCollection(squadronNumber, "EventLog")),
        getDocs(squadronCollection(squadronNumber, "FlightPoints")),
      ]);

      const cadets = cadetsSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => a.forename.localeCompare(b.forename)); // Sort cadets by forename alphabetically

      const events = eventsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const flightPoints = {};
      flightPointsSnapshot.docs.forEach((doc) => {
        flightPoints[doc.id] = doc.data();
      });

      setData({ cadets, events, flightPoints });
    } catch (error) {
      console.error("Error fetching bulk data:", error);
    }
  };

  return (
    <DataContext.Provider value={{ data, setData, fetchData }}>
      {children}
    </DataContext.Provider>
  );
};
