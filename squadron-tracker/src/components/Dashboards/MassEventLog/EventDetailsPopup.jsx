import React from "react";
import Modal from "../DashboardComponents/Modal";
import "./EventDetailsPopup.css";

/*
 * The Escape listener and the backdrop click handler that used to live here are
 * gone: Modal provides both, and the backdrop one was the fragile
 * `e.target.className === "popup-overlay"` string comparison that would have
 * failed silently once these stylesheets are scoped.
 */
const EventDetailsPopup = ({ isOpen, eventData, onClose, onRemove }) => {
  /*
   * Still an early return, even though Modal takes isOpen.
   *
   * JSX children are built before Modal can decide not to show them, so
   * without this the closed state evaluates markup that reads props which
   * are only populated while open, and throws.
   */
  if (!isOpen || !eventData) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} label="Event details" size="sm">
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
    </Modal>
  );
};

export default EventDetailsPopup;