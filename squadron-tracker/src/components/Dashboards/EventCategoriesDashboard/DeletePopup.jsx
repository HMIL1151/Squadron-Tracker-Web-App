import React, { useState } from "react";
import "./DeletePopup.css"; // Optional: Add styles for the popup
import "./addEntry.css";

const DeletePopup = ({ isOpen, onClose, onConfirm, options, labelKey }) => {
  const [selectedOption, setSelectedOption] = useState("");

  const handleConfirm = () => {
    if (selectedOption) {
      onConfirm(selectedOption);
      setSelectedOption(""); // Reset selection
    }
  };

  if (!isOpen) {
    return null; // Do not render anything if the popup is not open
  }

  return (
    <div className="add-entry-overlay">
      <div className="add-entry-popup">
        <h2>Select an Item to Delete</h2>
        <select
          value={selectedOption}
          onChange={(e) => setSelectedOption(e.target.value)}
        >
          <option value="" disabled>
            Select an option
          </option>
          {options.map((option, index) => (
            <option key={index} value={option[labelKey]}>
              {option[labelKey]}
            </option>
          ))}
        </select>
        <div className="popup-buttons">

           <button className="button-red" onClick={onClose}>
            Cancel
          </button> 
          <button className="button-green" onClick={handleConfirm}>
            Confirm
          </button>
          
        </div>
      </div>
    </div>
  );
};

export default DeletePopup;