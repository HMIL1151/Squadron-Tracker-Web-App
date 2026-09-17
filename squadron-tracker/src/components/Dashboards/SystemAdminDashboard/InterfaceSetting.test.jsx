/**
 * The interface kill switch on the System Admin dashboard.
 *
 * This is the control that makes shipping a new interface safe, so the things
 * worth testing are the failure shapes rather than the happy path: a write the
 * rules reject must say so rather than appear to work, and an admin who has
 * their own preference must be told that flipping the default will not change
 * what they personally see -- otherwise they flip it, nothing happens on their
 * screen, and they conclude the kill switch is broken at exactly the moment
 * they need to trust it.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import InterfaceSetting from "./InterfaceSetting";
import { UiVersionProvider } from "../../../context/UiVersionContext";
import { __seed, __store } from "../../../test/fakeFirestore";
import * as db from "../../../firebase/db";

const UID = "system-admin";

const renderSetting = (seed = {}) => {
  __seed(seed);
  return render(
    <UiVersionProvider uid={UID}>
      <InterfaceSetting />
    </UiVersionProvider>
  );
};

const classicOption = () => screen.getByRole("button", { name: /^Classic/ });
const musterOption = () => screen.getByRole("button", { name: /^Muster/ });

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-ui");
});

describe("showing the current default", () => {
  it("treats never-been-set as classic, because that is what everyone is getting", async () => {
    renderSetting();
    await waitFor(() => expect(classicOption()).toHaveAttribute("aria-pressed", "true"));
    expect(musterOption()).toHaveAttribute("aria-pressed", "false");
  });

  it("marks whichever interface a system admin last chose", async () => {
    renderSetting({ "SystemConfig/ui": { defaultVersion: "muster" } });
    await waitFor(() => expect(musterOption()).toHaveAttribute("aria-pressed", "true"));
  });

  it("says that Muster has no dark mode yet, since that is the visible cost", () => {
    renderSetting();
    expect(screen.getByText(/dark mode button is hidden/i)).toBeInTheDocument();
  });
});

describe("changing the default", () => {
  it("writes the new default and confirms it", async () => {
    renderSetting();
    await waitFor(() => expect(classicOption()).toHaveAttribute("aria-pressed", "true"));

    await userEvent.click(musterOption());

    await waitFor(() =>
      expect(__store()["SystemConfig/ui"]).toMatchObject({ defaultVersion: "muster" })
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/now gets Muster/i);
  });

  it("does nothing when the current default is pressed again", async () => {
    renderSetting({ "SystemConfig/ui": { defaultVersion: "muster" } });
    await waitFor(() => expect(musterOption()).toHaveAttribute("aria-pressed", "true"));

    await userEvent.click(musterOption());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  /*
   * The rules refuse this write for anyone who is not a system admin. Somebody
   * whose rights were revoked mid-session must not see a success message for a
   * change that did not happen.
   */
  it("reports a rejected write instead of claiming success", async () => {
    const spy = jest.spyOn(db, "setDoc").mockRejectedValue(new Error("permission-denied"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      renderSetting();
      await waitFor(() => expect(classicOption()).toHaveAttribute("aria-pressed", "true"));

      await userEvent.click(musterOption());

      expect(await screen.findByRole("status")).toHaveTextContent(/did not save/i);
      expect(classicOption()).toHaveAttribute("aria-pressed", "true");
    } finally {
      spy.mockRestore();
      warn.mockRestore();
    }
  });
});

describe("when the admin has their own preference", () => {
  it("warns that changing the default will not change their own view", async () => {
    renderSetting({ [`UserPreferences/${UID}`]: { uiVersion: "classic" } });

    expect(
      await screen.findByText(/will not change what you see/i)
    ).toBeInTheDocument();
  });

  it("stays quiet when they are following the default like everyone else", async () => {
    renderSetting();
    await waitFor(() => expect(classicOption()).toHaveAttribute("aria-pressed", "true"));
    expect(screen.queryByText(/will not change what you see/i)).not.toBeInTheDocument();
  });
});
