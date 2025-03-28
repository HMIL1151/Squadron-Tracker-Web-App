import React, { useState, useEffect } from "react";
import { auth, googleProvider } from "../../firebase/firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore/lite"; // Import Firestore functions
import "./Auth.css";

const Auth = ({ onUserChange }) => {
  const [user, setUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState(""); // State for error messages
  const [isUnauthorized, setIsUnauthorized] = useState(false); // State for unauthorized users
  const [signedOutUser, setSignedOutUser] = useState(null); // Store signed-out user info

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth state changed. Current user:", currentUser);

      if (currentUser) {
        const db = getFirestore();
        const userDocRef = doc(db, "AuthorizedUsers", currentUser.uid);
        console.log("Checking Firestore for authorized user:", currentUser.uid);

        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            console.log("User is authorized:", userDoc.data());
            setUser(currentUser);
            onUserChange(currentUser); // Pass user info to parent component
            setErrorMessage(""); // Clear any previous error messages
            setIsUnauthorized(false); // Reset unauthorized state
          } else {
            console.warn("User is not authorized. Signing out...");
            setSignedOutUser(currentUser); // Save user info before signing out
            await signOut(auth); // Sign out unauthorized user
            setUser(null);
            setErrorMessage("Access denied: You are not an authorized user.");
            setIsUnauthorized(true); // Mark user as unauthorized
          }
        } catch (error) {
          console.error("Error checking Firestore for authorized user:", error);
          setErrorMessage("An error occurred while checking authorization.");
        }
      } else {
        console.log("No user is signed in.");
        setUser(null);
        onUserChange(null);
        setIsUnauthorized(false); // Reset unauthorized state
      }
    });
    return () => unsubscribe();
  }, [onUserChange]);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      console.log("Signed in user:", auth.currentUser); // Debugging line
    } catch (error) {
      console.error("Error signing in:", error);
      setErrorMessage("Error signing in. Please try again.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setErrorMessage(""); // Clear any error messages
      setIsUnauthorized(false); // Reset unauthorized state
    } catch (error) {
      console.error("Error signing out:", error);
      setErrorMessage("Error signing out. Please try again.");
    }
  };

  const handleRequestAccess = async () => {
    const userToRequestAccess = auth.currentUser || signedOutUser; // Use signedOutUser if no current user

    if (!userToRequestAccess) {
      setErrorMessage("No user is signed in. Please sign in first.");
      return;
    }

    try {
      console.log("Requesting Access");
      const db = getFirestore();
      const requestDocRef = doc(db, "UserRequests", userToRequestAccess.uid);

      // Check if a request already exists
      const existingRequest = await getDoc(requestDocRef);
      if (existingRequest.exists()) {
        setErrorMessage("Access request already submitted. Please wait for approval.");
        return;
      }

      // Create a new access request
      await setDoc(requestDocRef, {
        progress: "pending",
        displayName: userToRequestAccess.displayName || "Unknown User",
        email: userToRequestAccess.email || "No Email Provided",
        timestamp: new Date().toISOString(),
      });

      setErrorMessage("Access request submitted successfully. Please wait for approval.");
    } catch (error) {
      setErrorMessage("Error submitting access request. Please try again.");
    }
  };

  return (
    <div className="auth-container">
      {user ? (
        <div>
          <p>Welcome, {user.displayName}!</p>
          <button className="auth-button sign-out" onClick={handleSignOut}>
            Sign Out
          </button>
          {(user || signedOutUser) && isUnauthorized && (
            <button className="auth-button request-access" onClick={handleRequestAccess}>
              Request Access
            </button>
          )}
        </div>
      ) : (
        <div>
          <button className="auth-button sign-in" onClick={handleSignIn}>
            Sign In with Google
          </button>
          {(user || signedOutUser) && isUnauthorized && (
            <button className="auth-button request-access" onClick={handleRequestAccess}>
              Request Access
            </button>
          )}
          {errorMessage && <p className="error-message">{errorMessage}</p>}
        </div>
      )}
      <hr />
    </div>
  );
};

export default Auth;