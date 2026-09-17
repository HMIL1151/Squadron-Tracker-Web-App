//TODO: Collapsing Menu

import React from "react";
import { dashboardsFor } from "../Dashboards/DashboardComponents/dashboardList";
import styles from "./Menu.module.css";

const Menu = ({ activeMenu, setActiveMenu, isAdmin, isMenuCollapsed, user }) => {
  /*
   * The permission filter moved into dashboardList so that this menu and the
   * Muster rail cannot drift apart on who may see what -- two copies of an
   * access rule is one copy too many.
   *
   * Pinned to "classic" rather than reading the interface: this component IS
   * the classic menu. Muster has its own navigation, and a screen that exists
   * only there is dropped here rather than rendered as an entry that would
   * fall back to a classic view that does not exist.
   */
  const filteredDashboards = dashboardsFor({ uiVersion: "classic", isAdmin, user });

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