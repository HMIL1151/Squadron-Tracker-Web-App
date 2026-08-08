//TODO: Squadrons declare flight bnames

import React, { useState, useEffect, useContext } from "react";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth"; // Import Firebase Auth
import { checkUserRole, createAccessRequest } from "../../firebase/users";
import { doesSquadronExist, fetchSquadronDoc } from "../../firebase/squadron";
import { createAccountRequest, createSquadron } from "../../firebase/accounts";
import { squadronCollection, getDocs, query, where } from "../../firebase/db";
import { DataContext } from "../../context/DataContext"; // Import DataContext
import "./WelcomePage.css"; // Optional: Add styles for the welcome page
import "../Dashboards/DashboardComponents/dashboardStyles.css"; // Import styles for buttons and popups

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
  // Starts with a staff flight and one competing flight; rows are added and
  // removed freely. Previously fixed at exactly three, which meant a squadron
  // with four flights simply could not be created.
  const [flightNames, setFlightNames] = useState(["", ""]);
  const [isRequestSubmitted, setIsRequestSubmitted] = useState(false); // Track if the request has been submitted
  const [changelog, setChangelog] = useState([]); // State to store changelog entries

  const { fetchData } = useContext(DataContext); // Access fetchData from DataContext

  useEffect(() => {
    const fetchChangelog = async () => {
      try {
        const response = await fetch("/changelog.json"); // Fetch the changelog.json file from the public directory
        if (!response.ok) {
          console.error("Failed to fetch changelog.json");
        }

        const changelogEntries = await response.json(); // Parse the JSON data

        // Sort changelog entries by version (descending order)
        changelogEntries.sort((a, b) => {
          const parseVersion = (version) =>
            version
              .replace(/^v/, "") // Remove the "v" prefix
              .split(".") // Split into parts
              .map(Number); // Convert each part to a number

          const aParts = parseVersion(a.version);
          const bParts = parseVersion(b.version);

          for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aPart = aParts[i] || 0; // Default to 0 if part is missing
            const bPart = bParts[i] || 0;

            if (aPart !== bPart) {
              return bPart - aPart; // Descending order
            }
          }

          return 0; // Versions are equal
        });

        setChangelog(changelogEntries);
      } catch (err) {
        console.error("Error fetching changelog:", err);
      }
    };

    fetchChangelog();
  }, []);

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

        // One lookup for name, flights and the document id. This used to be
        // two identical queries plus a third that could never match.
        const squadron = await fetchSquadronDoc(squadronNumber);

        await fetchData(squadronNumber);

        navigateToMainContent({
          displayName,
          uid,
          squadronName: squadron?.Name ?? null,
          squadronNumber: parseInt(squadronNumber, 10),
          squadronDocId: squadron?.id ?? null,
          flightNames: squadron?.flights ?? [],
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
      const collectionExists = await doesSquadronExist(squadronNumber);

      if (role === "First Login" && collectionExists) {
        const squadron = await fetchSquadronDoc(squadronNumber);

        if (!squadron?.Name) {
          setError("Failed to fetch squadron name. Please try again.");
          return;
        }

        await createAccessRequest(squadronNumber, {
          displayName: user.displayName,
          email: user.email,
          uid: user.uid,
          progress: "pending",
          timestamp: new Date().toISOString(), // Current timestamp in ISO format
        });

        // Notify the user
        setError("Your request to join the squadron is pending approval, please contact your Squadron's Admin.");
      } else if (role === "System Admin" && collectionExists) {
        const squadron = await fetchSquadronDoc(squadronNumber);

        if (!squadron?.Name) {
          setError("Failed to fetch squadron name. Please try again.");
          return;
        }

        await fetchData(squadronNumber); // Trigger bulk data fetch for the squadron

        // Navigate to main content and pass user and squadron data
        navigateToMainContent({
          displayName: user.displayName,
          uid: user.uid,
          squadronName: squadron.Name,
          squadronNumber: parseInt(squadronNumber, 10),
          squadronDocId: squadron.id,
          flightNames: squadron.flights ?? [],
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
      return;
    }

    // Check if the user is a system admin
    if (role !== "System Admin") {
      try {
        await createAccountRequest({
          squadronName: squadronName.trim(),
          squadronNumber: parseInt(squadronNumber, 10),
          // An array now, rather than three flat fields. flight1Name..3Name
          // are still written so a System Admin running an older build can
          // read the request; SystemAdminDashboard prefers `flights`.
          flights: flightNames.map((name) => name.trim()),
          flight1Name: (flightNames[0] || "").trim(),
          flight2Name: (flightNames[1] || "").trim(),
          flight3Name: (flightNames[2] || "").trim(),
          displayName: user.displayName,
          uid: user.uid,
          email: user.email,
          timestamp: new Date().toISOString(), // Add a timestamp for when the request was made
        });

        // Notify the user
        setError(
          "Your request to create a new squadron account has been submitted for review by a System Admin - contact harrison.milburn101@rafac.mod.gov.uk."
        );

        // Close all popups
        setShowSetupPopup(false);
        setShowBlankPopup(false);

        // Set the request submitted state
        setIsRequestSubmitted(true);
      } catch (err) {
        console.error("Error submitting new account request:", err);
        setError("Failed to submit your request. Please try again.");
      }
      return;
    }

    try {
      // The staff flight name is optional in the form; default it rather than
      // creating a squadron whose first flight has no name.
      const updatedFlightNames = [...flightNames];
      if (!updatedFlightNames[0].trim()) {
        updatedFlightNames[0] = "Training Flight";
      }

      await createSquadron({
        squadronName,
        squadronNumber,
        flights: updatedFlightNames,
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
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
  };
  

  const navigateToMainContent = async ({ displayName, uid, squadronName, squadronNumber, squadronDocId, flightNames }) => {
    let userRole = role; // Default to the role from checkUserRole
  
    if (role !== "System Admin") {
      try {
        // Query for the document where displayName matches the user's displayName
        const userQuery = query(
          squadronCollection(squadronNumber, "AuthorisedUsers"),
          where("displayName", "==", displayName)
        );
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
    // squadronDocId travels with it so flight edits can write back to the
    // SquadronList document, which is only findable by its Number field.
    onUserChange(
      { displayName, uid, squadronName, squadronNumber, squadronDocId, flightNames, role: userRole }, // User data
      userRole === "admin" // isAdmin status
    );
  };
  

  const addFlightRow = () => setFlightNames((prev) => [...prev, ""]);

  const removeFlightRow = (index) =>
    setFlightNames((prev) => prev.filter((_, i) => i !== index));

  const handleFlightNameChange = (index, value) => {
    const updatedFlightNames = [...flightNames];
    updatedFlightNames[index] = value;
    setFlightNames(updatedFlightNames);
  };

  return (
    <div className="welcome-page">
      <h1>Welcome to the Squadron Tracker</h1>
      {error && <p className="error-message">{error}</p>}

      {user ? (
        <div>
          {!isRequestSubmitted && (
            <>
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
            </>
          )}
          <button className="logout-button" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      ) : (
        <button className="google-login-button" onClick={handleGoogleLogin}>
          Sign in with Google
        </button>
      )}

      {/* Changelog Section */}
      <div className="changelog-container">
        <h2>Change Log</h2>
        <div className="changelog-box">
          {changelog.length > 0 ? (
            changelog.map((entry) => (
              <div key={entry.version} className="changelog-entry">
                <h3>{`${entry.version} - ${entry.date}`}</h3> {/* Combine version and date */}
                <p
                  dangerouslySetInnerHTML={{
                    __html: entry.content.replace(/\n/g, "<br><br>"), // Replace \n with <br>
                  }}
                ></p>
              </div>
            ))
          ) : (
            <p>Loading Change Log...</p>
          )}
        </div>
      </div>

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
                <div key={index} className="flight-name-row">
                  <input
                    type="text"
                    value={flightName}
                    onChange={(e) => handleFlightNameChange(index, e.target.value)}
                    placeholder={
                      index === 0
                        ? "Staff Team/Training Flight"
                        : `Flight ${index} Name`
                    }
                    className="squadron-name-input"
                    aria-label={index === 0 ? "Staff flight name" : `Flight ${index} name`}
                  />
                  {/* The staff flight and the first competing flight are the
                      minimum a squadron can have, so those two cannot be
                      removed. */}
                  {index > 1 && (
                    <button
                      type="button"
                      className="remove-flight-button"
                      onClick={() => removeFlightRow(index)}
                      aria-label={`Remove flight ${index}`}
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="add-flight-button" onClick={addFlightRow}>
                + Add another flight
              </button>
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
                  flightNames.slice(1).some((name) => name.trim() === "") || // Every flight after the staff flight needs a name
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