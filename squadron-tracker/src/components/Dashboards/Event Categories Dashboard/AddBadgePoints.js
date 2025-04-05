import React, { useState, useContext } from "react";
import { getFirestore, doc, updateDoc } from "firebase/firestore/lite";
import "./addBadgePoints.css";
import { useSquadron } from "../../../context/SquadronContext";
import { DataContext } from "../../../context/DataContext"; // Import DataContext

const AddBadgePoints = ({ isOpen, onClose, onConfirm }) => {
  const [badgeType, setBadgeType] = useState("");
  const [points, setPoints] = useState("");
  const { squadronNumber } = useSquadron(); // Access the squadron number from context
  const { setData } = useContext(DataContext); // Access setData from DataContext

  const handleConfirm = async () => {
    if (!badgeType || !points) {
      alert("Please fill in both fields.");
      return;
    }

    try {
      const db = getFirestore();
      const docRef = doc(db, "Squadron Databases", squadronNumber.toString(), "Flight Points", "Badge Points");

      // Update Firestore with the new badge type and points
      await updateDoc(docRef, {
        [badgeType]: parseInt(points, 10),
      });
      console.log(`Badge points for "${badgeType}" added to Firestore.`);

      // Update the DataContext's flightPoints
      setData((prevData) => {
        const updatedFlightPoints = {
          ...prevData.flightPoints,
          "Badge Points": {
            ...prevData.flightPoints["Badge Points"],
            [badgeType]: parseInt(points, 10),
          },
        };
        console.log("Updated flightPoints in DataContext:", updatedFlightPoints);
        return {
          ...prevData,
          flightPoints: updatedFlightPoints,
        };
      });

      console.log(`Badge points for "${badgeType}" added to DataContext.`);

      onConfirm(); // Call the onConfirm callback to refresh data
      onClose(); // Close the popup
    } catch (error) {
      console.error("Error adding badge points:", error);
      alert("An error occurred while adding the badge points.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="add-badge-points-overlay" onClick={onClose}>
      <div className="add-badge-points-popup" onClick={(e) => e.stopPropagation()}>
        <h2>Add Badge Points</h2>
        <div className="form-group">
          <label htmlFor="badgeType">Badge Type:</label>
          <input
            type="text"
            id="badgeType"
            value={badgeType}
            onChange={(e) => setBadgeType(e.target.value)}
            placeholder="Enter badge type"
          />
        </div>
        <div className="form-group">
          <label htmlFor="points">Points:</label>
          <input
            type="number"
            id="points"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="Enter points"
          />
        </div>
        <div className="popup-bottom-buttons">
          <button className="popup-button-red" onClick={onClose}>
            Cancel
          </button>
          <button className="popup-button-green" onClick={handleConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddBadgePoints;