//TODO: Squadrons declare flight bnames

import React, { useState, useContext } from "react";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth"; // Import Firebase Auth
import { getFirestore, collection, doc, setDoc, getDocs, writeBatch, query, where, getDoc } from "firebase/firestore"; // Import Firestore functions
import { checkUserRole, doesSquadronAccountExist } from "../../firebase/firestoreUtils"; // Import Firestore utility functions
import { DataContext } from "../../context/DataContext"; // Import DataContext
import { setFlightMap } from "../../utils/mappings"; // Import the setter function
import "./WelcomePage.css"; // Optional: Add styles for the welcome page
import "../Dashboards/Dashboard Components/dashboardStyles.css"; // Import styles for buttons and popups

const WelcomePage = ({ onUserChange }) => {
  const [user, setUser] = useState(null); // Track the logged-in user
  const [error, setError] = useState(null);
  const [role, setRole] = useState(null); // Track the user's role
  const [squadronNumber, setSquadronNumber] = useState(""); // Track the entered Squadron number
  const [squadronName, setSquadronName] = useState(""); // Track the entered Squadron name
  const [isAdmin, setIsAdmin] = useState(false); // Track if the user will be the admin
  const [showSetupPopup, setShowSetupPopup] = useState(false); // Track if the setup popup is shown
  const [showBlankPopup, setShowBlankPopup] = useState(false); // Track if the blank popup is shown
  const [showAdminWarning, setShowAdminWarning] = useState(false); // Track if the admin warning is shown
  const [flightNames, setFlightNames] = useState(["", "", ""]); // Track the entered flight names

  const db = getFirestore(); // Initialize Firestore
  const { fetchData } = useContext(DataContext); // Access fetchData from DataContext

  const handleGoogleLogin = async () => {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const { uid, email, displayName } = user;
      const userRole = await checkUserRole(uid);

      if (!isNaN(userRole)) {
        const squadronNumber = userRole.toString();

        // Fetch squadron name and flight names
        const squadronName = await fetchSquadronName(squadronNumber);
        //console.log("Fetched squadron name:", squadronName);
        const flightNames = await fetchFlightNames(squadronNumber);
        //console.log("Fetched flight names:", flightNames);
        const squadronDocRef = doc(db, "Squadron List", squadronNumber);
        const squadronDoc = await getDoc(squadronDocRef);
        //console.log("Squadron document fetched:", squadronDoc.exists());

        if (squadronDoc.exists()) {
          const flightNames = squadronDoc.data().flights || [];

          // Dynamically update flightMap
          const newFlightMap = flightNames.reduce((map, flightName, index) => {
            map[index + 1] = flightName; // Map flight names to indices starting from 1
            return map;
          }, {});
          setFlightMap(newFlightMap); // Update the flightMap in mappings.js

          // Test: Print the flight names to the console
          //console.log("Flight names retrieved and set in flightMap:", newFlightMap);
        }
        else{
          console.error(`Squadron with number ${squadronNumber} not found in Squadron List.`);

        }

        await fetchData(squadronNumber);

        navigateToMainContent({
          displayName,
          uid,
          squadronName,
          squadronNumber: parseInt(squadronNumber, 10),
          flightNames,
        });
        return;
      }

      setUser({ uid, email, displayName });
      setRole(userRole);
    } catch (err) {
      console.error("Error during Google login:", err);
      setError("Failed to log in. Please try again.");
    }
  };

  const handleLogout = async () => {
    const auth = getAuth(); // Initialize Firebase Auth

    try {
      await signOut(auth); // Sign out the user
      setUser(null); // Clear the user state
      setRole(null); // Clear the role state
      setSquadronNumber(""); // Clear the Squadron number
    } catch (err) {
      console.error("Error during logout:", err);
      setError("Failed to log out. Please try again.");
    }
  };

  const handleSquadronSubmit = async () => {
    try {
      // Check if the squadron account exists
      const collectionExists = await doesSquadronAccountExist(squadronNumber);

      if (role === "First Login" && collectionExists) {
        // Fetch the squadron name from the Squadron List collection
        const squadronName = await fetchSquadronName(squadronNumber);

        if (!squadronName) {
          setError("Failed to fetch squadron name. Please try again.");
          return;
        }

        // Add a new document to the 'User Requests' subcollection
        const squadronDatabaseDocRef = doc(db, "Squadron Databases", squadronNumber);
        const userRequestsDocRef = doc(collection(squadronDatabaseDocRef, "User Requests"));
        await setDoc(userRequestsDocRef, {
          displayName: user.displayName,
          email: user.email,
          progress: "pending",
          timestamp: new Date().toISOString(), // Current timestamp in ISO format
        });

        // Add a new document to the top-level 'Mass User List' collection
        const massUserListDocRef = doc(collection(db, "Mass User List"));
        await setDoc(massUserListDocRef, {
          UID: user.uid,
          Squadron: parseInt(squadronNumber, 10),
        });

        // Notify the user
        setError("Your request to join the squadron is pending approval, please contact your Squadron's Admin.");
      } else if (role === "System Admin" && collectionExists) {
        // Fetch the squadron name from the Squadron List collection
        const squadronName = await fetchSquadronName(squadronNumber);
        const flightNames = await fetchFlightNames(squadronNumber); // Fetch flight names
        

        if (!squadronName) {
          setError("Failed to fetch squadron name. Please try again.");
          return;
        }

        //console.log("Fetching bulk data for squadron:", squadronNumber);
        await fetchData(squadronNumber); // Trigger bulk data fetch for the squadron

        // Navigate to main content and pass user and squadron data
        navigateToMainContent({
          displayName: user.displayName,
          uid: user.uid,
          squadronName,
          squadronNumber: parseInt(squadronNumber, 10),
          flightNames,
        });
      } else if (!collectionExists) {
        setShowSetupPopup(true); // Show the setup popup if the collection does not exist
      }
    } catch (err) {
      console.error("Error checking Squadron collection existence or adding user request:", err);
      setError("Failed to verify Squadron number or submit your request. Please try again.");
    }
  };

  const handleSetupCancel = () => {
    setShowSetupPopup(false); // Close the setup popup
    setShowBlankPopup(false); // Close the blank popup
    setShowAdminWarning(false); // Clear the admin warning
  };

  const handleSetupConfirm = async () => {
    if (!isAdmin) {
      setShowAdminWarning(true); // Show the warning if the checkbox is not ticked
    } else {
      setShowAdminWarning(false); // Clear the warning

      try {
        // Ensure the first flight name is set to 'Training Flight' if left blank
        const updatedFlightNames = [...flightNames];
        if (!updatedFlightNames[0].trim()) {
          updatedFlightNames[0] = "Training Flight";
        }

        // Add a new document to the 'Squadron List' collection
        const squadronListDocRef = doc(collection(db, "Squadron List"));
        await setDoc(squadronListDocRef, {
          Name: squadronName,
          Number: parseInt(squadronNumber, 10),
          flights: updatedFlightNames, // Save the flight names as a string array
        });

        // Add a new document to the 'Squadron Databases' collection
        const squadronDatabaseDocRef = doc(db, "Squadron Databases", squadronNumber);
        await setDoc(squadronDatabaseDocRef, {}); // Create the document

        // Add a new subcollection 'Authorised Users' with the user's details
        const authorisedUsersDocRef = doc(
          collection(squadronDatabaseDocRef, "Authorised Users"),
          user.uid
        );
        await setDoc(authorisedUsersDocRef, {
          displayName: user.displayName,
          email: user.email,
          role: "admin",
        });

        // Reproduce the 'Flight Points' collection in the new Squadron Database
        const topLevelFlightPointsRef = collection(db, "Flight Points");
        const newFlightPointsRef = collection(squadronDatabaseDocRef, "Flight Points");

        const topLevelFlightPointsSnapshot = await getDocs(topLevelFlightPointsRef);
        const batch = writeBatch(db); // Use a batch for efficient writes

        topLevelFlightPointsSnapshot.forEach((topLevelDoc) => {
          const newDocRef = doc(newFlightPointsRef, topLevelDoc.id); // Correct usage of doc
          batch.set(newDocRef, topLevelDoc.data()); // Copy the document data
        });

        await batch.commit(); // Commit the batch write

        // Add a new document to the 'User Requests' collection
        const userRequestsDocRef = doc(collection(squadronDatabaseDocRef, "User Requests"));
        await setDoc(userRequestsDocRef, {
          displayName: user.displayName,
          email: user.email,
          progress: "granted",
          timestamp: new Date().toISOString(), // Current timestamp in ISO format
        });

        // Add a new document to the top-level 'Mass User List' collection
        const massUserListDocRef = doc(collection(db, "Mass User List"));
        await setDoc(massUserListDocRef, {
          UID: user.uid,
          Squadron: parseInt(squadronNumber, 10),
        });

        // Close all popups
        setShowSetupPopup(false);
        setShowBlankPopup(false);

        // Log the user out and return to the login screen
        await handleLogout();
      } catch (err) {
        console.error("Error during squadron setup:", err);
        setError("Failed to set up the squadron. Please try again.");
      }
    }
  };

  const navigateToMainContent = async ({ displayName, uid, squadronName, squadronNumber, flightNames }) => {
    let userRole = role; // Default to the role from checkUserRole
  
    if (role !== "System Admin") {
      try {
        // Navigate to Authorized Users subcollection
        const authorizedUsersCollectionRef = collection(
          db,
          "Squadron Databases",
          squadronNumber.toString(),
          "Authorised Users"
        );
  
        // Query for the document where displayName matches the user's displayName
        const userQuery = query(authorizedUsersCollectionRef, where("displayName", "==", displayName));
        const userSnapshot = await getDocs(userQuery);
  
        if (!userSnapshot.empty) {
          // Get the first matching document
          const userDoc = userSnapshot.docs[0];
          userRole = userDoc.data().role; // Extract the role from the document
        } else {
          console.error(`No matching user found in Authorized Users for squadron ${squadronNumber}.`);
          userRole = "unknown"; // Default to "unknown" if no match is found
        }
      } catch (err) {
        console.error("Error fetching user role from Authorized Users:", err);
        userRole = "unknown"; // Default to "unknown" in case of an error
      }
    } else {
      userRole = "admin"; // If the role is System Admin, set it to "admin"
    }
  
    // Call the onUserChange prop to pass the user and squadron data to App.js
    onUserChange(
      { displayName, uid, squadronName, squadronNumber, flightNames, role: userRole }, // User data
      userRole === "admin" // isAdmin status
    );
  };
  

  const fetchSquadronName = async (squadronNumber) => {
    try {
      const squadronListCollectionRef = collection(db, "Squadron List");
      //console.log("Squadron number being queried:", squadronNumber);
      const squadronQuery = query(squadronListCollectionRef, where("Number", "==", parseInt(squadronNumber, 10)));
      const squadronSnapshot = await getDocs(squadronQuery);

      if (!squadronSnapshot.empty) {
        // Get the first matching document
        const squadronDoc = squadronSnapshot.docs[0];
        return squadronDoc.data().Name; // Return the squadron name
      } else {
        console.error(`Squadron with number ${squadronNumber} not found in Squadron List.`);
        return null;
      }
    } catch (err) {
      console.error("Error fetching squadron name:", err);
      return null;
    }
  };

  const fetchFlightNames = async (squadronNumber) => {
    try {
      const squadronListCollectionRef = collection(db, "Squadron List");
      //console.log("Fetching flight names for squadron number:", squadronNumber);
      const squadronQuery = query(squadronListCollectionRef, where("Number", "==", parseInt(squadronNumber, 10)));
      const squadronSnapshot = await getDocs(squadronQuery);
  
      if (!squadronSnapshot.empty) {
        // Get the first matching document
        const squadronDoc = squadronSnapshot.docs[0];
        const flightNames = squadronDoc.data().flights || []; // Retrieve the 'flights' array
        //console.log("Flight names fetched:", flightNames);
        return flightNames; // Return the flight names
      } else {
        console.error(`Squadron with number ${squadronNumber} not found in Squadron List.`);
        return [];
      }
    } catch (err) {
      console.error("Error fetching flight names:", err);
      return [];
    }
  };

  const handleFlightNameChange = (index, value) => {
    const updatedFlightNames = [...flightNames];
    updatedFlightNames[index] = value;
    setFlightNames(updatedFlightNames);
  };

  return (
    <div className="welcome-page">
      <h1>Welcome to the Squadron Tracker</h1>
      <p>{!user && "Please sign in to continue."}</p>
      {error && <p className="error-message">{error}</p>}

{user ? (
  <div>
    <p>Welcome, {user.displayName}!</p>
    {role === "First Login" || role === "System Admin" ? (
      <div>
        <p>Please enter your Squadron number:</p>
        <input
          type="number"
          value={squadronNumber}
          onChange={(e) => setSquadronNumber(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && squadronNumber) {
              handleSquadronSubmit();
            }
          }}
          placeholder="Enter Squadron Number"
          className="squadron-input"
          autoFocus
        />
        <button
          className="submit-squadron-button"
          onClick={handleSquadronSubmit}
          disabled={!squadronNumber}
        >
          Submit
        </button>
      </div>
    ) : null}
    <button className="logout-button" onClick={handleLogout}>
      Log Out
    </button>
  </div>
) : (
  <button className="google-login-button" onClick={handleGoogleLogin}>
    Sign in with Google
  </button>
)}
      {/* Setup Squadron Popup */}
      {showSetupPopup && (
        <>
          <div className="popup-overlay"></div>
          <div className="popup">
            <p>Squadron does not exist. Would you like to set up a new Squadron account?</p>
            <div className="popup-bottom-buttons">
              <button className="popup-button-red" onClick={handleSetupCancel}>
                Cancel
              </button>
              <button className="popup-button-green" onClick={() => setShowBlankPopup(true)}>
                Set Up
              </button>
            </div>
          </div>
        </>
      )}

      {/* New Squadron Setup Popup */}
      {showBlankPopup && (
        <>
          <div className="popup-overlay"></div>
          <div className="popup">
            <p className="popup-title">New Squadron Setup</p>
            <div>
              <label className="label-spacing">Squadron Name:</label>
              <input
                type="text"
                value={squadronName}
                onChange={(e) => setSquadronName(e.target.value)}
                placeholder="Enter Squadron Name"
                className="squadron-name-input"
              />
            </div>
            <br></br>
            <div>
              <label className="label-spacing">Squadron Number:</label>
              <input
                type="number"
                value={squadronNumber}
                readOnly
                className="squadron-input"
              />
            </div>
            <div>
              <p>Please enter the names of your flights:</p>
              {flightNames.map((flightName, index) => (
                <input
                  key={index}
                  type="text"
                  value={flightName}
                  onChange={(e) => handleFlightNameChange(index, e.target.value)}
                  placeholder={
                    index === 0
                      ? "Staff Team/Training Flight"
                      : index === 1
                      ? "Flight 1 Name"
                      : "Flight 2 Name"
                  } // Dynamic placeholder text
                  className="squadron-name-input"
                />
              ))}
            </div>
            <br></br>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                />
                I will be the account admin
              </label>
            </div>
            {showAdminWarning && (
              <p className="error-message">You must confirm that you will be the account admin.</p>
            )}
            <div className="popup-bottom-buttons">
              <button className="popup-button-red" onClick={handleSetupCancel}>
                Cancel
              </button>
              <button
                className="popup-button-green"
                onClick={handleSetupConfirm}
                disabled={
                  !squadronName.trim() || // Squadron name must not be empty
                  flightNames.slice(1).some((name) => name.trim() === "") || // Check only the second and third flight names
                  !isAdmin // Admin checkbox must be checked
                }
              >
                Confirm
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WelcomePage;