import React from "react";
import "./Popup.css";

const Popup = ({ isOpen, onClose, onConfirm, children }) => {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={(e) => e.stopPropagation()}>
        <span className="popup-close" onClick={onClose}>
          &times;
        </span>
        {children}
        <div className="popup-actions">
          <button className="table-button-red" onClick={onClose}>
            Cancel
          </button>
          <button className="table-button" onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default Popup;