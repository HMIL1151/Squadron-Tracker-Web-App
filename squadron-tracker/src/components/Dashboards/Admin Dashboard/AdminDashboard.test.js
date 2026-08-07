/**
 * CHARACTERIZATION -- Admin Dashboard (squadron access requests).
 *
 * Reads UserRequests straight from Firestore rather than DataContext, so these
 * exercise the fake end to end.
 *
 * Phase 4 fixes a real defect here: granting a request appends a *new*
 * MassUserList document every time with no de-duplication, and revoking never
 * removes it. That behaviour is recorded below as it currently stands, tagged so
 * the fix is a deliberate change rather than a surprise.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import AdminDashboard from "./AdminDashboard";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { SQUADRONS } from "../../../test/dummyData";

const renderDashboard = async (squadron = SQUADRONS.FAKETON) => {
  const result = renderWithProviders(<AdminDashboard />, { squadron });
  // Requests are fetched asynchronously; "Loading requests..." shows until then.
  await screen.findByText("Access Requests");
  return result;
};

const cardNames = () =>
  screen.queryAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("request tabs", () => {
  it("opens on the pending tab", async () => {
    await renderDashboard();
    expect(screen.getByRole("button", { name: "Pending" })).toHaveClass("active-tab");
  });

  it("shows only pending requests initially", async () => {
    await renderDashboard();
    expect(cardNames()).toEqual(["Pending Person"]);
  });

  it("switches to granted", async () => {
    const { user } = await renderDashboard();
    await user.click(screen.getByRole("button", { name: "Granted" }));
    expect(cardNames()).toEqual(["Plain User"]);
  });

  it("switches to denied", async () => {
    const { user } = await renderDashboard();
    await user.click(screen.getByRole("button", { name: "Denied" }));
    expect(cardNames()).toEqual(["Denied Person"]);
  });

  it("says so when a tab is empty", async () => {
    const { user } = await renderDashboard(SQUADRONS.TESTWOOD);
    await user.click(screen.getByRole("button", { name: "Denied" }));
    expect(screen.getByText("No Denied requests found.")).toBeInTheDocument();
  });
});

describe("request cards", () => {
  it("renders a request with its details", async () => {
    const { container } = await renderDashboard();
    expect(container.querySelector(".request-card").textContent).toMatchSnapshot();
  });

  it("formats the timestamp against the local (pinned UTC) clock", async () => {
    await renderDashboard();
    expect(screen.getByText(/2025-06-12 11:30:00/)).toBeInTheDocument();
  });
});

// The tab bar and the status modal both contain Granted/Denied/Pending buttons,
// so every query has to say which one it means.
const tab = (container, name) =>
  within(container.querySelector(".tabs")).getByRole("button", { name });
const modal = (container) => within(container.querySelector(".modal"));

describe("granting a request", () => {
  const openCard = async (name, { squadron, tabName } = {}) => {
    const result = await renderDashboard(squadron);
    if (tabName) await result.user.click(tab(result.container, tabName));
    await result.user.click(screen.getByRole("heading", { name }));
    return result;
  };

  it("opens a status dialog", async () => {
    await openCard("Pending Person");
    expect(screen.getByText("Change Status for Pending Person")).toBeInTheDocument();
  });

  it("offers a role choice only when granting", async () => {
    const { user, container } = await openCard("Pending Person");
    expect(screen.queryByRole("combobox")).toBeNull();
    await user.click(modal(container).getByRole("button", { name: "Granted" }));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("defaults the new role to user", async () => {
    const { user, container } = await openCard("Pending Person");
    await user.click(modal(container).getByRole("button", { name: "Granted" }));
    expect(screen.getByRole("combobox")).toHaveValue("user");
  });

  it("writes the request, the authorised user, and a MassUserList entry", async () => {
    const { user, container, writes } = await openCard("Pending Person");
    await user.click(modal(container).getByRole("button", { name: "Granted" }));
    await user.click(modal(container).getByRole("button", { name: "Confirm" }));

    expect(writes().map((w) => `${w.op} ${w.path}`)).toEqual([
      "update SquadronDatabases/9999/UserRequests/req-9999-pending",
      "set SquadronDatabases/9999/AuthorisedUsers/req-9999-pending",
      "set MassUserList/auto-1",
    ]);
  });

  it("keys AuthorisedUsers by the request id, not the user's uid", async () => {
    // CHARACTERIZATION OF A BUG, fixed in Phase 4. The rules and the rest of the
    // app expect AuthorisedUsers to be keyed by uid; keying it by request id
    // means those lookups miss. Recorded so the fix reads as deliberate.
    const { user, container, store } = await openCard("Pending Person");
    await user.click(modal(container).getByRole("button", { name: "Granted" }));
    await user.click(modal(container).getByRole("button", { name: "Confirm" }));

    expect(store()["SquadronDatabases/9999/AuthorisedUsers/req-9999-pending"]).toMatchObject({
      displayName: "Pending Person",
      role: "user",
    });
    expect(store()["SquadronDatabases/9999/AuthorisedUsers/uid-pending"]).toBeUndefined();
  });

  it("appends a new MassUserList document rather than reusing one", async () => {
    // CHARACTERIZATION OF A BUG, fixed in Phase 4. doc(collection(...)) mints a
    // fresh id every time, so granting the same person twice leaves two rows.
    const { user, container, store } = await openCard("Pending Person");
    await user.click(modal(container).getByRole("button", { name: "Granted" }));
    await user.click(modal(container).getByRole("button", { name: "Confirm" }));

    expect(store()["MassUserList/auto-1"]).toEqual({ UID: "uid-pending", Squadron: 9999 });
  });
});

describe("revoking a granted request", () => {
  it("removes the authorised user but leaves MassUserList untouched", async () => {
    // CHARACTERIZATION OF A BUG, fixed in Phase 4. The revoked user keeps their
    // squadron mapping, so checkUserRole still resolves them to this squadron on
    // their next login.
    const result = await renderDashboard();
    const { user, container, writes } = result;

    await user.click(tab(container, "Granted"));
    await user.click(screen.getByRole("heading", { name: "Plain User" }));
    await user.click(modal(container).getByRole("button", { name: "Denied" }));
    await user.click(modal(container).getByRole("button", { name: "Confirm" }));

    const paths = writes().map((w) => `${w.op} ${w.path}`);
    expect(paths).toContain("delete SquadronDatabases/9999/AuthorisedUsers/req-9999-granted");
    expect(paths.filter((p) => p.includes("MassUserList"))).toEqual([]);
  });
});
