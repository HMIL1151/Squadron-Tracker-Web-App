//TODO: Add a change log txt (not sure how to do this in firestore )

import "./Styles/App.css";
import { useState } from "react";
import Menu from "./components/Menu/Menu"; // Import the Menu component
import WelcomePage from "./components/WelcomePage/WelcomePage"; // Import the new WelcomePage component
import { signOut } from "firebase/auth";
import { auth } from "./firebase/firebase"; // Adjust the import path to your Firebase configuration
import dashboardList from "./components/Dashboards/Dashboard Components/dashboardList";
import { getFirestore, doc, getDoc } from "firebase/firestore/lite"; // Import Firestore functions

const App = () => {
  const version = "v0.6.1"; // Define the version number
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false); // Track if the user is an admin
  const [activeMenu, setActiveMenu] = useState(dashboardList[0]?.key || ""); // Default to the first dashboard key

  const handleUserChange = (currentUser, isAdminStatus) => {
    setUser(currentUser);
    setIsAdmin(isAdminStatus);
  };

  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        setUser(null); // Clear the user state
        setActiveMenu(dashboardList[0]?.key || ""); // Reset the menu to the first dashboard
        console.log("User successfully logged out.");
      })
      .catch((error) => {
        console.error("Error logging out:", error);
      });
  };

  const renderMainContent = () => {
    // If no active menu is set, default to the first dashboard in the list
    const activeDashboard = dashboardList.find((d) => d.key === activeMenu) || dashboardList[0];

    if (activeDashboard) {
      const DashboardComponent = activeDashboard.component;
      return <DashboardComponent user={user} />;
    }

    return <h2>No Dashboards Available</h2>;
  };

  if (!user) {
    return <WelcomePage onUserChange={handleUserChange} />;
  }

  return (
    <div className="App">
      <header className="app-header">
        <div className="title">Squadron Tracker, 1151 (Wallsend) Squadron ATC</div>
        <div className="user-info">
          <span>Logged in as {user.displayName}</span>
          <button className="logout-button" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </header>
      <Menu activeMenu={activeMenu} setActiveMenu={setActiveMenu} isAdmin={isAdmin} />
      <main className="main-content">{renderMainContent()}</main>
      {/* Version number in the bottom-right corner */}
      <div className="version-number">{version}</div>
    </div>
  );
};

export default App;