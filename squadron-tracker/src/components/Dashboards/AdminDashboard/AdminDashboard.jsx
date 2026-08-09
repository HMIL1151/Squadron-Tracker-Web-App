import React, { useEffect, useState } from "react";
import { fetchAccessRequests, grantAccess, revokeAccess, setRequestProgress } from "../../../firebase/users";
import { downloadSquadronBackup } from "./squadronBackup";
import styles from "./AdminDashboard.module.css";
import shared from "../DashboardComponents/dashboardStyles.module.css";
import { useSquadron } from "../../../context/SquadronContext";
import dialog from "../DashboardComponents/Modal.module.css";

/*
 * Request status -> scoped class.
 *
 * The status comes from Firestore, so `request-card ${progress}` cannot work
 * once the name is hashed. Listing the three here also means an unexpected
 * value renders no modifier rather than a class that matches nothing.
 */
const PROGRESS = {
  pending: styles["pending"],
  granted: styles["granted"],
  denied: styles["denied"],
};

const AdminDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null); // Track the selected request for editing
  const [selectedRole, setSelectedRole] = useState("user"); // Track the selected role when granting access
  const [newStatus, setNewStatus] = useState(""); // Track the new status to be confirmed
  const [activeTab, setActiveTab] = useState("pending"); // Track the active tab (default: "pending")
  const [isBackingUp, setIsBackingUp] = useState(false); // Track an in-flight backup
  const [backupError, setBackupError] = useState(null);
  const { squadronNumber } = useSquadron(); // Access the squadron number from context

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      setError(null);

      try {
        setRequests(await fetchAccessRequests(squadronNumber));
      } catch (err) {
        console.error("Error fetching user requests:", err);
        setError("Failed to load user requests.");
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [squadronNumber]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const capitalize = (str) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const handleCardClick = (request) => {
    setSelectedRequest(request); // Open the modal with the selected request
    setNewStatus(request.progress); // Pre-select the current status
  };

  const handleStatusChange = (status) => {
    setNewStatus(status); // Set the new status to be confirmed
  };

  const confirmStatusChange = async () => {
    if (!selectedRequest || !newStatus) return;

    if (!selectedRequest.uid) {
      console.error("Request has no uid; cannot change access:", selectedRequest.id);
      return;
    }

    try {
      await setRequestProgress(squadronNumber, selectedRequest.id, newStatus);

      // grantAccess/revokeAccess key both the membership document and the login
      // mapping by uid: the security rules check membership at
      // AuthorisedUsers/{uid}, and a re-grant overwrites rather than
      // duplicating. Revoking removes both, so no login mapping survives.
      if (newStatus === "granted") {
        await grantAccess(squadronNumber, {
          uid: selectedRequest.uid,
          displayName: selectedRequest.displayName,
          email: selectedRequest.email,
          role: selectedRole,
        });
      } else {
        await revokeAccess(squadronNumber, selectedRequest.uid);
      }

      // Update the local state
      setRequests((prevRequests) =>
        prevRequests.map((req) =>
          req.id === selectedRequest.id ? { ...req, progress: newStatus } : req
        )
      );

      setSelectedRequest(null); // Close the modal
      setSelectedRole("user"); // Reset the role
    } catch (err) {
      console.error("Error updating request status:", err);
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

  const closeModal = () => {
    setSelectedRequest(null); // Close the modal
    setSelectedRole("user"); // Reset the role to default
    setNewStatus(""); // Reset the new status
  };

  const filteredRequests = requests.filter((request) => request.progress === activeTab);

  if (loading) {
    return <p>Loading requests...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div className={styles["admin-dashboard"]}>
      <h2>Access Requests</h2>

      {/* Tabs for filtering requests */}
      <div className={styles["tabs"]}>
        <button
          className={activeTab === "pending" ? styles["active-tab"] : ""}
          onClick={() => setActiveTab("pending")}
        >
          Pending
        </button>
        <button
          className={activeTab === "granted" ? styles["active-tab"] : ""}
          onClick={() => setActiveTab("granted")}
        >
          Granted
        </button>
        <button
          className={activeTab === "denied" ? styles["active-tab"] : ""}
          onClick={() => setActiveTab("denied")}
        >
          Denied
        </button>
      </div>

      {filteredRequests.length === 0 ? (
        <p>No {capitalize(activeTab)} requests found.</p>
      ) : (
        <div className={styles["requests-cards"]}>
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className={[styles["request-card"], PROGRESS[request.progress?.toLowerCase()]]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleCardClick(request)}
            >
              <h3>{request.displayName}</h3>
              <div className={styles["details"]}>
                <p><strong>Email:</strong> {request.email}</p>
                <p><strong>Status:</strong> {capitalize(request.progress)}</p>
                <p><strong>Timestamp:</strong> {formatTimestamp(request.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/*
        Backup. A level-2 heading, not level 3: the request cards use h3, and
        the tests read every h3 as a card name.
      */}
      <h2>Backup</h2>
      <p>
        Download every cadet, event log entry and flight points setting as CSV files
        in a single .zip. Squadron records only &mdash; web app accounts and access
        requests are not included.
      </p>
      <div className={shared["button-container"]}>
        <button className={shared["button-green"]} onClick={handleBackup} disabled={isBackingUp}>
          {isBackingUp ? "Backing up..." : "Backup Squadron Data"}
        </button>
      </div>
      {backupError && <p className={styles["backup-error"]}>{backupError}</p>}

      {/* Modal for changing status */}
      {selectedRequest && (
        <div className={styles["modal"]}>
          <div className={styles["modal-content"]}>
            <h3>Change Status for {selectedRequest.displayName}</h3>
            <div className={styles["modal-actions"]}>
              <button
                className={newStatus === "granted" ? styles["active"] : ""}
                onClick={() => handleStatusChange("granted")}
              >
                Granted
              </button>
              <button
                className={newStatus === "denied" ? styles["active"] : ""}
                onClick={() => handleStatusChange("denied")}
              >
                Denied
              </button>
              <button
                className={newStatus === "pending" ? styles["active"] : ""}
                onClick={() => handleStatusChange("pending")}
              >
                Pending
              </button>
            </div>

            {newStatus === "granted" && (
              <div className={styles["role-selection"]}>
                <label>
                  <strong>Role:</strong>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
              </div>
            )}

            <div className={dialog["popup-bottom-buttons"]}>
              <button className={dialog["popup-button-red"]} onClick={closeModal}>
                Cancel
              </button>
              <button className={dialog["popup-button-green"]} onClick={confirmStatusChange} disabled={!newStatus}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;