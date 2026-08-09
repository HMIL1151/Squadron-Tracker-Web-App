import React, { useState } from "react";
import Modal from "../DashboardComponents/Modal";
import "./DeletePopup.css";
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select an Item to Delete"
      onConfirm={handleConfirm}
      confirmLabel="Delete"
      confirmTone="danger"
      confirmDisabled={!selectedOption}
    >
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
    </Modal>
  );
};

export default DeletePopup;