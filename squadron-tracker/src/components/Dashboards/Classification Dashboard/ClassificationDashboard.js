//TODO: Account for duplicate exams

import React, { useEffect, useState, useCallback, useRef, useContext } from "react";
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
import ExamPopup from "./ExamPopup"; // Import ExamPopup component
import "./ClassificationDashboard.css"; // Import CSS for styling
import { DataContext } from "../../../context/DataContext"; // Import DataContext


// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, PointElement, LinearScale);

const GraphContainer = ({ children }) => {
  const containerRef = useRef();

  useEffect(() => {
    const currentRef = containerRef.current; // Copy the ref value to a local variable
    const observer = new ResizeObserver(() => {
      // Trigger a re-render or notify the Graph of size changes
    });
    if (currentRef) {
      observer.observe(currentRef);
    }
    return () => {
      if (currentRef) {
        observer.unobserve(currentRef); // Use the local variable in cleanup
      }
    };
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }}>{children}</div>;
};



const ClassificationDashboard = ({user}) => {
  const [cadetData, setCadetData] = useState([]);
  const [longestServiceInMonths, setLongestServiceInMonths] = useState(50); // Default to 50
  const [dividerPosition, setDividerPosition] = useState(55); // Initial width of the Graph section in percentage
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredCadet, setHoveredCadet] = useState(null); // Track the hovered cadet
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedCadet, setSelectedCadet] = useState({ name: "", classification: "" });
  const { data } = useContext(DataContext); // Access data from DataContext


  const openPopup = (cadetName, classification) => {
    setSelectedCadet({ name: cadetName, classification });
    setIsPopupOpen(true);
  };

  const closePopup = () => {
    setIsPopupOpen(false);
  };

  const triggerScatterPointHover = (cadetNames) => {
    setHoveredCadet(cadetNames); // Update the hovered cadet state
  };

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
    const fetchCadetsWithClassification = () => {
      const cadets = data.cadets || [];
      const eventLogData = data.events || [];

      const formattedCadets = cadets.map((cadet) => {
        const { forename, surname, startDate } = cadet;

        const startDateObj = new Date(startDate);
        const today = new Date();
        const serviceLengthInMonths =
          (today.getFullYear() - startDateObj.getFullYear()) * 12 +
          (today.getMonth() - startDateObj.getMonth());

        const matchingEvents = eventLogData.filter(
          (event) =>
            event.cadetName === `${forename} ${surname}` &&
            event.examName !== ""
        );
        

        let classification = matchingEvents.length + 1;
        let classificationLabel;

        if (classification > 12) {
          classification = 12; // Cap classification at 13
          classificationLabel = classificationMap[12];

        }

        else{
          classificationLabel = classificationMap[classification] || classificationMap[1];
        }


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
          targetClassificationLabel,
        };
      });

      setCadetData(formattedCadets);

      // Calculate the longest service length in months
      const maxServiceLength = Math.max(
        ...formattedCadets.map((cadet) => cadet.serviceLengthInMonths)
      );

      const adjustedMaxServiceLength = maxServiceLength < 50 ? 50 : maxServiceLength + 1;

      setLongestServiceInMonths(adjustedMaxServiceLength); // Update the state
    };

    fetchCadetsWithClassification();
  }, [data]);


  useEffect(() => {
  }, [cadetData]);

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

  // Calculate the percentage of cadets on track
  const calculateOnTrackPercentage = () => {
    if (cadetData.length === 0) return 0; // Return 0 if there are no cadets
    const onTrackCount = cadetData.filter(
      (cadet) => cadet.classification >= cadet.targetClassification
    ).length;
    return (onTrackCount / cadetData.length) * 100; // Ensure this always returns a number
  };

  const onTrackPercentage = calculateOnTrackPercentage();

  return (
    <div style={{ height: "80vh", overflow: "hidden" }}>
      {/* Split content into two halves */}
      <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
        {/* Graph Section */}
        <div style={{ width: `${dividerPosition}%`, height: "100%", overflow: "visible" }}>
          <GraphContainer>
            <div style={{ display: "block", width: "100%", textAlign: "center" }}>
              <Graph
                key={dividerPosition} // Force re-render when dividerPosition changes
                cadetData={cadetData}
                longestServiceInMonths={longestServiceInMonths} // Pass the longest service length
                onPointHover={(cadetNames) => {
                  // Only update state if the hovered cadet names have changed
                  if (JSON.stringify(cadetNames) !== JSON.stringify(hoveredCadet)) {
                    setHoveredCadet(cadetNames);
                  }
                }}
                hoveredCadet={hoveredCadet}
                onPointClick={(cadetName) => {
                  const cadet = cadetData.find((c) => c.cadetName === cadetName);
                  if (cadet) openPopup(cadet.cadetName, cadet.classificationLabel);
                }}
              />
              {/* Percentage On Track Graphic */}
              <div style={{ marginTop: "15px", display: "flex", justifyContent: "center" }}>
                <div
                  style={{
                    backgroundColor: "#e9ecef", // Neutral light gray background
                    border: "1px solid #6c757d", // Subtle gray border
                    borderRadius: "8px", // Slightly rounded corners
                    padding: "10px 15px", // Padding inside the box
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)", // Subtle shadow for depth
                    textAlign: "center", // Center the text
                    width: "fit-content", // Adjust width to fit content
                  }}
                >
                  <h3 style={{ color: "#343a40", margin: 0, fontSize: "1.2rem" }}>
                    {onTrackPercentage.toFixed(1)}% On Track
                  </h3>
                </div>
              </div>
            </div>
          </GraphContainer>
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
            overflowY: "auto", // Enable vertical scrolling
            overflowX: "hidden", // Prevent horizontal scrolling
            display: "flex", // Use flexbox
            alignItems: "flex-start", // Align the table to the top
            height: "100%", // Ensure it takes the full height of the container
          }}
        >
          
          <div className="table-dashboard-container">
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
            hoveredCadet={hoveredCadet} // Pass the hoveredCadet state here
            onRowHover={(rowName) => {
              if (rowName) {
                triggerScatterPointHover([rowName]);
              } else {
                // Clear the hovered cadet names when the mouse leaves
                triggerScatterPointHover([]);
              }
            }}
            disableHover={false} // Ensure hover is enabled
            rowColors={cadetData.map((cadet) => ({
              row: cadet.cadetName,
              color:
                cadet.classification >= cadet.targetClassification
                  ? "#d4edda" // Green for on-track
                  : "#f8d7da", // Red for off-track
            }))}
            onRowClick={(rowName) => {
              const cadetName = rowName.Name; // Extract the Name property
              const cadet = cadetData.find((c) => c.cadetName === cadetName);
              if (cadet) openPopup(cadet.cadetName, cadet.classificationLabel);
            }}
          />
          </div>
        </div>
      </div>
      <ExamPopup
        isOpen={isPopupOpen}
        onClose={() => {
          closePopup();
        }}
        cadetName={selectedCadet.name}
        classification={selectedCadet.classification}
        user={user}
      />
    </div>
  );
};

export default ClassificationDashboard;