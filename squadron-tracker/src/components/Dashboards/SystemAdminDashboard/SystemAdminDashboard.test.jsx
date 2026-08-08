/**
 * CHARACTERIZATION -- System Admin Dashboard (new squadron requests).
 *
 * Phase 9 changes this: NewAccountRequests currently carries three flat
 * flight1Name/flight2Name/flight3Name fields, and this dashboard renders exactly
 * three of them. Both become a `flights` array. The three-flight assumption is
 * recorded here so that change is visible.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import SystemAdminDashboard from "./SystemAdminDashboard";
import { renderWithProviders } from "../../../test/renderWithProviders";

const renderDashboard = async () => {
  const result = renderWithProviders(<SystemAdminDashboard />);
  await screen.findByRole("heading", { name: "System Admin Dashboard" });
  return result;
};

describe("pending new-squadron requests", () => {
  it("renders the request card", async () => {
    const { container } = await renderDashboard();
    await screen.findByText(/Newtown/);
    expect(container.querySelector(".request-card").textContent).toMatchSnapshot();
  });

  it("renders however many flights the request asked for", async () => {
    // Phase 9: was hardcoded to exactly three. The dummy request still uses
    // the legacy flat flight1Name..3Name fields, which are still understood.
    await renderDashboard();
    expect(await screen.findByText("Staff flight:")).toBeInTheDocument();
    expect(screen.getByText("Flight 1:")).toBeInTheDocument();
    expect(screen.getByText("Flight 2:")).toBeInTheDocument();
    expect(screen.queryByText("Flight 3:")).toBeNull();
  });

  it("renders a request carrying a flights array of any length", async () => {
    const { __seed, __store } = require("../../../test/fakeFirestore");
    const { dummyData } = require("../../../test/dummyData");
    __seed(dummyData);
    const docs = __store();
    docs["NewAccountRequests/nar-01"].flights = ["Staff", "Alpha", "Bravo", "Charlie", "Delta"];
    __seed(docs);

    renderWithProviders(<SystemAdminDashboard />, { seedFirestore: false });
    await screen.findByRole("heading", { name: "System Admin Dashboard" });
    await screen.findByText(/Newtown/);

    expect(screen.getByText("Staff flight:")).toBeInTheDocument();
    expect(screen.getByText("Flight 4:")).toBeInTheDocument();
    expect(screen.getByText("Delta")).toBeInTheDocument();
  });

  it("offers approve and deny", async () => {
    const { container } = await renderDashboard();
    await screen.findByText(/Newtown/);
    const card = within(container.querySelector(".request-card"));
    expect(card.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Deny" })).toBeInTheDocument();
  });
});

describe("approving a request", () => {
  it("creates the squadron, its admin, and copies the FlightPoints template", async () => {
    const { user, writes } = await renderDashboard();
    await screen.findByText(/Newtown/);
    await user.click(screen.getByRole("button", { name: "Approve" }));

    const paths = writes().map((w) => `${w.op} ${w.path}`);
    expect(paths).toMatchSnapshot();
  });

  it("writes flights as a three-element array built from the flat fields", async () => {
    const { user, store } = await renderDashboard();
    await screen.findByText(/Newtown/);
    await user.click(screen.getByRole("button", { name: "Approve" }));

    const created = Object.entries(store()).find(
      ([path, doc]) => path.startsWith("SquadronList/") && doc.Number === 9997
    );
    expect(created[1].flights).toEqual(["Staff Team", "Vulcan", "Lightning"]);
  });

  it("keys the creator's MassUserList mapping by uid", async () => {
    // Phase 4 fixed this for AdminDashboard's grant flow but not here, where
    // squadron creation still minted an auto-id. Phase 8 moved both onto the
    // same createSquadron/grantAccess helpers, so they now agree -- which
    // matters because revoking access only deletes the uid-keyed document.
    const { user, store } = await renderDashboard();
    await screen.findByText(/Newtown/);
    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(store()["MassUserList/uid-hopeful"]).toEqual({ UID: "uid-hopeful", Squadron: 9997 });
    expect(Object.keys(store()).filter((p) => p.startsWith("MassUserList/auto"))).toEqual([]);
  });

  it("keys the creator's AuthorisedUsers document by uid", async () => {
    // The security rules check membership at AuthorisedUsers/{uid}.
    const { user, store } = await renderDashboard();
    await screen.findByText(/Newtown/);
    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(store()["SquadronDatabases/9997/AuthorisedUsers/uid-hopeful"]).toMatchObject({
      role: "admin",
    });
  });

  it("removes the request once approved", async () => {
    const { user, store } = await renderDashboard();
    await screen.findByText(/Newtown/);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(store()["NewAccountRequests/nar-01"]).toBeUndefined();
  });
});

describe("denying a request", () => {
  it("deletes the request and writes nothing else", async () => {
    const { user, writes } = await renderDashboard();
    await screen.findByText(/Newtown/);
    await user.click(screen.getByRole("button", { name: "Deny" }));

    expect(writes().map((w) => `${w.op} ${w.path}`)).toEqual([
      "delete NewAccountRequests/nar-01",
    ]);
  });

  it("says so when there is nothing to review", async () => {
    const { user } = await renderDashboard();
    await screen.findByText(/Newtown/);
    await user.click(screen.getByRole("button", { name: "Deny" }));
    expect(await screen.findByText("No new account requests to review.")).toBeInTheDocument();
  });
});
