//TODO: Hovering over point bolds table row and vice versa
//TODO: Clicking on point or row opens popup which lists the 'exams' on that cadet's record
//TODO: %On track and %Off track somewhere
//TODO: Handle overlapping points

import React, { useEffect, useState, useCallback } from "react";
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
import Table from "../../Table/Table"; // Import the Table component

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, PointElement, LinearScale);

const ClassificationDashboard = () => {
  const [cadetData, setCadetData] = useState([]);
  const [dividerPosition, setDividerPosition] = useState(55); // Initial width of the Graph section in percentage
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredCadet, setHoveredCadet] = useState(null); // Track the hovered cadet

  // Function to determine target classification based on service length
  const getTargetClassification = (serviceLengthInMonths) => {
    if (serviceLengthInMonths < 2) return 1;
    if (serviceLengthInMonths < 6) return 2;
    if (serviceLengthInMonths < 8) return 3;
    if (serviceLengthInMonths < 10) return 4;
    if (serviceLengthInMonths < 12) return 5;
    if (serviceLengthInMonths < 16) return 6;
    if (serviceLengthInMonths < 20) return 7;
    if (serviceLengthInMonths < 24) return 8;
    if (serviceLengthInMonths < 28) return 9;
    if (serviceLengthInMonths < 32) return 10;
    if (serviceLengthInMonths < 36) return 11;
    return 12;
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
        const targetClassificationLabel =
          classificationMap[targetClassification] || "Junior";

        return {
          cadetName: `${forename} ${surname}`,
          serviceLengthInMonths,
          classification,
          classificationLabel,
          targetClassification,
          targetClassificationLabel, // Add the string label for display
        };
      });

      setCadetData(formattedCadets);
    };

    fetchCadetsWithClassification();
  }, []);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      const newDividerPosition = (e.clientX / window.innerWidth) * 100;
      if (newDividerPosition > 30 && newDividerPosition < 70) {
        setDividerPosition(newDividerPosition);
      }
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div>
      <h1>Classification Dashboard</h1>
      {/* Split content into two halves */}
      <div style={{ display: "flex", alignItems: "center", height: "100vh" }}>
        {/* Graph Section */}
        <div style={{ width: `${dividerPosition}%`, height: "100%", overflow: "hidden" }}>
          <Graph cadetData={cadetData} onPointHover={setHoveredCadet} />
        </div>

        {/* Divider */}
        <div
          style={{
            width: "5px",
            cursor: "col-resize",
            backgroundColor: "#ccc",
            height: "100%",
          }}
          onMouseDown={handleMouseDown}
        ></div>

        {/* Table Section */}
        <div
          style={{
            width: `${100 - dividerPosition}%`,
            overflow: "hidden",
            display: "flex", // Use flexbox
            alignItems: "flex-start", // Align the table to the top
            height: "100%", // Ensure it takes the full height of the container
          }}
        >
          <Table
            columns={[
              "Name",
              "Service (Months)",
              "Classification",
              "Target Classification",
            ]}
            data={cadetData.map((cadet) => ({
              Name: cadet.cadetName,
              "Service (Months)": cadet.serviceLengthInMonths,
              Classification: cadet.classificationLabel,
              "Target Classification": cadet.targetClassificationLabel,
            }))}
            hoveredCadet={hoveredCadet} // Pass hovered cadet name
            onRowClick={(row) => {
              console.log("Row clicked:", row);
              // Add logic to handle row click, e.g., open a popup
            }}
            disableHover={true} // Pass the row click handler
            rowColors={cadetData.map((cadet) => ({
              row: cadet.cadetName,
              color:
                cadet.classification >= cadet.targetClassification
                  ? "#d4edda" // Green for on-track
                  : "#f8d7da", // Red for off-track
            }))}
          />
        </div>
      </div>
    </div>
  );
};

export default ClassificationDashboard;