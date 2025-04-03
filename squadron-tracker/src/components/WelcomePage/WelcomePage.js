import React, { useState } from "react";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth"; // Import Firebase Auth
import { getFirestore, collection, doc, setDoc } from "firebase/firestore"; // Import Firestore functions
import { checkUserRole, doesCollectionExist } from "../../firebase/firestoreUtils"; // Import Firestore utility functions
import "./WelcomePage.css"; // Optional: Add styles for the welcome page
import "../Dashboards/Dashboard Components/dashboardStyles.css"; // Import styles for buttons and popups

const WelcomePage = () => {
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
      console.log("User Details:", { uid, email, displayName });

      // Check the user's role using the UID
      const userRole = await checkUserRole(uid);
      console.log("User Role Response:", userRole);

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
      console.log("User successfully logged out.");
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
      console.log("Squadron Number Submitted:", squadronNumber);

      // Check if the collection exists
      const collectionExists = await doesCollectionExist(squadronNumber);
      console.log("Does Squadron Collection Exist:", collectionExists);

      if (!collectionExists) {
        setShowSetupPopup(true); // Show the setup popup if the collection does not exist
      }
    } catch (err) {
      console.error("Error checking Squadron collection existence:", err);
      setError("Failed to verify Squadron number. Please try again.");
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
        console.log("Squadron added to 'Squadron List' collection.");

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
          role: "Admin",
        });
        console.log("Admin user added to 'Authorised Users' subcollection.");

        // Close the popup and reset the form
        setShowBlankPopup(false);
        setSquadronName("");
        setSquadronNumber("");
        setIsAdmin(false);
        alert("Squadron setup successfully completed!");
      } catch (err) {
        console.error("Error during squadron setup:", err);
        setError("Failed to set up the squadron. Please try again.");
      }
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