import React, { useState } from "react";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth"; // Import Firebase Auth
import { getFirestore, collection, doc, setDoc, getDocs, writeBatch, query, where } from "firebase/firestore"; // Import Firestore functions
import { checkUserRole, doesSquadronAccountExist } from "../../firebase/firestoreUtils"; // Import Firestore utility functions
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

  const db = getFirestore(); // Initialize Firestore

  const handleGoogleLogin = async () => {
    const auth = getAuth(); // Initialize Firebase Auth
    const provider = new GoogleAuthProvider(); // Set up Google Auth provider

    try {
      // Sign in with Google
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Capture user details
      const { uid, email, displayName } = user;

      // Check the user's role using the UID
      const userRole = await checkUserRole(uid);

      // If the user role is a number, check the User Requests subcollection
      if (!isNaN(userRole)) {
        const squadronNumber = userRole.toString(); // Convert role to string for document lookup
        const squadronDatabaseDocRef = doc(db, "Squadron Databases", squadronNumber);
        const userRequestsCollectionRef = collection(squadronDatabaseDocRef, "User Requests");

        // Query the User Requests subcollection for a matching document
        const userQuery = query(
          userRequestsCollectionRef,
          where("displayName", "==", displayName),
          where("email", "==", email),
          where("progress", "==", "granted")
        );
        const userRequestSnapshot = await getDocs(userQuery);

        if (!userRequestSnapshot.empty) {
          // Fetch the squadron name from the Squadron List collection
          const squadronName = await fetchSquadronName(squadronNumber);

          if (!squadronName) {
            setError("Failed to fetch squadron name. Please try again.");
            return;
          }

          // Navigate to main content and pass user and squadron data
          navigateToMainContent({
            displayName,
            uid,
            squadronName,
            squadronNumber: parseInt(squadronNumber, 10),
          });
          return;
        }
      }

      // Update the user state and role
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
        setError("Your request to join the squadron is pending approval.");
      } else if (role === "System Admin" && collectionExists) {
        // Fetch the squadron name from the Squadron List collection
        const squadronName = await fetchSquadronName(squadronNumber);

        if (!squadronName) {
          setError("Failed to fetch squadron name. Please try again.");
          return;
        }

        // Navigate to main content and pass user and squadron data
        navigateToMainContent({
          displayName: user.displayName,
          uid: user.uid,
          squadronName,
          squadronNumber: parseInt(squadronNumber, 10),
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
        // Add a new document to the 'Squadron List' collection
        const squadronListDocRef = doc(collection(db, "Squadron List"));
        await setDoc(squadronListDocRef, {
          Name: squadronName,
          Number: parseInt(squadronNumber, 10),
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

  const navigateToMainContent = async ({ displayName, uid, squadronName, squadronNumber }) => {
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
      { displayName, uid, squadronName, squadronNumber, role: userRole }, // User data
      userRole === "admin" // isAdmin status
    );
  };
  

  const fetchSquadronName = async (squadronNumber) => {
    try {
      const squadronListCollectionRef = collection(db, "Squadron List");
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

  return (
    <div className="welcome-page">
      <h1>Welcome to Squadron Tracker</h1>
      <p>Please sign in to continue.</p>
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
                placeholder="Enter Squadron Number"
                className="squadron-input"
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
            <p>New Squadron Setup</p>
            <div>
              <label>Squadron Name:</label>
              <input
                type="text"
                value={squadronName}
                onChange={(e) => setSquadronName(e.target.value)}
                placeholder="Enter Squadron Name"
                className="squadron-input"
              />
            </div>
            <div>
              <label>Squadron Number:</label>
              <input
                type="number"
                value={squadronNumber}
                readOnly
                className="squadron-input"
              />
            </div>
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
              <button className="popup-button-green" onClick={handleSetupConfirm}>
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