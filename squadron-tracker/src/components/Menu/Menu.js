//TODO: Collapsing Menu

import React, { useState } from "react";
import dashboardList from "../Dashboards/Dashboard Components/dashboardList";
import "./Menu.css";

const Menu = ({ activeMenu, setActiveMenu, isAdmin }) => {
  const [isCollapsed, setIsCollapsed] = useState(false); // State to track if the menu is collapsed

  return (
    <div className={`menu-container ${isCollapsed ? "collapsed" : ""}`}>
      <div className="menu">
        <ul>
          {dashboardList
            .filter((dashboard) => (dashboard.adminOnly ? isAdmin : true)) // Filter admin-only dashboards
            .map((dashboard) => (
              <li
                key={dashboard.key}
                className={activeMenu === dashboard.key ? "active" : ""}
                onClick={() => setActiveMenu(dashboard.key)}
              >
                {dashboard.title}
              </li>
            ))}
        </ul>
      </div>
      <button
        className="menu-toggle-tab"
        onClick={() => setIsCollapsed((prev) => !prev)}
      >
        {isCollapsed ? ">" : "<"}
      </button>
    </div>
  );
};

export default Menu;