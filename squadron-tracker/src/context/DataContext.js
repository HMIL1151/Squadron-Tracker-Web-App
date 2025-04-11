import React, { createContext, useState } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore/lite";

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [data, setData] = useState({
    cadets: [],
    events: [],
    flightPoints: {},
    // Add other collections as needed
  });

  const fetchData = async (squadronNumber) => {
    const db = getFirestore();
    try {
        const cadetsSnapshot = await getDocs(collection(db, "Squadron Databases", squadronNumber, "Cadets"));
        const cadets = cadetsSnapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => a.forename.localeCompare(b.forename)); // Sort cadets by forename alphabetically
        const eventsSnapshot = await getDocs(collection(db, "Squadron Databases", squadronNumber, "Event Log"));
        const events = eventsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        const flightPointsSnapshot = await getDocs(collection(db, "Squadron Databases", squadronNumber, "Flight Points"));
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