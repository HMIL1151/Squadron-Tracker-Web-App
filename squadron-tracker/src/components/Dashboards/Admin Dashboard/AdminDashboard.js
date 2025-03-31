import React, { useEffect, useState } from "react";
import { getFirestore, collection, getDocs, doc, updateDoc, setDoc, deleteDoc } from "firebase/firestore/lite";
import "./AdminDashboard.css";
import "../Dashboard Components/dashboardStyles.css";

const AdminDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null); // Track the selected request for editing
  const [selectedRole, setSelectedRole] = useState("user"); // Track the selected role when granting access
  const [newStatus, setNewStatus] = useState(""); // Track the new status to be confirmed
  const [activeTab, setActiveTab] = useState("pending"); // Track the active tab (default: "pending")

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      setError(null);

      try {
        const db = getFirestore();
        const userRequestsCollection = collection(db, "UserRequests");
        const snapshot = await getDocs(userRequestsCollection);

        const requestsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setRequests(requestsData);
      } catch (err) {
        console.error("Error fetching user requests:", err);
        setError("Failed to load user requests.");
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

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

    try {
      const db = getFirestore();
      const requestDocRef = doc(db, "UserRequests", selectedRequest.id);

      // Update the progress in the UserRequests collection
      await updateDoc(requestDocRef, { progress: newStatus });

      // Handle AuthorizedUsers collection
      const authorizedUserDocRef = doc(db, "AuthorizedUsers", selectedRequest.id);

      if (newStatus === "granted") {
        // If the status is granted, create or update the document in AuthorizedUsers
        await setDoc(authorizedUserDocRef, {
          displayName: selectedRequest.displayName,
          email: selectedRequest.email,
          role: selectedRole, // Use the selected role
        });
      } else {
        // If the status is not granted, delete the document from AuthorizedUsers
        await deleteDoc(authorizedUserDocRef);
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
    <div className="admin-dashboard">
      <h2>Access Requests</h2>

      {/* Tabs for filtering requests */}
      <div className="tabs">
        <button
          className={activeTab === "pending" ? "active-tab" : ""}
          onClick={() => setActiveTab("pending")}
        >
          Pending
        </button>
        <button
          className={activeTab === "granted" ? "active-tab" : ""}
          onClick={() => setActiveTab("granted")}
        >
          Granted
        </button>
        <button
          className={activeTab === "denied" ? "active-tab" : ""}
          onClick={() => setActiveTab("denied")}
        >
          Denied
        </button>
      </div>

      {filteredRequests.length === 0 ? (
        <p>No {capitalize(activeTab)} requests found.</p>
      ) : (
        <div className="requests-cards">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className={`request-card ${request.progress.toLowerCase()}`}
              onClick={() => handleCardClick(request)}
            >
              <h3>{request.displayName}</h3>
              <div className="details">
                <p><strong>Email:</strong> {request.email}</p>
                <p><strong>Status:</strong> {capitalize(request.progress)}</p>
                <p><strong>Timestamp:</strong> {formatTimestamp(request.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for changing status */}
      {selectedRequest && (
        <div className="modal">
          <div className="modal-content">
            <h3>Change Status for {selectedRequest.displayName}</h3>
            <div className="modal-actions">
              <button
                className={newStatus === "granted" ? "active" : ""}
                onClick={() => handleStatusChange("granted")}
              >
                Granted
              </button>
              <button
                className={newStatus === "denied" ? "active" : ""}
                onClick={() => handleStatusChange("denied")}
              >
                Denied
              </button>
              <button
                className={newStatus === "pending" ? "active" : ""}
                onClick={() => handleStatusChange("pending")}
              >
                Pending
              </button>
            </div>

            {newStatus === "granted" && (
              <div className="role-selection">
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

            <div className="popup-bottom-buttons">
              <button className="popup-button-red" onClick={closeModal}>
                Cancel
              </button>
              <button className="popup-button-green" onClick={confirmStatusChange} disabled={!newStatus}>
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