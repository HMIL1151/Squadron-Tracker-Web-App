import React, { useContext, useState } from "react";
import Popup from "../Dashboard Components/Popup";
import SuccessMessage from "../Dashboard Components/SuccessMessage";
import Table from "../../Table/Table";
import { DataContext } from "../../../context/DataContext";
import { useSquadron } from "../../../context/SquadronContext";
import { ensureTeamPointsKey, updateFlights } from "../../../firebase/squadron";
import {
  addFlight,
  countCadetsInFlight,
  normaliseFlights,
  updateFlight,
  validateFlights,
} from "../../../utils/flights";
import "../Dashboard Components/dashboardStyles.css";
import "./FlightsDashboard.css";

/**
 * Add and edit a squadron's flights.
 *
 * There is deliberately no delete. A cadet's `flight` field is a 1-based index
 * into this array, so removing an entry would silently reassign every cadet
 * after it. Archiving retires a flight instead: it disappears from the Add
 * Cadet picker and from Flight Points, while its slot, its cadets and its
 * points history stay intact.
 */
const FlightsDashboard = () => {
  const { data } = useContext(DataContext);
  const { squadronNumber, squadronDocId, flights, setFlights } = useSquadron();

  const [editing, setEditing] = useState(null); // { index, name, competing, archived }
  const [adding, setAdding] = useState(null); // { name, competing }
  const [successMessage, setSuccessMessage] = useState("");
  // Every action on this screen happens inside a popup, so failures belong
  // inline next to the Confirm button rather than in a corner toast.
  const [popupError, setPopupError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const current = normaliseFlights(flights);
  const cadets = data.cadets || [];

  const rows = current.map((flight, index) => ({
    Flight: flight.name,
    Cadets: countCadetsInFlight(cadets, index + 1),
    Competing: flight.competing ? "Yes" : "No",
    Status: flight.archived ? "Archived" : "Active",
    index: index + 1,
  }));

  /**
   * Persist a proposed flights array.
   *
   * Validates first, writes to Firestore, then updates context -- so a failed
   * write cannot leave the UI showing flights the database does not have.
   */
  const save = async (next, { successText, newFlightIndex = null }) => {
    const problem = validateFlights(next, { cadets, previous: current });
    if (problem) {
      setPopupError(problem);
      return false;
    }

    if (!squadronDocId) {
      setPopupError("Cannot save: this squadron's directory entry was not found.");
      return false;
    }

    setIsSaving(true);
    try {
      await updateFlights(squadronDocId, next);

      // A new flight needs a TeamPoints key, or allocating points to it fails
      // on a missing field.
      if (newFlightIndex !== null) {
        await ensureTeamPointsKey(squadronNumber, newFlightIndex);
      }

      setFlights(next);
      setSuccessMessage(successText);
      setTimeout(() => setSuccessMessage(""), 2500);
      setPopupError("");
      return true;
    } catch (error) {
      console.error("Error saving flights:", error);
      setPopupError("Failed to save. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddConfirm = async () => {
    const next = addFlight(current, { name: adding.name, competing: adding.competing });
    const saved = await save(next, {
      successText: `${adding.name.trim()} added.`,
      newFlightIndex: next.length,
    });
    if (saved) setAdding(null);
  };

  const handleEditConfirm = async () => {
    const next = updateFlight(current, editing.index, {
      name: editing.name,
      competing: editing.competing,
      archived: editing.archived,
    });
    const saved = await save(next, { successText: `${editing.name.trim()} updated.` });
    if (saved) setEditing(null);
  };

  const openEdit = (row) => {
    const flight = current[row.index - 1];
    setPopupError("");
    setEditing({ index: row.index, ...flight });
  };

  const openAdd = () => {
    setPopupError("");
    setAdding({ name: "", competing: true });
  };

  if (!squadronNumber) {
    return <p>No squadron selected.</p>;
  }

  return (
    <div className="table-dashboard-container">
      <div className="button-container">
        <button className="button-green" onClick={openAdd}>
          Add Flight
        </button>
      </div>

      <Table
        columns={["Flight", "Cadets", "Competing", "Status"]}
        data={rows}
        onRowClick={openEdit}
        disableHover={false}
        width="70%"
      />

      <p className="flights-hint">
        Click a flight to edit it. Flights cannot be deleted, because each cadet
        records their flight by position &mdash; removing one would move
        everybody else. Archive a flight instead: it disappears from the Add
        Cadet list and from Flight Points, and its history is kept.
      </p>

      {/* Add */}
      {adding && (
        <Popup
          isOpen
          onClose={() => setAdding(null)}
          onConfirm={isSaving ? () => {} : handleAddConfirm}
        >
          <h2>Add Flight</h2>
          <div className="form-group">
            <label className="form-label" htmlFor="new-flight-name">
              Flight name:
            </label>
            <input
              id="new-flight-name"
              className="form-input"
              type="text"
              autoFocus
              value={adding.name}
              onChange={(e) => setAdding({ ...adding, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={adding.competing}
                onChange={(e) => setAdding({ ...adding, competing: e.target.checked })}
              />{" "}
              Competes for flight points
            </label>
          </div>
          {popupError && <p className="popup-error">{popupError}</p>}
        </Popup>
      )}

      {/* Edit */}
      {editing && (
        <Popup
          isOpen
          onClose={() => setEditing(null)}
          onConfirm={isSaving ? () => {} : handleEditConfirm}
        >
          <h2>Edit Flight</h2>
          <div className="form-group">
            <label className="form-label" htmlFor="edit-flight-name">
              Flight name:
            </label>
            <input
              id="edit-flight-name"
              className="form-input"
              type="text"
              autoFocus
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={editing.competing}
                onChange={(e) => setEditing({ ...editing, competing: e.target.checked })}
              />{" "}
              Competes for flight points
            </label>
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={editing.archived}
                onChange={(e) => setEditing({ ...editing, archived: e.target.checked })}
              />{" "}
              Archived (hidden from new cadets and from Flight Points)
            </label>
          </div>
          <p className="flights-cadet-count">
            {countCadetsInFlight(cadets, editing.index)} cadet
            {countCadetsInFlight(cadets, editing.index) === 1 ? "" : "s"} currently in this flight.
          </p>
          {popupError && <p className="popup-error">{popupError}</p>}
        </Popup>
      )}

      <SuccessMessage message={successMessage} />
    </div>
  );
};

export default FlightsDashboard;
