/**
 * The Weapons list on the Muster Record Categories screen.
 *
 * The case worth pinning is the first weapon a squadron ever adds. No
 * squadron has a FlightPoints/Weapons document until then, and the other
 * lists write through updateDoc -- which real Firestore, and the fake,
 * reject on a missing document. A version that reused setPrice worked on
 * every fixture that happened to have the document and failed on every real
 * squadron.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import MusterRecordCategories from "./MusterRecordCategories";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { SQUADRONS } from "../../../test/dummyData";

const WEAPONS_PATH = "SquadronDatabases/9999/FlightPoints/Weapons";

const weaponsSection = () =>
  within(screen.getByRole("heading", { name: "Weapons" }).closest("section"));

const addWeapon = async (user, name, months) => {
  await user.click(weaponsSection().getByRole("button", { name: "Add" }));
  const dialog = within(screen.getByRole("dialog"));
  await user.type(dialog.getByLabelText("Weapon"), name);
  await user.type(dialog.getByLabelText("Valid for (months)"), String(months));
  await user.click(dialog.getByRole("button", { name: "Save" }));
};

describe("the Weapons list", () => {
  it("creates the document with the first weapon added", async () => {
    const { user, store } = renderWithProviders(<MusterRecordCategories />, {
      squadron: SQUADRONS.FAKETON,
      uiVersion: "muster",
    });
    expect(store()[WEAPONS_PATH]).toBeUndefined();

    await addWeapon(user, "L98A2 Cadet G.P. Rifle", 12);

    /*
     * The spaces matter too: MusterDialog used to move focus to its Close
     * button after the first keystroke, and a space then closed the dialog.
     * A dot in the name stays a name, not a path into a nested field.
     */
    expect(store()[WEAPONS_PATH]).toEqual({ "L98A2 Cadet G.P. Rifle": 12 });
    expect(weaponsSection().getByText("L98A2 Cadet G.P. Rifle")).toBeInTheDocument();
  });

  it("refuses a validity that is not a whole number of months", async () => {
    const { user, store } = renderWithProviders(<MusterRecordCategories />, {
      squadron: SQUADRONS.FAKETON,
      uiVersion: "muster",
    });
    await addWeapon(user, "Rifle", 0);
    expect(screen.getByText(/whole number/)).toBeInTheDocument();
    expect(store()[WEAPONS_PATH]).toBeUndefined();
  });

  it("removes a weapon and keeps the rest", async () => {
    const { user, store } = renderWithProviders(<MusterRecordCategories />, {
      squadron: SQUADRONS.FAKETON,
      uiVersion: "muster",
    });
    await addWeapon(user, "Rifle", 12);
    await addWeapon(user, "Pistol", 6);

    const row = weaponsSection().getByText("Rifle").closest("tr");
    await user.click(within(row).getByRole("button", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    expect(store()[WEAPONS_PATH]).toEqual({ Pistol: 6 });
  });
});
