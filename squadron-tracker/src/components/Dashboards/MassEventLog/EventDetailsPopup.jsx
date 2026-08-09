import React, { useEffect } from "react";
import "./EventDetailsPopup.css";

const EventDetailsPopup = ({ isOpen, eventData, onClose, onRemove }) => {
  // Close the popup when the ESC key is pressed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  /*
   * Close only when the click landed on the backdrop itself, not on the dialog
   * inside it.
   *
   * This used to compare e.target.className to the string "popup-overlay".
   * That is fragile in two ways: adding a second class to the element breaks it,
   * and once these stylesheets are scoped the rendered name stops being the name
   * written here -- so click-to-close would fail silently, with nothing to
   * notice. Comparing the nodes asks the question directly.
   */
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="popup-overlay" onClick={handleOverlayClick}>
      <div className="popup-content">
        <button className="close-icon" onClick={onClose}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="currentColor"
          >
            <line
              x1="18"
              y1="6"
              x2="6"
              y2="18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="6"
              y1="6"
              x2="18"
              y2="18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <h2>Event Details</h2>
        <p><strong>Name:</strong> {eventData.Name}</p>
        <p><strong>Event:</strong> {eventData.Record}</p>
        {eventData.eventCategory && (
          <p><strong>Category:</strong> {eventData.eventCategory}</p>
        )}
        <p><strong>Date:</strong> {eventData.Date || "N/A"}</p>
        <p><strong>Points:</strong> {eventData.Points}</p>
        <p><strong>Added By:</strong> {eventData.AddedBy}</p>
        <p><strong>Created At:</strong> 
          {eventData.CreatedAt 
            ? (eventData.CreatedAt.seconds 
                ? new Date(eventData.CreatedAt.seconds * 1000).toLocaleString() // Firestore Timestamp
                : eventData.CreatedAt.toLocaleString() // JavaScript Date object
              ) 
            : "N/A"}
        </p>
        <button className="remove-button" onClick={() => onRemove(eventData.id)}>
          Remove Event
        </button>
      </div>
    </div>
  );
};

export default EventDetailsPopup;