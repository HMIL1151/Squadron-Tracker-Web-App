import "./Styles/App.css";
import { useState } from "react";
import Auth from "./components/Auth/Auth";
import CadetsDashboard from "./components/Dashboards/CadetsDashboard/CadetsDashboard";
import MassEventLog from "./components/Dashboards/Mass Event Log/MassEventLog";
import Menu from "./components/Menu/Menu"; // Import the Menu component
import { signOut } from "firebase/auth";
import { auth } from "./firebase/firebase"; // Adjust the import path to your Firebase configuration

const App = () => {
  const [user, setUser] = useState(null);
  const [activeMenu, setActiveMenu] = useState("dashboard");

  const handleUserChange = (currentUser) => {
    setUser(currentUser);
  };

  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        setUser(null); // Clear the user state
        setActiveMenu("dashboard"); // Reset the menu to a default state
        console.log("User successfully logged out.");
      })
      .catch((error) => {
        console.error("Error logging out:", error);
      });
  };

  const renderMainContent = () => {
    switch (activeMenu) {
      case "dashboard":
        return <CadetsDashboard user={user} />;
      case "masseventlog":
        return <MassEventLog />;
      default:
        return <h2>Default</h2>;
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="title">Squadron Tracker, 1151 (Wallsend) Squadron ATC</div>
        {user && (
          <div className="user-info">
            <span>Logged in as {user.displayName}</span>
            <button className="logout-button" onClick={handleLogout}>
              Log Out
            </button>
          </div>
        )}
      </header>
      {!user ? (
        <div className="auth-modal">
          <h2>Welcome to Squadron Tracker</h2>
          <p>Please sign in to continue.</p>
          <Auth onUserChange={handleUserChange} />
        </div>
      ) : (
        <>
          <Menu activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
          <main className="main-content">{renderMainContent()}</main>
        </>
      )}
    </div>
  );
};

export default App;