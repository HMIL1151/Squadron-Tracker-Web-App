import React, { useEffect, useState } from "react";
import { createSquadron, deleteAccountRequest, fetchAccountRequests } from "../../../firebase/accounts";
import styles from "./SystemAdminDashboard.module.css"; // Import styles for the dashboard
import ErrorMessage from "../DashboardComponents/ErrorMessage";

/** A request's flights, from either the array or the legacy flat fields. */
const requestedFlights = (request) => {
  if (Array.isArray(request.flights)) return request.flights;
  return [request.flight1Name, request.flight2Name, request.flight3Name].filter(
    (name) => name !== undefined && name !== null
  );
};

const SystemAdminDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch new account requests from Firestore
  useEffect(() => {
    const fetchRequests = async () => {
      setRequests(await fetchAccountRequests());
    };

    fetchRequests();
  }, []);

    // Approve a request
  const handleApprove = async (request) => {
    try {
      await createSquadron({
        squadronName: request.squadronName,
        squadronNumber: request.squadronNumber,
        flights: requestedFlights(request),
        uid: request.uid,
        displayName: request.displayName,
        email: request.email,
      });

      await deleteAccountRequest(request.id);

      // Update the UI
      setRequests((prevRequests) => prevRequests.filter((r) => r.id !== request.id));
    } catch (error) {
      console.error("Error approving request:", error);
      setErrorMessage("Failed to approve the request. Please try again.");
    }
  };

  // Deny a request
  const handleDeny = async (requestId) => {
    try {
      await deleteAccountRequest(requestId);

      // Update the UI
      setRequests((prevRequests) => prevRequests.filter((r) => r.id !== requestId));
    } catch (error) {
      console.error("Error denying request:", error);
      setErrorMessage("Failed to deny the request. Please try again.");
    }
  };

  return (
    <div className={styles["system-admin-dashboard"]}>
      <h1>System Admin Dashboard</h1>
      <p>Welcome, System Admin! Here you can review and manage new account requests.</p>

      {requests.length === 0 ? (
        <p>No new account requests to review.</p>
      ) : (
        <div className={styles["requests-container"]}>
          {requests.map((request) => (
            <div key={request.id} className={styles["request-card"]}>
              <p><strong>Squadron Name:</strong> {request.squadronName}</p>
              <p><strong>Squadron Number:</strong> {request.squadronNumber}</p>
              {/* Renders however many flights were requested. Older requests
                  carry three flat flight1Name..3Name fields instead of an
                  array, so both shapes are handled. */}
              {requestedFlights(request).map((name, index) => (
                <p key={index}>
                  <strong>{index === 0 ? "Staff flight" : `Flight ${index}`}:</strong> {name}
                </p>
              ))}
              <p><strong>Requested By:</strong> {request.displayName} ({request.email})</p>
              <div className={styles["request-actions"]}>
                <button className={styles["approve-button"]} onClick={() => handleApprove(request)}>Approve</button>
                <button className={styles["deny-button"]} onClick={() => handleDeny(request.id)}>Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ErrorMessage message={errorMessage} />
    </div>
  );
};

export default SystemAdminDashboard;