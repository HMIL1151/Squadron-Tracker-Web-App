import React, { useState, useContext } from "react";
import { DOCS, setPrice } from "../../../firebase/flightPoints";
import "./addCategory.css";
import { useSquadron } from "../../../context/SquadronContext";
import { DataContext } from "../../../context/DataContext"; // Import DataContext

const AddCategory = ({ isOpen, onClose, onConfirm }) => {
  const [category, setCategory] = useState("");
  const [points, setPoints] = useState("");
  const [error, setError] = useState("");
  const { squadronNumber } = useSquadron(); // Access the squadron number from context
  const { setData } = useContext(DataContext); // Access setData from DataContext

  const handleConfirm = async () => {
    if (!category || !points) {
      setError("Please fill in both fields.");
      return;
    }
    setError("");

    try {
      await setPrice(squadronNumber, DOCS.categoryPoints, category, points);

      // Update the DataContext's flightPoints
      setData((prevData) => {
        const updatedFlightPoints = {
          ...prevData.flightPoints,
          "Event Category Points": {
            ...prevData.flightPoints["Event Category Points"],
            [category]: parseInt(points, 10),
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
      console.error("Error adding category:", err);
      setError("An error occurred while adding the category.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="add-category-overlay" onClick={onClose}>
      <div className="add-category-popup" onClick={(e) => e.stopPropagation()}>
        <h2>Add New Category</h2>
        <div className="form-group">
          <label htmlFor="category">Category Name:</label>
          <input
            type="text"
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Enter category name"
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
        {error && <p className="popup-error">{error}</p>}
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

export default AddCategory;