import { useState } from "react";
import MusterPage from "../../Muster/MusterPage";
import MusterTable from "../../Muster/MusterTable";
import MusterDialog from "../../Muster/MusterDialog";
import MusterField from "../../Muster/MusterField";
import { MusterButton, MusterEmpty } from "../../Muster/MusterControls";
import useRecordCategories, { KINDS } from "./useRecordCategories";
import styles from "./MusterRecordCategories.module.css";

/**
 * Record categories, Muster.
 *
 * All four lists on one screen instead of behind four tabs.
 *
 * Tabs made sense when each list was a full-width table of its own, but these
 * are four short lists that are read TOGETHER: what an event is worth only
 * means anything next to what a badge is worth. Tabs made you hold one in your
 * head while you went to look at another.
 *
 * Each list says what it is for, because the names do not: "Badge Points"
 * scores exams and special awards too, and "Badges" is the list of syllabus
 * subjects rather than a list of badges.
 */
const MusterRecordCategories = () => {
  const { lists, save, remove } = useRecordCategories();

  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [dialogError, setDialogError] = useState(null);
  const [busy, setBusy] = useState(false);

  const openAdd = (kindKey) => {
    setDialogError(null);
    setEditing({ kindKey, previousName: null, name: "", points: "" });
  };

  const openEdit = (kindKey, row) => {
    setDialogError(null);
    setEditing({
      kindKey,
      previousName: row.name,
      name: row.name,
      points: row.points ?? "",
    });
  };

  const confirmSave = async () => {
    setBusy(true);
    const problem = await save(editing.kindKey, editing);
    setBusy(false);
    if (problem) {
      setDialogError(problem);
      return;
    }
    setEditing(null);
  };

  const confirmDelete = async () => {
    setBusy(true);
    const problem = await remove(deleting.kindKey, deleting.name);
    setBusy(false);
    if (problem) {
      setDialogError(problem);
      return;
    }
    setDeleting(null);
  };

  const columnsFor = (kindKey) => {
    const kind = KINDS[kindKey];
    const columns = [
      {
        key: "name",
        header: kind.itemLabel,
        sortValue: (row) => row.name,
        filterValue: (row) => row.name,
        render: (row) => row.name,
      },
    ];

    if (kind.shape === "priced") {
      columns.push({
        key: "points",
        header: "Points",
        align: "right",
        width: "100px",
        sortValue: (row) => row.points,
        render: (row) => <strong>{row.points}</strong>,
      });
    }

    columns.push({
      key: "actions",
      header: "",
      align: "right",
      width: "150px",
      render: (row) => (
        <span className={styles.actions}>
          <MusterButton onClick={() => openEdit(kindKey, row)}>Edit</MusterButton>
          <MusterButton
            kind="danger"
            onClick={() => {
              setDialogError(null);
              setDeleting({ kindKey, name: row.name });
            }}
          >
            Delete
          </MusterButton>
        </span>
      ),
    });

    return columns;
  };

  const editingKind = editing ? KINDS[editing.kindKey] : null;

  const editTitle = editing?.previousName
    ? "Edit " + editing.previousName
    : "Add a " + (editingKind?.itemLabel ?? "Entry");

  return (
    <MusterPage
      title="Record Categories"
      description="The vocabulary this squadron scores against. Changing a value here changes what every past record is worth, because points are worked out when a screen is drawn rather than stored on the record."
    >
      <div className={styles.grid}>
        {Object.entries(KINDS).map(([kindKey, kind]) => (
          <section key={kindKey} className={styles.group}>
            <header className={styles.head}>
              <div>
                <h2 className={styles.title}>{kind.title}</h2>
                <p className={styles.note}>{kind.note}</p>
              </div>
              <MusterButton onClick={() => openAdd(kindKey)}>Add</MusterButton>
            </header>

            <MusterTable
              columns={columnsFor(kindKey)}
              rows={lists[kindKey] || []}
              getRowKey={(row) => row.id}
              defaultSort={{ key: "name", direction: "asc" }}
              empty={
                <MusterEmpty title="Nothing Here Yet">
                  {kind.note} Add the first one to start using it.
                </MusterEmpty>
              }
            />
          </section>
        ))}
      </div>

      <MusterDialog
        open={Boolean(editing)}
        title={editTitle}
        description={editingKind?.note}
        onClose={() => setEditing(null)}
        onConfirm={confirmSave}
        confirmLabel={busy ? "Saving…" : "Save"}
        confirmDisabled={busy}
        error={dialogError}
      >
        <MusterField
          label={editingKind?.itemLabel ?? "Name"}
          hint={
            editing?.previousName
              ? "Renaming does not rename it on records already logged — those keep the old name."
              : undefined
          }
        >
          {(id) => (
            <input
              id={id}
              type="text"
              value={editing?.name ?? ""}
              onChange={(event) => setEditing((state) => ({ ...state, name: event.target.value }))}
            />
          )}
        </MusterField>

        {editingKind?.shape === "priced" && (
          <MusterField label="Points">
            {(id) => (
              <input
                id={id}
                type="number"
                value={editing?.points ?? ""}
                onChange={(event) =>
                  setEditing((state) => ({ ...state, points: event.target.value }))
                }
              />
            )}
          </MusterField>
        )}
      </MusterDialog>

      <MusterDialog
        open={Boolean(deleting)}
        title={deleting ? "Delete " + deleting.name + "?" : "Delete"}
        description="Records already logged against it keep their name, but stop scoring."
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        confirmLabel={busy ? "Deleting…" : "Delete"}
        confirmDisabled={busy}
        error={dialogError}
      >
        <p className={styles.warning}>
          This cannot be undone from here. Adding it back with the same name restores the scoring.
        </p>
      </MusterDialog>
    </MusterPage>
  );
};

export default MusterRecordCategories;
