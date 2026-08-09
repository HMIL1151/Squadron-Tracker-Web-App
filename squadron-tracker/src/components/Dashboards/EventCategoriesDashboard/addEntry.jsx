import React, { useState, useContext } from "react";
import { addToList } from "../../../firebase/flightPoints";
import "./addEntry.css";
import { useSquadron } from "../../../context/SquadronContext";
import { DataContext } from "../../../context/DataContext"; // Import DataContext
import Modal from "../DashboardComponents/Modal";

const AddEntry = ({ isOpen, onClose, onConfirm, collection, document, arrayName }) => {
  const [entry, setEntry] = useState("");
  const [error, setError] = useState("");
  const { squadronNumber } = useSquadron(); // Access the squadron number from context
  const { setData } = useContext(DataContext); // Access setData from DataContext

  const handleConfirm = async () => {
    if (!entry) {
      setError("Please enter a value.");
      return;
    }
    setError("");

    try {
      await addToList(squadronNumber, document, arrayName, entry);

      // Update the DataContext's flightPoints
      setData((prevData) => {
        const updatedFlightPoints = {
          ...prevData.flightPoints,
          [document]: {
            ...prevData.flightPoints[document],
            [arrayName]: [...(prevData.flightPoints[document]?.[arrayName] || []), entry],
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
      console.error("Error adding entry:", err);
      setError("An error occurred while adding the entry.");
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Entry"
      onConfirm={handleConfirm}
    >
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
        {error && <p className="popup-error">{error}</p>}
    </Modal>
  );
};

export default AddEntry;