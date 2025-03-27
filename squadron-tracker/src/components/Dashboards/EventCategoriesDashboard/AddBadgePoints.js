import React, { useState } from "react";
import { getFirestore, doc, updateDoc } from "firebase/firestore/lite";
import "./addBadgePoints.css";

const AddBadgePoints = ({ isOpen, onClose, onConfirm }) => {
  const [badgeType, setBadgeType] = useState("");
  const [points, setPoints] = useState("");

  const handleConfirm = async () => {
    if (!badgeType || !points) {
      alert("Please fill in both fields.");
      return;
    }

    try {
      const db = getFirestore();
      const docRef = doc(db, "Flight Points", "Badge Points");

      // Update Firestore with the new badge type and points
      await updateDoc(docRef, {
        [badgeType]: parseInt(points, 10),
      });

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