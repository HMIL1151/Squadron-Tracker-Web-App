import "./Styles/App.css";
import { useState } from "react";
import Auth from "./components/Auth/Auth";
import Menu from "./components/Menu/Menu"; // Import the Menu component
import { signOut } from "firebase/auth";
import { auth } from "./firebase/firebase"; // Adjust the import path to your Firebase configuration
import dashboardList from "./components/Dashboards/dashboardList";

const App = () => {
  const [user, setUser] = useState(null);
  const [activeMenu, setActiveMenu] = useState("masseventlog");

  const handleUserChange = (currentUser) => {
    setUser(currentUser);
  };

  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        setUser(null); // Clear the user state
        setActiveMenu("massseventlog"); // Reset the menu to a default state
        console.log("User successfully logged out.");
      })
      .catch((error) => {
        console.error("Error logging out:", error);
      });
  };

  const renderMainContent = () => {
    const activeDashboard = dashboardList.find((d) => d.key === activeMenu);
    if (activeDashboard) {
      const DashboardComponent = activeDashboard.component;
      return <DashboardComponent user={user} />;
    }
    return <h2>Default</h2>;
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