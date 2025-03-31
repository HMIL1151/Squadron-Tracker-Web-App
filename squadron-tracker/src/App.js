import "./Styles/App.css";
import { useState } from "react";
import Auth from "./components/Auth/Auth";
import Menu from "./components/Menu/Menu"; // Import the Menu component
import { signOut } from "firebase/auth";
import { auth } from "./firebase/firebase"; // Adjust the import path to your Firebase configuration
import dashboardList from "./components/Dashboards/Dashboard Components/dashboardList";
import { getFirestore, doc, getDoc } from "firebase/firestore/lite"; // Import Firestore functions

const App = () => {
  const version = "v0.5.0"; // Define the version number
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false); // Track if the user is an admin
  const [activeMenu, setActiveMenu] = useState(dashboardList[0]?.key || ""); // Default to the first dashboard key

  const handleUserChange = async (currentUser) => {
    setUser(currentUser);

    if (currentUser) {
      try {
        const db = getFirestore();
        const userDocRef = doc(db, "AuthorizedUsers", currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && userDoc.data().role === "admin") {
          setIsAdmin(true); // Set admin status
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Error checking admin role:", error);
        setIsAdmin(false);
      }
    } else {
      setIsAdmin(false);
    }
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
          <Menu activeMenu={activeMenu} setActiveMenu={setActiveMenu} isAdmin={isAdmin} />
          <main className="main-content">{renderMainContent()}</main>
        </>
      )}
      {/* Version number in the bottom-right corner */}
      <div className="version-number">{version}</div>
    </div>
  );
};

export default App;