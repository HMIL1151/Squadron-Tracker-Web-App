import React from "react";
import dashboardList from "../Dashboards/dashboardList";
import "./Menu.css";

const Menu = ({ activeMenu, setActiveMenu, isAdmin }) => {
  return (
    <nav className="menu">
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
    </nav>
  );
};

export default Menu;