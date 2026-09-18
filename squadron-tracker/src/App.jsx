//TODO: Add a change log txt (not sure how to do this in firestore )

import "./Styles/App.css";
import { useState, useEffect } from "react";
import WelcomePage from "./components/WelcomePage/WelcomePage"; // Import the new WelcomePage component
import { signOut } from "firebase/auth";
import { auth } from "./firebase/firebase"; // Adjust the import path to your Firebase configuration
import dashboardList, { viewFor } from "./components/Dashboards/DashboardComponents/dashboardList";
import { useSquadron } from "./context/SquadronContext"; // Import the custom hook
import { useUiVersion } from "./context/UiVersionContext";
import { isSystemAdmin } from "./firebase/users";
import ClassicShell from "./components/Shell/ClassicShell";
import MusterShell from "./components/Shell/MusterShell";

/*
 * The two frames the app can wear.
 *
 * An explicit map rather than a conditional, so adding a third is an entry
 * here rather than another branch, and so an unrecognised interface falls back
 * to the one that has been in production longest instead of rendering nothing.
 */
const SHELLS = {
  classic: ClassicShell,
  muster: MusterShell,
};

const App = () => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false); // Track if the user is an admin
  const [activeMenu, setActiveMenu] = useState(dashboardList[0]?.key || ""); // Default to the first dashboard key
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false); // New state for menu visibility
  const [version, setVersion] = useState("Loading..."); // Initialize version as "Loading..."

  const { setSquadron } = useSquadron(); // Access the context
  const { uiVersion } = useUiVersion();

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
    const systemAdmin = await isSystemAdmin(currentUser.uid);

    // Update the user object to include systemAdmin
    const updatedUser = {
      ...currentUser,
      systemAdmin,
    };

    setUser(updatedUser);
    setIsAdmin(isAdminStatus || systemAdmin);

    // Squadron identity and its flights land together. flightMap is derived
    // from flights inside the context, so nothing needs building here.
    setSquadron({
      squadronNumber: currentUser.squadronNumber,
      squadronDocId: currentUser.squadronDocId || null,
      flights: currentUser.flightNames || [],
    });
  };

  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        setUser(null); // Clear the user state
        setActiveMenu(dashboardList[0]?.key || ""); // Reset the menu to the first dashboard
        // Clears the number, doc id AND flights. The old code cleared only the
        // number, so the previous squadron's flight names survived logout and
        // leaked into whoever signed in next.
        setSquadron({ squadronNumber: null, squadronDocId: null, flights: [] });
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

    /*
     * A screen with no Muster view falls back to its classic component, which
     * is what lets the interface ship one screen at a time. The classic view
     * then renders inside the Muster shell -- the reason the Muster palette in
     * tokens.css has to keep every classic component readable.
     */
    const DashboardComponent = viewFor(activeDashboard, uiVersion);

    if (DashboardComponent) {
      return <DashboardComponent user={user} />;
    }

    return <h2>No Dashboards Available</h2>;
  };

  if (!user) {
    return <WelcomePage onUserChange={handleUserChange} />;
  }

  const Shell = SHELLS[uiVersion] ?? SHELLS.classic;

  return (
    <Shell
      user={user}
      isAdmin={isAdmin}
      version={version}
      activeMenu={activeMenu}
      setActiveMenu={setActiveMenu}
      isMenuCollapsed={isMenuCollapsed}
      toggleMenu={toggleMenu}
      onLogout={handleLogout}
    >
      {renderMainContent()}
    </Shell>
  );
};

export default App;