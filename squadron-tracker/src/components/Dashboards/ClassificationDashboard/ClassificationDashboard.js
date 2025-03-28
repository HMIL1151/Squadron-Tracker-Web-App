//TODO: Table styling to use Table.js - will need to edit data array to not include one of the classification elements
//TODO: Crosshair when you hover over point, if below red line, it goes up to the red line then when it intersects, goes left to axis
//TODO: Off/On track colouring in table
//TODO: Hovering over point bolds table row and vice versa
//TODO: Clicking on point or row opens popup which lists the 'exams' on that cadet's record
//TODO: %On track and %Off track somewhere
//TODO: Handle overlapping points

import React, { useEffect, useState } from "react";
import { fetchCollectionData } from "../../../firebase/firestoreUtils"; // Assuming this utility exists
import { getFirestore, collection, getDocs } from "firebase/firestore/lite"; // Firestore imports
import { classificationMap } from "../../../utils/mappings"; // Import classificationMap
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LinearScale,
} from "chart.js";
import Graph from "./Graph"; // Moved this import to the top

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, PointElement, LinearScale);

const ClassificationDashboard = () => {
  const [cadetData, setCadetData] = useState([]);

  // Function to determine target classification based on service length
  const getTargetClassification = (serviceLengthInMonths) => {
    if (serviceLengthInMonths < 2) return "Junior";
    if (serviceLengthInMonths < 6) return "Second Class";
    if (serviceLengthInMonths < 8) return "First Class";
    if (serviceLengthInMonths < 10) return "First Class +1";
    if (serviceLengthInMonths < 12) return "First Class +2";
    if (serviceLengthInMonths < 16) return "Leading";
    if (serviceLengthInMonths < 20) return "Leading +1";
    if (serviceLengthInMonths < 24) return "Leading +2";
    if (serviceLengthInMonths < 28) return "Senior";
    if (serviceLengthInMonths < 32) return "Senior +1";
    if (serviceLengthInMonths < 36) return "Senior +2";
    return "Master";
  };

  // Refresh data when the page is reloaded
  useEffect(() => {
    const fetchCadetsWithClassification = async () => {
      const db = getFirestore();

      // Fetch all cadets from Firestore
      const cadets = await fetchCollectionData("Cadets");

      // Fetch all event log documents from Firestore
      const eventLogRef = collection(db, "Event Log");
      const eventLogSnapshot = await getDocs(eventLogRef);
      const eventLogData = eventLogSnapshot.docs.map((doc) => doc.data());

      // Format cadets with classification calculation
      const formattedCadets = cadets.map((cadet) => {
        const { forename, surname, startDate } = cadet;

        // Calculate service length in months
        const startDateObj = new Date(startDate);
        const today = new Date();
        const serviceLengthInMonths =
          (today.getFullYear() - startDateObj.getFullYear()) * 12 +
          (today.getMonth() - startDateObj.getMonth());

        // Count the number of event log entries with a non-empty examName for this cadet
        const matchingEvents = eventLogData.filter(
          (event) =>
            event.cadetName === `${cadet.forename} ${cadet.surname}` &&
            event.examName !== ""
        );

        const classification = matchingEvents.length + 1; // Add 1 to ensure classification is never zero
        const classificationLabel =
          classificationMap[classification] || "Junior";

        const targetClassification = getTargetClassification(
          serviceLengthInMonths
        );

        return {
          cadetName: `${forename} ${surname}`,
          serviceLengthInMonths,
          classification,
          classificationLabel,
          targetClassification,
        };
      });

      setCadetData(formattedCadets);
    };

    fetchCadetsWithClassification();
  }, []);

  return (
    <div>
      <h1>Classification Dashboard</h1>
      {/* Split content into two halves */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {/* Graph */}
        <div style={{ width: "60%" }}>
          <Graph cadetData={cadetData} />
        </div>
        {/* Table */}
        <div style={{ width: "35%" }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Service Length (Months)</th>
                <th>Classification</th>
                <th>Target Classification</th>
              </tr>
            </thead>
            <tbody>
              {cadetData.map((cadet, index) => (
                <tr key={index}>
                  <td>{cadet.cadetName}</td>
                  <td>{cadet.serviceLengthInMonths}</td>
                  <td>{cadet.classificationLabel}</td>
                  <td>{cadet.targetClassification}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClassificationDashboard;