import React from "react";
import Modal from "../DashboardComponents/Modal";
import styles from "./EventDetailsPopup.module.css";

/*
 * The Escape listener and the backdrop click handler that used to live here are
 * gone: Modal provides both, and the backdrop one was the fragile
 * `e.target.className === "popup-overlay"` string comparison that would have
 * failed silently once these stylesheets are scoped.
 */
/*
 * `onAviationChange` is Muster only. When it is passed, an Event/Other record
 * shows whether the PTS board counts it as a flight or a glide and lets that
 * be changed -- the way to correct a record from before the tag existed,
 * which is counted by guessing from its name. Left off, this is the classic
 * popup, unchanged.
 */
const EventDetailsPopup = ({ isOpen, eventData, onClose, onRemove, onAviationChange }) => {
  /*
   * Still an early return, even though Modal takes isOpen.
   *
   * JSX children are built before Modal can decide not to show them, so
   * without this the closed state evaluates markup that reads props which
   * are only populated while open, and throws.
   */
  if (!isOpen || !eventData) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Event Details"
      size="sm"
      onConfirm={() => onRemove(eventData.id)}
      confirmLabel="Remove Event"
      confirmTone="danger"
      cancelLabel="Close"
    >
        <p><strong>Name:</strong> {eventData.Name}</p>
        <p><strong>Event:</strong> {eventData.Record}</p>
        {eventData.eventCategory && (
          <p><strong>Category:</strong> {eventData.eventCategory}</p>
        )}
        <p><strong>Date:</strong> {eventData.Date || "N/A"}</p>
        <p><strong>Points:</strong> {eventData.Points}</p>
        {onAviationChange && eventData.canFly && (
          <p>
            <label htmlFor="event-details-aviation">
              <strong>PTS board:</strong>
            </label>{" "}
            <select
              id="event-details-aviation"
              value={eventData.aviation || "none"}
              onChange={(e) => onAviationChange(eventData.id, e.target.value)}
            >
              <option value="none">Not a flight or glide</option>
              <option value="flying">Counts as a flight</option>
              <option value="gliding">Counts as a glide</option>
            </select>
          </p>
        )}
        <p><strong>Added By:</strong> {eventData.AddedBy}</p>
        <p><strong>Created At:</strong> 
          {eventData.CreatedAt 
            ? (eventData.CreatedAt.seconds 
                ? new Date(eventData.CreatedAt.seconds * 1000).toLocaleString() // Firestore Timestamp
                : eventData.CreatedAt.toLocaleString() // JavaScript Date object
              ) 
            : "N/A"}
        </p>
    </Modal>
  );
};

export default EventDetailsPopup;