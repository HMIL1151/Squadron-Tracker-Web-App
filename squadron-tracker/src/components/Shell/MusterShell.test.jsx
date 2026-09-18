/**
 * The Muster shell.
 *
 * The navigation is the interesting part. Three things have to hold:
 *
 * The permission rules are the ones the classic menu has always applied --
 * they moved into dashboardList so the two navigations cannot drift apart on
 * who may see what, and this is the check that the move kept them.
 *
 * Screens that exist only in Muster appear here and nowhere else.
 *
 * Navigation is buttons, not links. The app has no routing, so an <a href="#">
 * would put junk in the address bar and lie to anyone using a screen reader.
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MusterShell from "./MusterShell";
import ClassicShell from "./ClassicShell";
import { UiVersionProvider } from "../../context/UiVersionContext";
import { ThemeProvider } from "../../context/ThemeContext";
import { __seed } from "../../test/fakeFirestore";

const USER = {
  uid: "shell-uid",
  displayName: "Sam Brennan",
  squadronNumber: 9999,
  squadronName: "Faketon",
  systemAdmin: false,
};

const renderShell = (Shell, props = {}) => {
  __seed({});
  return render(
    <UiVersionProvider uid={USER.uid} initialVersion="muster">
      <ThemeProvider uid={USER.uid} initialTheme="light">
        <Shell
          user={USER}
          isAdmin={false}
          version="v0.16.0"
          activeMenu="masseventlog"
          setActiveMenu={() => {}}
          isMenuCollapsed={false}
          toggleMenu={() => {}}
          onLogout={() => {}}
          {...props}
        >
          <p>dashboard content</p>
        </Shell>
      </ThemeProvider>
    </UiVersionProvider>
  );
};

const nav = () => screen.getByRole("navigation", { name: "Squadron Tracker" });

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-ui");
});

describe("the rail", () => {
  it("carries the squadron identity, which the classic shell put in a top bar", () => {
    renderShell(MusterShell);
    expect(within(nav()).getByText("9999")).toBeInTheDocument();
    expect(within(nav()).getByText(/Faketon Squadron/)).toBeInTheDocument();
  });

  it("groups the screens rather than listing ten flat", () => {
    renderShell(MusterShell);
    expect(within(nav()).getByRole("heading", { name: "Records" })).toBeInTheDocument();
    expect(within(nav()).getByRole("heading", { name: "Progress" })).toBeInTheDocument();
    expect(within(nav()).getByRole("heading", { name: "Squadron" })).toBeInTheDocument();
  });

  it("uses buttons, because the app has no routing to link to", () => {
    renderShell(MusterShell);
    expect(within(nav()).queryAllByRole("link")).toHaveLength(0);
    expect(within(nav()).getAllByRole("button").length).toBeGreaterThan(5);
  });

  it("marks the screen you are on for a screen reader, not just visually", () => {
    renderShell(MusterShell);
    const current = within(nav()).getByRole("button", { name: "Mass Event Log" });
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("switches screen when a nav item is pressed", async () => {
    const setActiveMenu = jest.fn();
    renderShell(MusterShell, { setActiveMenu });

    await userEvent.click(within(nav()).getByRole("button", { name: "Cadet List" }));
    expect(setActiveMenu).toHaveBeenCalledWith("dashboard");
  });

  it("renders the dashboard it was given", () => {
    renderShell(MusterShell);
    expect(screen.getByText("dashboard content")).toBeInTheDocument();
  });
});

describe("who sees what", () => {
  it("hides admin screens from ordinary staff", () => {
    renderShell(MusterShell);
    expect(within(nav()).queryByRole("button", { name: "Flights" })).not.toBeInTheDocument();
    expect(within(nav()).queryByRole("button", { name: "Admin Area" })).not.toBeInTheDocument();
  });

  it("shows them to an admin", () => {
    renderShell(MusterShell, { isAdmin: true });
    expect(within(nav()).getByRole("button", { name: "Flights" })).toBeInTheDocument();
    expect(within(nav()).getByRole("button", { name: "Admin Area" })).toBeInTheDocument();
  });

  it("keeps the system admin area for system admins only", () => {
    renderShell(MusterShell, { isAdmin: true });
    expect(within(nav()).queryByRole("button", { name: "System Admin Area" })).not.toBeInTheDocument();

    renderShell(MusterShell, { isAdmin: true, user: { ...USER, systemAdmin: true } });
    expect(screen.getAllByRole("button", { name: "System Admin Area" }).length).toBeGreaterThan(0);
  });

  /*
   * Statistics is a screen the classic interface never had, so it appears in
   * this rail and not in the classic menu.
   */
  it("offers the statistics screen, which classic does not have", () => {
    renderShell(MusterShell);
    expect(within(nav()).getByRole("button", { name: "Squadron Statistics" })).toBeInTheDocument();

    renderShell(ClassicShell);
    const classicMenu = screen.getAllByRole("navigation").at(-1);
    expect(within(classicMenu).queryByText("Squadron Statistics")).not.toBeInTheDocument();
  });
});
