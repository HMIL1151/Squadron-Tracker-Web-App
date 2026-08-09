//TODO: Collapsing Menu

import React from "react";
import dashboardList from "../Dashboards/DashboardComponents/dashboardList";
import styles from "./Menu.module.css";

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
    <nav className={[styles["menu"], isMenuCollapsed ? styles["collapsed"] : ""].filter(Boolean).join(" ")}>
      <ul>
        {filteredDashboards.map((dashboard) => (
          <li
            key={dashboard.key}
            className={activeMenu === dashboard.key ? styles["active"] : ""}
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