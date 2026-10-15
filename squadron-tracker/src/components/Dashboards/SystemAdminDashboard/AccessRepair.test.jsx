/**
 * The locked-out users panel. The repair logic itself is covered in
 * src/firebase/accessRepair.test.js; this pins what the system admin sees and
 * that nothing is written before they press Repair.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import AccessRepair from "./AccessRepair";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { UIDS } from "../../../test/dummyData";

const renderPanel = () => renderWithProviders(<AccessRepair />);

it("reads nothing until asked", () => {
  const { writes } = renderPanel();
  expect(screen.getByRole("button", { name: "Check all squadrons" })).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Records to repair" })).toBeNull();
  expect(writes()).toEqual([]);
});

it("lists what it found, and writes nothing until Repair is pressed", async () => {
  const { user, writes } = renderPanel();
  await user.click(screen.getByRole("button", { name: "Check all squadrons" }));

  const list = await screen.findByRole("list", { name: "Records to repair" });
  const item = within(list).getByRole("listitem");
  expect(item).toHaveTextContent("Locked Out");
  expect(item).toHaveTextContent("locked@testwood.test");
  expect(item).toHaveTextContent("9998 Testwood");
  expect(item).toHaveTextContent("Restore access");
  expect(writes()).toEqual([]);
});

it("repairs, reports, and finds nothing on a second check", async () => {
  const { user, store } = renderPanel();
  await user.click(screen.getByRole("button", { name: "Check all squadrons" }));
  await user.click(await screen.findByRole("button", { name: "Repair 1 record" }));

  expect(await screen.findByText(/Repaired 1 record\./)).toBeInTheDocument();
  expect(store()[`SquadronDatabases/9998/AuthorisedUsers/${UIDS.testwoodLocked}`]).toBeDefined();

  await user.click(screen.getByRole("button", { name: "Check again" }));
  expect(await screen.findByText("No locked-out users found.")).toBeInTheDocument();
});
