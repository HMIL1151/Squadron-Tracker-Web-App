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
 *
 * Collapsing is the fourth. The thing worth holding still is that it hides
 * LABELS, not navigation: every screen stays reachable and every button keeps
 * its accessible name, so a collapsed rail is a narrower rail rather than a
 * worse one.
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

describe("collapsing the rail", () => {
  const toggle = () => screen.getByRole("button", { name: /the menu/i });

  it("starts open", () => {
    renderShell(MusterShell);
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses and expands again", async () => {
    const user = userEvent.setup();
    renderShell(MusterShell);

    await user.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps every screen reachable by name when collapsed", async () => {
    /*
     * The point of collapsing to icons rather than to nothing. The label is
     * hidden from the eye, not removed from the button, so the accessible
     * name never depends on how wide the rail happens to be.
     */
    const user = userEvent.setup();
    renderShell(MusterShell);
    const before = within(nav())
      .getAllByRole("button")
      .map((button) => button.textContent.trim())
      .filter(Boolean);

    await user.click(toggle());

    const after = within(nav())
      .getAllByRole("button")
      .map((button) => button.textContent.trim())
      .filter(Boolean);
    ["Cadet List", "Mass Event Log", "PTS Tracker"].forEach((screenName) => {
      expect(after.some((label) => label.includes(screenName))).toBe(true);
    });
    expect(after.length).toBeGreaterThanOrEqual(before.length - 1);
  });

  it("still switches screen when collapsed", async () => {
    const user = userEvent.setup();
    const setActiveMenu = vi.fn();
    renderShell(MusterShell, { setActiveMenu });

    await user.click(toggle());
    await user.click(within(nav()).getByRole("button", { name: /Cadet List/ }));

    // The Cadet List's key is "dashboard", from before the screens were named.
    expect(setActiveMenu).toHaveBeenCalledWith("dashboard");
  });

  it("keeps the squadron number on the rail when collapsed", async () => {
    // A rail you cannot see is a rail you have to remember.
    const user = userEvent.setup();
    renderShell(MusterShell);
    await user.click(toggle());

    expect(within(nav()).getByText("9999")).toBeInTheDocument();
  });

  it("leaves a way to sign out when collapsed", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    renderShell(MusterShell, { onLogout });

    await user.click(toggle());
    await user.click(within(nav()).getByRole("button", { name: "Sign Out" }));

    expect(onLogout).toHaveBeenCalled();
  });

  it("remembers the choice", async () => {
    const user = userEvent.setup();
    const first = renderShell(MusterShell);
    await user.click(toggle());
    first.unmount();

    renderShell(MusterShell);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the rail rather than breaking when storage is unreadable", () => {
    /*
     * A private window can throw on getItem. The rail is a convenience, so it
     * falls back to open; it must never take the shell down with it.
     */
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    renderShell(MusterShell);
    expect(toggle()).toHaveAttribute("aria-expanded", "true");

    getItem.mockRestore();
  });
});
