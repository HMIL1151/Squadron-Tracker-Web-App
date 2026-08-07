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

// Accepts a squadron number or a renderWithProviders options object.
const renderDashboard = async (arg = {}) => {
  const options = typeof arg === "number" ? { squadron: arg } : arg;
  const result = renderWithProviders(<AdminDashboard />, {
    squadron: SQUADRONS.FAKETON,
    ...options,
  });
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
      "set SquadronDatabases/9999/AuthorisedUsers/uid-pending",
      "set MassUserList/uid-pending",
    ]);
  });

  it("keys AuthorisedUsers by the user's uid", async () => {
    // Was a tagged bug (keyed by request id) until Phase 4: the security rules
    // check membership at AuthorisedUsers/{uid}, so a request-id key would
    // leave the granted user locked out.
    const { user, container, store } = await openCard("Pending Person");
    await user.click(modal(container).getByRole("button", { name: "Granted" }));
    await user.click(modal(container).getByRole("button", { name: "Confirm" }));

    expect(store()["SquadronDatabases/9999/AuthorisedUsers/uid-pending"]).toMatchObject({
      displayName: "Pending Person",
      role: "user",
    });
    expect(store()["SquadronDatabases/9999/AuthorisedUsers/req-9999-pending"]).toBeUndefined();
  });

  it("re-granting overwrites the MassUserList row instead of duplicating it", async () => {
    // Was a tagged bug (auto-id per grant) until Phase 4.
    const { user, container, store } = await openCard("Pending Person");
    await user.click(modal(container).getByRole("button", { name: "Granted" }));
    await user.click(modal(container).getByRole("button", { name: "Confirm" }));

    expect(store()["MassUserList/uid-pending"]).toEqual({ UID: "uid-pending", Squadron: 9999 });
    // No auto-id row was minted alongside it.
    expect(Object.keys(store()).filter((p) => p.startsWith("MassUserList/auto"))).toEqual([]);
  });

  it("refuses to act on a request that carries no uid", async () => {
    // A legacy request document might predate the uid field; acting on it
    // would write membership documents keyed "undefined".
    const { __seed, __store } = require("../../../test/fakeFirestore");
    const { dummyData } = require("../../../test/dummyData");
    __seed(dummyData);
    const docs = __store();
    delete docs["SquadronDatabases/9999/UserRequests/req-9999-pending"].uid;
    __seed(docs);

    const { user, container, writes } = await renderDashboard({ seedFirestore: false });
    await user.click(screen.getByRole("heading", { name: "Pending Person" }));
    await user.click(modal(container).getByRole("button", { name: "Granted" }));
    await user.click(modal(container).getByRole("button", { name: "Confirm" }));

    expect(writes()).toEqual([]);
  });
});

describe("revoking a granted request", () => {
  it("removes both the authorised user and the MassUserList mapping", async () => {
    // Was a tagged bug until Phase 4: the mapping survived, so a revoked user
    // still resolved to this squadron at their next login. Both documents are
    // uid-keyed now, so revoke removes membership and login mapping together.
    const result = await renderDashboard();
    const { user, container, writes } = result;

    await user.click(tab(container, "Granted"));
    await user.click(screen.getByRole("heading", { name: "Plain User" }));
    await user.click(modal(container).getByRole("button", { name: "Denied" }));
    await user.click(modal(container).getByRole("button", { name: "Confirm" }));

    const paths = writes().map((w) => `${w.op} ${w.path}`);
    expect(paths).toContain("delete SquadronDatabases/9999/AuthorisedUsers/uid-faketon-user");
    expect(paths).toContain("delete MassUserList/uid-faketon-user");
  });

  it("cannot reach legacy auto-id MassUserList rows", async () => {
    // KNOWN GAP, deliberate: rows created before the uid-keying fix have
    // auto-ids, and the uid-keyed delete does not touch them. Existing rows
    // need the one-time migration (see the Phase 4 commit); admins can also
    // delete them from the console. This test documents the boundary.
    const result = await renderDashboard();
    const { user, container, store } = result;

    await user.click(tab(container, "Granted"));
    await user.click(screen.getByRole("heading", { name: "Plain User" }));
    await user.click(modal(container).getByRole("button", { name: "Denied" }));
    await user.click(modal(container).getByRole("button", { name: "Confirm" }));

    // The dummy data's legacy-keyed row for this user survives.
    expect(store()["MassUserList/mul-02"]).toMatchObject({ UID: "uid-faketon-user" });
  });
});
