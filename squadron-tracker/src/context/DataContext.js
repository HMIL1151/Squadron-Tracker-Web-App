import React, { createContext, useState } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore/lite";

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
    const db = getFirestore();
    try {
        const cadetsSnapshot = await getDocs(collection(db, "SquadronDatabases", squadronNumber, "Cadets"));
        const cadets = cadetsSnapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => a.forename.localeCompare(b.forename)); // Sort cadets by forename alphabetically
        const eventsSnapshot = await getDocs(collection(db, "SquadronDatabases", squadronNumber, "EventLog"));
        const events = eventsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        const flightPointsSnapshot = await getDocs(collection(db, "SquadronDatabases", squadronNumber, "FlightPoints"));
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