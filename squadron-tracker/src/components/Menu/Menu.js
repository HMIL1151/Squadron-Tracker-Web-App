import React from "react";
import "./Menu.css";

const Menu = ({ activeMenu, setActiveMenu }) => {
  return (
    <nav className="menu">
      <ul>
        <li
          className={activeMenu === "dashboard" ? "active" : ""}
          onClick={() => setActiveMenu("dashboard")}
        >
          Cadet List
        </li>
        <li
          className={activeMenu === "masseventlog" ? "active" : ""}
          onClick={() => setActiveMenu("masseventlog")}
        >
          Mass Event Log
        </li>
      </ul>
    </nav>
  );
};

export default Menu;