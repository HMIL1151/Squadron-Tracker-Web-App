//TODO: Add a change log txt (not sure how to do this in firestore )

import "./Styles/App.css";
import { useState, useEffect } from "react";
import Menu from "./components/Menu/Menu"; // Import the Menu component
import WelcomePage from "./components/WelcomePage/WelcomePage"; // Import the new WelcomePage component
import { signOut } from "firebase/auth";
import { auth } from "./firebase/firebase"; // Adjust the import path to your Firebase configuration
import dashboardList from "./components/Dashboards/Dashboard Components/dashboardList";
import { useSquadron } from "./context/SquadronContext"; // Import the custom hook
import { setFlightMap } from "./utils/mappings"; // Import the setter function for flightMap
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore"; // Import Firestore functions

const App = () => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false); // Track if the user is an admin
  const [activeMenu, setActiveMenu] = useState(dashboardList[0]?.key || ""); // Default to the first dashboard key
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false); // New state for menu visibility
  const [version, setVersion] = useState("Loading..."); // Initialize version as "Loading..."

  const { setSquadronNumber } = useSquadron(); // Access the context

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await fetch("/changelog.json"); // Fetch the changelog.json file
        if (!response.ok) {
          throw new Error("Failed to fetch changelog.json");
        }

        const changelog = await response.json(); // Parse the JSON data

        // Find the highest version number
        const highestVersion = changelog
          .map((entry) => entry.version)
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];

        setVersion(highestVersion); // Set the highest version
      } catch (err) {
        console.error("Error fetching version:", err);
        setVersion("Error fetching version");
      }
    };

    fetchVersion();
  }, []);

  const handleUserChange = async (currentUser, isAdminStatus) => {
    const db = getFirestore();
    const massUserListRef = collection(db, "MassUserList");
    const userQuery = query(massUserListRef, where("UID", "==", currentUser.uid));
    const snapshot = await getDocs(userQuery);

    let isSystemAdmin = false;
    if (!snapshot.empty) {
      snapshot.forEach((doc) => {
        if (doc.data().systemAdmin === true) {
          isSystemAdmin = true;
        }
      });
    }

    // Update the user object to include systemAdmin
    const updatedUser = {
      ...currentUser,
      systemAdmin: isSystemAdmin,
    };

    setUser(updatedUser);
    setIsAdmin(isAdminStatus || isSystemAdmin);

    setSquadronNumber(currentUser.squadronNumber);

    // Extract flightNames from the user data and update the state
    if (currentUser?.flightNames) {
      // Dynamically update flightMap using the flightNames array
      const newFlightMap = currentUser.flightNames.reduce((map, flightName, index) => {
        map[index + 1] = flightName; // Map flight names to indices starting from 1
        return map;
      }, {});
      setFlightMap(newFlightMap); // Update the flightMap in mappings.js
    }
  };

  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        setUser(null); // Clear the user state
        setActiveMenu(dashboardList[0]?.key || ""); // Reset the menu to the first dashboard
        setSquadronNumber(null); // Clear the squadron number in the context
        setIsAdmin(false); // Reset admin status
      })
      .catch((error) => {
        console.error("Error logging out:", error);
      });
  };

  const toggleMenu = () => {
    setIsMenuCollapsed((prev) => !prev); // Toggle menu state
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
    <div className={`App ${isMenuCollapsed ? "menu-collapsed" : ""}`}>
      <header className="app-header">
        <div className="title">Squadron Tracker, {user.squadronNumber} ({user.squadronName}) Squadron ATC</div>
        <div className="user-info">
          <span>Logged in as {user.displayName}</span>
          <button className="logout-button" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </header>
      <button className="menu-toggle-button" onClick={toggleMenu}>
        {isMenuCollapsed ? "❯" : "❮"}
      </button>
      <Menu
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        isAdmin={isAdmin}
        user={user} // Pass the user object
        isMenuCollapsed={isMenuCollapsed} // Pass the state to Menu
      />
      <main className="main-content">{renderMainContent()}</main>
      {/* Version number in the bottom-right corner */}
      <div className="version-number">{version}</div>
    </div>
  );
};

export default App;