import React, { useEffect, useState } from "react";
import { createSquadron, deleteAccountRequest, fetchAccountRequests } from "../../../firebase/accounts";
import "./SystemAdminDashboard.css"; // Import styles for the dashboard
import ErrorMessage from "../Dashboard Components/ErrorMessage";

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
        flights: request.flights || [request.flight1Name, request.flight2Name, request.flight3Name],
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
    <div className="system-admin-dashboard">
      <h1>System Admin Dashboard</h1>
      <p>Welcome, System Admin! Here you can review and manage new account requests.</p>

      {requests.length === 0 ? (
        <p>No new account requests to review.</p>
      ) : (
        <div className="requests-container">
          {requests.map((request) => (
            <div key={request.id} className="request-card">
              <p><strong>Squadron Name:</strong> {request.squadronName}</p>
              <p><strong>Squadron Number:</strong> {request.squadronNumber}</p>
              <p><strong>Flight 1:</strong> {request.flight1Name}</p>
              <p><strong>Flight 2:</strong> {request.flight2Name}</p>
              <p><strong>Flight 3:</strong> {request.flight3Name}</p>
              <p><strong>Requested By:</strong> {request.displayName} ({request.email})</p>
              <div className="request-actions">
                <button className="approve-button" onClick={() => handleApprove(request)}>Approve</button>
                <button className="deny-button" onClick={() => handleDeny(request.id)}>Deny</button>
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