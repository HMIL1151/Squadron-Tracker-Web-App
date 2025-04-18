import React, { useEffect, useState } from "react";
import { getFirestore, collection, getDocs, doc, deleteDoc, setDoc, writeBatch } from "firebase/firestore";
import "./SystemAdminDashboard.css"; // Import styles for the dashboard
//import renameCollections from "../../../databaseTools/renameCollections";

const SystemAdminDashboard = () => {
  const [requests, setRequests] = useState([]);
  const db = getFirestore();

  // Fetch new account requests from Firestore
  useEffect(() => {
    const fetchRequests = async () => {
      const requestsCollection = collection(db, "NewAccountRequests");
      const snapshot = await getDocs(requestsCollection);
      const fetchedRequests = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRequests(fetchedRequests);
    };

    fetchRequests();
  }, [db]);

  // Approve a request
  const handleApprove = async (request) => {
    try {
      // Create a new squadron in the 'Squadron List' collection
      const squadronListDocRef = doc(collection(db, "SquadronList"));
      await setDoc(squadronListDocRef, {
        Name: request.squadronName,
        Number: request.squadronNumber,
        flights: [request.flight1Name, request.flight2Name, request.flight3Name],
      });

      // Create a new squadron database in the 'Squadron Databases' collection
      const squadronDatabaseDocRef = doc(db, "SquadronDatabases", String(request.squadronNumber)); // Ensure squadronNumber is a string
      await setDoc(squadronDatabaseDocRef, {});

      // Add the user as an admin in the 'Authorised Users' subcollection
      const authorisedUsersDocRef = doc(
        collection(squadronDatabaseDocRef, "AuthorisedUsers"),
        request.uid
      );
      await setDoc(authorisedUsersDocRef, {
        displayName: request.displayName,
        email: request.email,
        role: "admin",
      });

      // Copy the 'Flight Points' collection to the new squadron's database
      const topLevelFlightPointsRef = collection(db, "FlightPoints");
      const newFlightPointsRef = collection(squadronDatabaseDocRef, "FlightPoints");

      const topLevelFlightPointsSnapshot = await getDocs(topLevelFlightPointsRef);
      const batch = writeBatch(db); // Use a batch for efficient writes

      topLevelFlightPointsSnapshot.forEach((topLevelDoc) => {
        const newDocRef = doc(newFlightPointsRef, topLevelDoc.id);
        batch.set(newDocRef, topLevelDoc.data());
      });

      await batch.commit(); // Commit the batch write

      // Create the 'User Requests' subcollection in the new squadron's database
      const userRequestsDocRef = doc(collection(squadronDatabaseDocRef, "UserRequests"));
      await setDoc(userRequestsDocRef, {
        displayName: request.displayName,
        email: request.email,
        progress: "granted",
        timestamp: new Date().toISOString(),
      });

      // Add a new document to the 'Mass User List' collection
      const massUserListDocRef = doc(collection(db, "MassUserList"));
      await setDoc(massUserListDocRef, {
        UID: request.uid,
        Squadron: request.squadronNumber,
      });

      // Delete the request from the 'New Account Requests' collection
      const requestDocRef = doc(db, "NewAccountRequests", request.id);
      await deleteDoc(requestDocRef);

      // Update the UI
      setRequests((prevRequests) => prevRequests.filter((r) => r.id !== request.id));
    } catch (error) {
      console.error("Error approving request:", error);
      alert("Failed to approve the request. Please try again.");
    }
  };

  // Deny a request
  const handleDeny = async (requestId) => {
    try {
      // Delete the request from the 'New Account Requests' collection
      const requestDocRef = doc(db, "NewAccountRequests", requestId);
      await deleteDoc(requestDocRef);

      // Update the UI
      setRequests((prevRequests) => prevRequests.filter((r) => r.id !== requestId));
    } catch (error) {
      console.error("Error denying request:", error);
      alert("Failed to deny the request. Please try again.");
    }
  };

  // Rename collections
  // const handleRenameCollections = async () => {
  //   try {
  //     console.log("Starting the renaming process...");
  //     await renameCollections(); // Call the renameCollections function
  //     alert("Collections renamed successfully!");
  //   } catch (error) {
  //     console.error("Error renaming collections:", error);
  //     alert("Failed to rename collections. Please check the console for details.");
  //   }
  // };

  return (
    <div className="system-admin-dashboard">
      <h1>System Admin Dashboard</h1>
      <p>Welcome, System Admin! Here you can review and manage new account requests.</p>

      {/* Add the 'Rename Collections' button
      <div className="rename-collections-container">
        <button className="rename-collections-button" onClick={handleRenameCollections}>
          Rename Collections
        </button>
      </div> */}

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
    </div>
  );
};

export default SystemAdminDashboard;