import React, { useState } from "react";
import { getFirestore, doc, updateDoc, arrayUnion } from "firebase/firestore/lite";
import "./addEntry.css";
import { useSquadron } from "../../../context/SquadronContext";

const AddEntry = ({ isOpen, onClose, onConfirm, collection, document, arrayName }) => {
  const [entry, setEntry] = useState("");
  const { squadronNumber } = useSquadron(); // Access the squadron number from context

  const handleConfirm = async () => {
    if (!entry) {
      alert("Please enter a value.");
      return;
    }

    try {
      const db = getFirestore();
      const docRef = doc(db, "Squadron Databases", squadronNumber.toString(), collection, document);

      await updateDoc(docRef, {
        [arrayName]: arrayUnion(entry),
      });

      onConfirm(); // Call the onConfirm callback
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