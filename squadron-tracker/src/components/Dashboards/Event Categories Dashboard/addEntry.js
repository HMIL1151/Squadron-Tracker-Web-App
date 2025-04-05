import React, { useState, useContext } from "react";
import { getFirestore, doc, updateDoc, arrayUnion } from "firebase/firestore/lite";
import "./addEntry.css";
import { useSquadron } from "../../../context/SquadronContext";
import { DataContext } from "../../../context/DataContext"; // Import DataContext

const AddEntry = ({ isOpen, onClose, onConfirm, collection, document, arrayName }) => {
  const [entry, setEntry] = useState("");
  const { squadronNumber } = useSquadron(); // Access the squadron number from context
  const { setData } = useContext(DataContext); // Access setData from DataContext

  const handleConfirm = async () => {
    if (!entry) {
      alert("Please enter a value.");
      return;
    }

    try {
      const db = getFirestore();
      const docRef = doc(db, "Squadron Databases", squadronNumber.toString(), collection, document);

      // Add the new entry to Firestore
      await updateDoc(docRef, {
        [arrayName]: arrayUnion(entry),
      });
      console.log(`Entry "${entry}" added to Firestore in ${arrayName}.`);

      // Update the DataContext's flightPoints
      setData((prevData) => {
        const updatedFlightPoints = {
          ...prevData.flightPoints,
          [document]: {
            ...prevData.flightPoints[document],
            [arrayName]: [...(prevData.flightPoints[document]?.[arrayName] || []), entry],
          },
        };
        console.log("Updated flightPoints in DataContext:", updatedFlightPoints);
        return {
          ...prevData,
          flightPoints: updatedFlightPoints,
        };
      });

      console.log(`Entry "${entry}" added to DataContext in ${arrayName}.`);

      onConfirm(); // Call the onConfirm callback to refresh data
      onClose(); // Close the popup
    } catch (error) {
      console.error("Error adding entry:", error);
      alert("An error occurred while adding the entry.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="add-entry-overlay" onClick={onClose}>
      <div className="add-entry-popup" onClick={(e) => e.stopPropagation()}>
        <h2>Add Entry</h2>
        <div className="form-group">
          <label htmlFor="entry">New Entry:</label>
          <input
            type="text"
            id="entry"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            placeholder="Enter new entry"
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

export default AddEntry;