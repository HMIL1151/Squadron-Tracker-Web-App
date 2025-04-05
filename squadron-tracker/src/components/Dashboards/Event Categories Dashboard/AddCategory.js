import React, { useState, useContext } from "react";
import { getFirestore, doc, updateDoc } from "firebase/firestore/lite";
import "./addCategory.css";
import { useSquadron } from "../../../context/SquadronContext";
import { DataContext } from "../../../context/DataContext"; // Import DataContext

const AddCategory = ({ isOpen, onClose, onConfirm }) => {
  const [category, setCategory] = useState("");
  const [points, setPoints] = useState("");
  const { squadronNumber } = useSquadron(); // Access the squadron number from context
  const { setData } = useContext(DataContext); // Access setData from DataContext

  const handleConfirm = async () => {
    if (!category || !points) {
      alert("Please fill in both fields.");
      return;
    }

    try {
      const db = getFirestore();
      const docRef = doc(
        db,
        "Squadron Databases",
        squadronNumber.toString(),
        "Flight Points",
        "Event Category Points"
      );

      // Update Firestore with the new category and points
      await updateDoc(docRef, {
        [category]: parseInt(points, 10),
      });

      // Update the DataContext's flightPoints
      setData((prevData) => {
        const updatedFlightPoints = {
          ...prevData.flightPoints,
          "Event Category Points": {
            ...prevData.flightPoints["Event Category Points"],
            [category]: parseInt(points, 10),
          },
        };
        //console.log("Updated flightPoints in DataContext:", updatedFlightPoints);
        return {
          ...prevData,
          flightPoints: updatedFlightPoints,
        };
      });

      //console.log(`Category "${category}" with points "${points}" added to DataContext.`);

      onConfirm(); // Call the onConfirm callback to refresh data
      onClose(); // Close the popup
    } catch (error) {
      console.error("Error adding category:", error);
      alert("An error occurred while adding the category.");
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