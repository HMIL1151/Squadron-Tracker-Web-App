import React, { useState, useEffect } from "react";
import { auth, googleProvider } from "../../firebase/firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import "./Auth.css";

const Auth = ({ onUserChange }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      onUserChange(currentUser); // Pass user info to parent component
    });
    return () => unsubscribe();
  }, [onUserChange]);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
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
        </div>
      ) : (
        <button className="auth-button sign-in" onClick={handleSignIn}>
          Sign In with Google
        </button>
      )}
      <hr />
    </div>
  );
  
};

export default Auth;