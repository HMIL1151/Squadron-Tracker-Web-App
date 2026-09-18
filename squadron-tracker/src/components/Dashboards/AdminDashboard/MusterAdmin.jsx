import { useEffect, useMemo, useState } from "react";
import {
  fetchAccessRequests,
  grantAccess,
  revokeAccess,
  setRequestProgress,
} from "../../../firebase/users";
import { useSquadron } from "../../../context/SquadronContext";
import { downloadSquadronBackup } from "./squadronBackup";
import MusterPage from "../../Muster/MusterPage";
import MusterTable from "../../Muster/MusterTable";
import MusterDialog from "../../Muster/MusterDialog";
import MusterField from "../../Muster/MusterField";
import { MusterButton, MusterChip, MusterEmpty } from "../../Muster/MusterControls";
import styles from "./MusterAdmin.module.css";

/**
 * The admin area, Muster.
 *
 * Who can get into this squadron, and a backup of everything in it.
 *
 * The classic screen shows requests as cards in three tabs. Cards suit
 * something you browse; this is a list you work through, where every row has
 * the same four facts and the same decision attached. So it is a table, and
 * the pending ones are shown first because they are the only ones that need
 * anything doing.
 *
 * The status change still goes through the same two calls -- grantAccess and
 * revokeAccess -- which key BOTH the membership document and the login mapping
 * by uid. That matters: the security rules check membership at
 * AuthorisedUsers/{uid}, a re-grant overwrites rather than duplicating, and a
 * revoke removes both so no login mapping survives.
 */

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "granted", label: "Granted" },
  { key: "denied", label: "Denied" },
];

const STATUS_CLASS = {
  pending: styles["status-pending"],
  granted: styles["status-granted"],
  denied: styles["status-denied"],
};

/** "12 Mar 2026, 19:45" -- the date, and the time it was asked for. */
const formatRequested = (timestamp) => {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const MusterAdmin = () => {
  const { squadronNumber } = useSquadron();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");

  const [selected, setSelected] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [selectedRole, setSelectedRole] = useState("user");
  const [dialogError, setDialogError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupError, setBackupError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        setRequests(await fetchAccessRequests(squadronNumber));
      } catch (err) {
        console.error("Error fetching user requests:", err);
        setError("Failed to load access requests.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [squadronNumber]);

  const counts = useMemo(
    () =>
      TABS.reduce(
        (acc, tab) => ({
          ...acc,
          [tab.key]: requests.filter((request) => request.progress === tab.key).length,
        }),
        {}
      ),
    [requests]
  );

  const rows = useMemo(
    () =>
      requests
        .filter((request) => request.progress === activeTab)
        .map((request) => ({
          ...request,
          requestedLabel: formatRequested(request.timestamp),
        })),
    [requests, activeTab]
  );

  const openRequest = (request) => {
    setSelected(request);
    setNewStatus(request.progress);
    setSelectedRole("user");
    setDialogError(null);
  };

  const confirmStatusChange = async () => {
    if (!selected || !newStatus) return;

    if (!selected.uid) {
      setDialogError("This request has no account attached, so access cannot be changed.");
      return;
    }

    setBusy(true);
    try {
      await setRequestProgress(squadronNumber, selected.id, newStatus);

      if (newStatus === "granted") {
        await grantAccess(squadronNumber, {
          uid: selected.uid,
          displayName: selected.displayName,
          email: selected.email,
          role: selectedRole,
        });
      } else {
        await revokeAccess(squadronNumber, selected.uid);
      }

      setRequests((current) =>
        current.map((request) =>
          request.id === selected.id ? { ...request, progress: newStatus } : request
        )
      );
      setSelected(null);
    } catch (err) {
      console.error("Error updating request status:", err);
      setDialogError("That could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupError(null);
    try {
      await downloadSquadronBackup(squadronNumber);
    } catch (err) {
      console.error("Error backing up squadron data:", err);
      setBackupError("Backup failed. Please try again.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const columns = [
    {
      key: "person",
      header: "Person",
      sortValue: (row) => row.displayName || "",
      filterValue: (row) => (row.displayName || "") + " " + (row.email || ""),
      render: (row) => (
        <span className={styles.person}>
          <span className={styles.name}>{row.displayName || "Unknown"}</span>
          <span className={styles.email}>{row.email || "No email recorded"}</span>
        </span>
      ),
    },
    {
      key: "requested",
      header: "Requested",
      width: "210px",
      sortValue: (row) => row.timestamp || "",
      render: (row) => <span className={styles.requested}>{row.requestedLabel}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "130px",
      sortValue: (row) => row.progress,
      render: (row) => (
        <span className={STATUS_CLASS[row.progress] || STATUS_CLASS.pending}>
          {row.progress}
        </span>
      ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      width: "140px",
      render: (row) => (
        <MusterButton onClick={() => openRequest(row)}>
          {row.progress === "pending" ? "Review" : "Change"}
        </MusterButton>
      ),
    },
  ];

  return (
    <MusterPage
      title="Admin Area"
      description="Who can get into this squadron, and a copy of everything in it."
      actions={
        <MusterButton onClick={handleBackup} disabled={isBackingUp}>
          {isBackingUp ? "Preparing…" : "Download Squadron Backup"}
        </MusterButton>
      }
    >
      {backupError && (
        <p className={styles.error} role="alert">
          {backupError}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <section className={styles.backup}>
        <h2 className={styles["backup-title"]}>Squadron Backup</h2>
        <p className={styles["backup-note"]}>
          Four CSV files in a zip: cadets, the event log, flight points and squadron information.
          Worth taking before a change of staff, and the only copy that survives a cadet being
          discharged — discharging deletes their record outright.
        </p>
      </section>

      <MusterTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        defaultSort={{ key: "requested", direction: "desc" }}
        toolbar={
          <>
            {TABS.map((tab) => (
              <MusterChip
                key={tab.key}
                active={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                <span className={styles.count}>{counts[tab.key] ?? 0}</span>
              </MusterChip>
            ))}
          </>
        }
        empty={
          <MusterEmpty title={loading ? "Loading…" : "Nothing Here"}>
            {loading
              ? "Fetching access requests."
              : activeTab === "pending"
              ? "No one is waiting for access to this squadron."
              : "No requests with that status."}
          </MusterEmpty>
        }
      />

      <MusterDialog
        open={Boolean(selected)}
        title={selected ? selected.displayName || "Access Request" : "Access Request"}
        description={selected?.email}
        onClose={() => setSelected(null)}
        onConfirm={confirmStatusChange}
        confirmLabel={busy ? "Saving…" : "Save Decision"}
        confirmDisabled={busy || !newStatus || newStatus === selected?.progress}
        error={dialogError}
      >
        <MusterField label="Decision">
          {(id) => (
            <select id={id} value={newStatus} onChange={(event) => setNewStatus(event.target.value)}>
              <option value="pending">Leave pending</option>
              <option value="granted">Grant access</option>
              <option value="denied">Deny access</option>
            </select>
          )}
        </MusterField>

        {newStatus === "granted" && (
          <MusterField
            label="Role"
            hint="An admin can change flights, add and discharge cadets, and manage access."
          >
            {(id) => (
              <select
                id={id}
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
              >
                <option value="user">Squadron staff</option>
                <option value="admin">Squadron admin</option>
              </select>
            )}
          </MusterField>
        )}

        {newStatus === "denied" && selected?.progress === "granted" && (
          <p className={styles.warning}>
            This removes their access and their login mapping. They would have to request access
            again.
          </p>
        )}
      </MusterDialog>
    </MusterPage>
  );
};

export default MusterAdmin;
