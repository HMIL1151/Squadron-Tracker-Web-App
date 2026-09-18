/**
 * UiToggle and ThemeToggle -- the two header controls that now interact.
 *
 * Tested together because the interesting behaviour is the relationship: the
 * Muster interface has no dark palette, so choosing it has to hide the dark
 * mode button WITHOUT discarding the user's theme preference. Getting that
 * wrong is not a visual nit -- it silently resets a setting the user chose,
 * and they only find out when they switch back.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import UiToggle from "./UiToggle";
import ThemeToggle from "../ThemeToggle/ThemeToggle";
import { UiVersionProvider } from "../../context/UiVersionContext";
import { ThemeProvider } from "../../context/ThemeContext";
import { __seed, __store } from "../../test/fakeFirestore";

const UID = "header-uid";

const renderHeader = ({ uiVersion = "classic", theme = "dark", seed = {} } = {}) => {
  __seed(seed);
  return render(
    <UiVersionProvider uid={UID} initialVersion={uiVersion}>
      <ThemeProvider uid={UID} initialTheme={theme}>
        <UiToggle />
        <ThemeToggle />
      </ThemeProvider>
    </UiVersionProvider>
  );
};

const withSearch = (value) => {
  const original = window.location.search;
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, search: value },
  });
  return () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, search: original },
    });
  };
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-ui");
});

describe("switching interface", () => {
  it("offers the new interface to someone on classic", () => {
    renderHeader({ uiVersion: "classic" });
    expect(screen.getByRole("button", { name: "Try New View" })).toBeInTheDocument();
  });

  it("offers the way back to someone on Muster", () => {
    renderHeader({ uiVersion: "muster" });
    expect(screen.getByRole("button", { name: "Use Classic View" })).toBeInTheDocument();
  });

  it("records the choice against the account", async () => {
    renderHeader({ uiVersion: "classic" });
    await userEvent.click(screen.getByRole("button", { name: "Try New View" }));

    await waitFor(() =>
      expect(__store()[`UserPreferences/${UID}`]).toMatchObject({ uiVersion: "muster" })
    );
  });

  /*
   * With `?ui=` pinned, this button would write a preference that the pin
   * keeps overriding until the page is reloaded without the parameter. A
   * control that appears to do nothing is worse than no control.
   */
  it("is hidden when the URL has pinned the interface for this session", () => {
    const restore = withSearch("?ui=muster");
    try {
      renderHeader({ uiVersion: "muster" });
      expect(screen.queryByRole("button", { name: /view$/ })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });
});

describe("dark mode across the two interfaces", () => {
  it("is offered on classic", () => {
    renderHeader({ uiVersion: "classic" });
    expect(screen.getByRole("button", { name: "Dark mode" })).toBeInTheDocument();
  });

  it("is not offered on Muster, which has no dark palette yet", () => {
    renderHeader({ uiVersion: "muster" });
    expect(screen.queryByRole("button", { name: "Dark mode" })).not.toBeInTheDocument();
  });

  it("paints light on Muster even for a user who chose dark", () => {
    renderHeader({ uiVersion: "muster", theme: "dark" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  /*
   * The regression that matters. Pinning the paint must not rewrite what the
   * user chose, or trying Muster once quietly costs them dark mode.
   */
  it("leaves the stored dark preference untouched", async () => {
    renderHeader({
      uiVersion: "muster",
      theme: "dark",
      seed: { [`UserPreferences/${UID}`]: { theme: "dark" } },
    });

    await waitFor(() => expect(document.documentElement.getAttribute("data-theme")).toBe("light"));
    expect(__store()[`UserPreferences/${UID}`]).toEqual({ theme: "dark" });
  });

  it("honours dark again the moment the user switches back to classic", async () => {
    renderHeader({
      uiVersion: "muster",
      theme: "dark",
      seed: { [`UserPreferences/${UID}`]: { theme: "dark", uiVersion: "muster" } },
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    await userEvent.click(screen.getByRole("button", { name: "Use Classic View" }));

    await waitFor(() =>
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    );
    expect(screen.getByRole("button", { name: "Dark mode" })).toBeInTheDocument();
  });
});
