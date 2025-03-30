import React from "react";
import "./ExamPopup.css"; // Optional: Add styles for the popup

const ExamPopup = ({ isOpen, onClose, cadetName, classification }) => {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close" onClick={onClose}>
          &times;
        </button>
        <h2>Cadet Details</h2>
        <p><strong>Name:</strong> {cadetName}</p>
        <p><strong>Classification:</strong> {classification}</p>
        {/* Additional content can go here */}
      </div>
    </div>
  );
};

export default ExamPopup;