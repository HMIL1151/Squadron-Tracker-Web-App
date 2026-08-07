/**
 * CHARACTERIZATION -- Menu.
 *
 * Menu visibility is the app's only client-side gate on admin features, so what
 * it hides from whom is worth pinning precisely. Note that hiding a menu item is
 * not access control: the Firestore rules in Phase 4 are what actually enforce
 * this. These tests record the UI behaviour, not a security guarantee.
 */

import React from "react";
import { render, screen } from "@testing-library/react";

import Menu from "./Menu";
import dashboardList from "../Dashboards/Dashboard Components/dashboardList";

const renderMenu = (props = {}) =>
  render(
    <Menu
      activeMenu="masseventlog"
      setActiveMenu={() => {}}
      isAdmin={false}
      isMenuCollapsed={false}
      user={{}}
      {...props}
    />
  );

const visibleItems = () => screen.getAllByRole("listitem").map((li) => li.textContent);

describe("visibility by role", () => {
  it("shows only non-admin dashboards to a plain user", () => {
    renderMenu({ isAdmin: false });
    expect(visibleItems()).toMatchSnapshot();
  });

  it("adds the admin area for an admin", () => {
    renderMenu({ isAdmin: true, user: { systemAdmin: false } });
    expect(visibleItems()).toContain("Admin Area");
  });

  it("hides the system admin area from a plain admin", () => {
    renderMenu({ isAdmin: true, user: { systemAdmin: false } });
    expect(visibleItems()).not.toContain("System Admin Area");
  });

  it("shows the system admin area only to a system admin", () => {
    renderMenu({ isAdmin: true, user: { systemAdmin: true } });
    expect(visibleItems()).toContain("System Admin Area");
  });

  it("requires isAdmin as well as systemAdmin for the system admin area", () => {
    // dashboardList marks that entry both adminOnly and systemAdminOnly, and
    // Menu checks `isAdmin && user?.systemAdmin`.
    renderMenu({ isAdmin: false, user: { systemAdmin: true } });
    expect(visibleItems()).not.toContain("System Admin Area");
  });

  it("hides every admin-only dashboard from a plain user", () => {
    renderMenu({ isAdmin: false });
    const shown = visibleItems();
    dashboardList
      .filter((d) => d.adminOnly)
      .forEach((d) => expect(shown).not.toContain(d.title));
  });
});

describe("presentation", () => {
  it("marks the active dashboard", () => {
    renderMenu({ activeMenu: "ptstracker" });
    expect(screen.getByText("PTS Tracker")).toHaveClass("active");
  });

  it("collapses when asked", () => {
    const { container } = renderMenu({ isMenuCollapsed: true });
    expect(container.querySelector("nav")).toHaveClass("collapsed");
  });

  it("is not collapsed by default", () => {
    const { container } = renderMenu({ isMenuCollapsed: false });
    expect(container.querySelector("nav")).not.toHaveClass("collapsed");
  });
});
