import { useContext, useState } from "react";
import { DataContext } from "../../../context/DataContext";
import { useSquadron } from "../../../context/SquadronContext";
import {
  addFlight,
  countCadetsInFlight,
  normaliseFlights,
  updateFlight,
  validateFlights,
} from "../../../utils/flights";
import { ensureTeamPointsKey, updateFlights } from "../../../firebase/squadron";
import MusterPage from "../../Muster/MusterPage";
import MusterTable from "../../Muster/MusterTable";
import MusterDialog from "../../Muster/MusterDialog";
import MusterField from "../../Muster/MusterField";
import { FlightMark, MusterButton, MusterTag } from "../../Muster/MusterControls";
import SuccessMessage from "../DashboardComponents/SuccessMessage";
import styles from "./MusterFlights.module.css";

/**
 * Flights, Muster.
 *
 * The same writes as the classic screen and the same validation -- everything
 * goes through utils/flights, which is where the rule that matters lives:
 *
 *   A cadet's `flight` is a 1-BASED INDEX into this array. The array only ever
 *   grows. Removing or reordering an entry silently moves every cadet after it
 *   into the wrong flight, which is why there is no delete on this screen and
 *   no drag to reorder -- a flight is retired by archiving it, which keeps its
 *   slot, its cadets and its points history intact.
 *
 * What changed is that the screen now SAYS that, instead of leaving an admin to
 * discover it by finding no delete button. The classic table has four columns
 * of Yes/No and Active/Archived; this one shows what each flight is for and
 * how many cadets it holds, and explains archiving where the question arises.
 */
const MusterFlights = () => {
  const { data } = useContext(DataContext);
  const { squadronNumber, squadronDocId, flights, setFlights } = useSquadron();

  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const current = normaliseFlights(flights);
  const cadets = data.cadets || [];

  const rows = current.map((flight, index) => ({
    id: index + 1,
    index: index + 1,
    name: flight.name,
    cadets: countCadetsInFlight(cadets, index + 1),
    competing: flight.competing,
    archived: flight.archived,
  }));

  /**
   * Persist a proposed flights array.
   *
   * Validates, writes, THEN updates context -- so a failed write cannot leave
   * the screen showing flights the database does not have.
   */
  const save = async (next, { successText, newFlightIndex = null }) => {
    const problem = validateFlights(next, { cadets, previous: current });
    if (problem) {
      setDialogError(problem);
      return false;
    }

    if (!squadronDocId) {
      setDialogError("Cannot save: this squadron's directory entry was not found.");
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
      setDialogError("");
      return true;
    } catch (error) {
      console.error("Error saving flights:", error);
      setDialogError("Failed to save. Please try again.");
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
    setDialogError("");
    setEditing({ index: row.index, ...current[row.index - 1] });
  };

  const openAdd = () => {
    setDialogError("");
    setAdding({ name: "", competing: true });
  };

  if (!squadronNumber) {
    return (
      <MusterPage title="Flights" description="No squadron selected.">
        <p>No squadron selected.</p>
      </MusterPage>
    );
  }

  const columns = [
    {
      key: "flight",
      header: "Flight",
      sortValue: (row) => row.name,
      filterValue: (row) => row.name,
      render: (row) => (
        <span className={styles.flight}>
          <FlightMark flight={row.index} />
          <span className={row.archived ? styles["name-archived"] : styles.name}>{row.name}</span>
        </span>
      ),
    },
    {
      key: "purpose",
      header: "Purpose",
      render: (row) =>
        row.competing ? (
          <MusterTag>Competes for points</MusterTag>
        ) : (
          <span className={styles.muted}>Does not compete</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      width: "150px",
      sortValue: (row) => (row.archived ? 1 : 0),
      render: (row) =>
        row.archived ? (
          <span className={styles.archived}>Archived</span>
        ) : (
          <span className={styles.active}>Active</span>
        ),
    },
    {
      key: "cadets",
      header: "Cadets",
      align: "right",
      width: "110px",
      sortValue: (row) => row.cadets,
      render: (row) => row.cadets,
    },
    {
      key: "edit",
      header: "",
      align: "right",
      width: "110px",
      render: (row) => (
        <MusterButton onClick={() => openEdit(row)}>Edit</MusterButton>
      ),
    },
  ];

  return (
    <MusterPage
      title="Flights"
      description="A cadet's flight is stored as a position in this list, so flights are never deleted or reordered — retire one by archiving it and every cadet stays where they were."
      actions={
        <MusterButton
          kind="primary"
          onClick={openAdd}
          icon={
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
              <path d="M8 3.4v9.2M3.4 8h9.2" />
            </svg>
          }
        >
          Add Flight
        </MusterButton>
      }
    >
      <MusterTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        footer="Archived flights keep their cadets and their points history. They disappear from pickers and from the competition, not from the record."
      />

      <MusterDialog
        open={Boolean(adding)}
        title="Add a Flight"
        description="It joins the end of the list and starts with no cadets."
        onClose={() => setAdding(null)}
        onConfirm={handleAddConfirm}
        confirmLabel={isSaving ? "Saving…" : "Add Flight"}
        confirmDisabled={isSaving || !adding?.name?.trim()}
        error={dialogError}
      >
        <MusterField label="Flight name">
          {(id) => (
            <input
              id={id}
              type="text"
              value={adding?.name ?? ""}
              onChange={(event) => setAdding((flight) => ({ ...flight, name: event.target.value }))}
            />
          )}
        </MusterField>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={adding?.competing ?? true}
            onChange={(event) =>
              setAdding((flight) => ({ ...flight, competing: event.target.checked }))
            }
          />
          <span>
            Competes for flight points
            <span className={styles["check-hint"]}>
              Turn this off for a staff or training flight, so points earned there stay out of the
              competition.
            </span>
          </span>
        </label>
      </MusterDialog>

      <MusterDialog
        open={Boolean(editing)}
        title={editing ? `Edit ${editing.name}` : "Edit Flight"}
        onClose={() => setEditing(null)}
        onConfirm={handleEditConfirm}
        confirmLabel={isSaving ? "Saving…" : "Save Changes"}
        confirmDisabled={isSaving || !editing?.name?.trim()}
        error={dialogError}
      >
        <MusterField label="Flight name">
          {(id) => (
            <input
              id={id}
              type="text"
              value={editing?.name ?? ""}
              onChange={(event) => setEditing((flight) => ({ ...flight, name: event.target.value }))}
            />
          )}
        </MusterField>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={editing?.competing ?? false}
            onChange={(event) =>
              setEditing((flight) => ({ ...flight, competing: event.target.checked }))
            }
          />
          <span>Competes for flight points</span>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={editing?.archived ?? false}
            onChange={(event) =>
              setEditing((flight) => ({ ...flight, archived: event.target.checked }))
            }
          />
          <span>
            Archived
            <span className={styles["check-hint"]}>
              Hides it from pickers and the competition. Its cadets and its points history stay as
              they are, which is why there is no delete.
            </span>
          </span>
        </label>
      </MusterDialog>

      <SuccessMessage message={successMessage} />
    </MusterPage>
  );
};

export default MusterFlights;
