//TODO: Collapsing Menu

import React from "react";
import dashboardList from "../Dashboards/Dashboard Components/dashboardList";
import "./Menu.css";

const Menu = ({ activeMenu, setActiveMenu, isAdmin, isMenuCollapsed, user }) => {
  const filteredDashboards = dashboardList.filter((dashboard) => {
    if (dashboard.systemAdminOnly) {
      const canView = isAdmin && user?.systemAdmin; // Check if the user is a system admin
      return canView;
    }
    if (dashboard.adminOnly) {
      const canView = isAdmin; // Check if the user is an admin
      return canView;
    }
    return true; // Accessible to all users
  });

  return (
    <nav className={`menu ${isMenuCollapsed ? "collapsed" : ""}`}>
      <ul>
        {filteredDashboards.map((dashboard) => (
          <li
            key={dashboard.key}
            className={activeMenu === dashboard.key ? "active" : ""}
            onClick={() => setActiveMenu(dashboard.key)}
          >
            {dashboard.title}
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Menu;