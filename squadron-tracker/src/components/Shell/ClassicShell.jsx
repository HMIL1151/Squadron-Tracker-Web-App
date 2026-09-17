import { Suspense } from "react";
import Menu from "../Menu/Menu";
import ThemeToggle from "../ThemeToggle/ThemeToggle";
import UiToggle from "../UiToggle/UiToggle";

/**
 * The frame the app has always had: a dark bar across the top, a menu down the
 * left, content in the rest.
 *
 * Lifted out of App.jsx unchanged when the second interface arrived. App now
 * owns the state and picks a shell; this owns the markup. The JSX below is a
 * verbatim move, including the global class names from Styles/App.css and the
 * inline "Loading..." fallback -- the point was to make room for MusterShell
 * without touching a pixel of this one, and the test suite passing with no
 * snapshot updates is the evidence for that.
 *
 * So: this file is deliberately not improved. It is the thing people can be
 * returned to when the new interface goes wrong, and it should stay recognisable.
 */
const ClassicShell = ({
  user,
  isAdmin,
  version,
  activeMenu,
  setActiveMenu,
  isMenuCollapsed,
  toggleMenu,
  onLogout,
  children,
}) => (
  <div className={`App ${isMenuCollapsed ? "menu-collapsed" : ""}`}>
    <header className="app-header">
      <div className="title">Squadron Tracker, {user.squadronNumber} ({user.squadronName}) Squadron ATC</div>
      <div className="user-info">
        <span>Logged in as {user.displayName}</span>
        <UiToggle />
        <ThemeToggle />
        <button className="logout-button" onClick={onLogout}>
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
    <main className="main-content">
      {/* Dashboards are lazy-loaded (see dashboardList.js), so a boundary is
          required while the chunk downloads. */}
      <Suspense fallback={<p>Loading...</p>}>{children}</Suspense>
    </main>
    {/* Version number in the bottom-right corner */}
    <div className="version-number">{version}</div>
  </div>
);

export default ClassicShell;
