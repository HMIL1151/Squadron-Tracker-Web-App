import React, { useState, useContext } from "react";
import { DOCS, setPrice } from "../../../firebase/flightPoints";
import styles from "./addBadgePoints.module.css";
import { useSquadron } from "../../../context/SquadronContext";
import { DataContext } from "../../../context/DataContext"; // Import DataContext
import Modal from "../DashboardComponents/Modal";
import shared from "../DashboardComponents/dashboardStyles.module.css";

const AddBadgePoints = ({ isOpen, onClose, onConfirm }) => {
  const [badgeType, setBadgeType] = useState("");
  const [points, setPoints] = useState("");
  const [error, setError] = useState("");
  const { squadronNumber } = useSquadron(); // Access the squadron number from context
  const { setData } = useContext(DataContext); // Access setData from DataContext

  const handleConfirm = async () => {
    if (!badgeType || !points) {
      setError("Please fill in both fields.");
      return;
    }
    setError("");

    try {
      await setPrice(squadronNumber, DOCS.badgePoints, badgeType, points);

      // Update the DataContext's flightPoints
      setData((prevData) => {
        const updatedFlightPoints = {
          ...prevData.flightPoints,
          "Badge Points": {
            ...prevData.flightPoints["Badge Points"],
            [badgeType]: parseInt(points, 10),
          },
        };
        return {
          ...prevData,
          flightPoints: updatedFlightPoints,
        };
      });


      onConfirm(); // Call the onConfirm callback to refresh data
      onClose(); // Close the popup
    } catch (err) {
      console.error("Error adding badge points:", err);
      setError("An error occurred while adding the badge points.");
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Badge Points"
      onConfirm={handleConfirm}
    >
        <div className={styles["form-group"]}>
          <label htmlFor="badgeType">Badge Type:</label>
          <input
            type="text"
            id="badgeType"
            value={badgeType}
            onChange={(e) => setBadgeType(e.target.value)}
            placeholder="Enter badge type"
          />
        </div>
        <div className={styles["form-group"]}>
          <label htmlFor="points">Points:</label>
          <input
            type="number"
            id="points"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="Enter points"
          />
        </div>
        {error && <p className={shared["popup-error"]}>{error}</p>}
    </Modal>
  );
};

export default AddBadgePoints;