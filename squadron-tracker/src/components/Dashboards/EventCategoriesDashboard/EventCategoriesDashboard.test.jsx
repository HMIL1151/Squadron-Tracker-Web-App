/**
 * CHARACTERIZATION -- Record Categories.
 *
 * This is where the points values every other dashboard reads are configured, so
 * what it shows and what it writes both matter to Phase 6.
 *
 * Four tabs, one table visible at a time -- so each tab has to be opened before
 * its contents can be asserted.
 */

import React from "react";
import { screen, waitFor, within } from "@testing-library/react";

import EventCategoriesDashboard from "./EventCategoriesDashboard";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { tableToRows } from "../../../test/domSnapshot";
import { SQUADRONS } from "../../../test/dummyData";

const renderDashboard = (squadron = SQUADRONS.FAKETON) =>
  renderWithProviders(<EventCategoriesDashboard />, { squadron });

const TABS = ["Record Categories", "Badges", "Badge Points", "Special Awards"];

const openTab = async (result, name) => {
  const menu = within(result.container.querySelector(".horizontal-menu"));
  await result.user.click(menu.getByRole("button", { name }));
  return tableToRows(result.container.querySelector("table"));
};

describe("tabs", () => {
  it("offers all four", () => {
    const { container } = renderDashboard();
    const menu = within(container.querySelector(".horizontal-menu"));
    TABS.forEach((name) => expect(menu.getByRole("button", { name })).toBeInTheDocument());
  });

  it("opens on Record Categories", () => {
    const { container } = renderDashboard();
    const menu = within(container.querySelector(".horizontal-menu"));
    expect(menu.getByRole("button", { name: "Record Categories" })).toHaveClass("active");
  });

  it("shows one table at a time", () => {
    const { container } = renderDashboard();
    expect(container.querySelectorAll("table")).toHaveLength(1);
  });
});

describe("configured values", () => {
  it("records what every tab contains", async () => {
    const result = renderDashboard();
    const byTab = {};
    for (const name of TABS) {
      byTab[name] = await openTab(result, name);
    }
    expect(byTab).toMatchSnapshot();
  });

  it("lists event categories with their points", async () => {
    const result = renderDashboard();
    const { rows } = await openTab(result, "Record Categories");
    expect(Object.fromEntries(rows)).toEqual({
      "Parade Night": "1",
      "Squadron Event": "3",
      "Wing Event": "5",
      "Regional Event": "8",
      "National Event": "12",
    });
  });

  it("lists badge types", async () => {
    const result = renderDashboard();
    const { rows } = await openTab(result, "Badges");
    expect(rows.flat()).toEqual([
      "Radio", "First Aid", "Shooting", "Adventure Training", "Sports", "Music",
    ]);
  });

  it("lists special awards", async () => {
    const result = renderDashboard();
    const { rows } = await openTab(result, "Special Awards");
    expect(rows.flat()).toEqual([
      "Cadet of the Year", "Most Improved Cadet", "Commandant's Commendation",
    ]);
  });
});

describe("the prices other dashboards score with", () => {
  it("matches what Mass Event Log and Flight Points use", async () => {
    // If these ever drift from the points characterization tests, one of the
    // two is wrong -- this is the shared source of truth for both.
    const result = renderDashboard();
    const { rows } = await openTab(result, "Badge Points");
    expect(Object.fromEntries(rows)).toEqual({
      "Blue Badge": "5",
      "Bronze Badge": "10",
      "Silver Badge": "15",
      "Gold Badge": "20",
      Exam: "8",
      Special: "25",
    });
  });
});

describe("controls", () => {
  it("offers add and delete on each tab", async () => {
    const result = renderDashboard();
    for (const name of TABS) {
      const menu = within(result.container.querySelector(".horizontal-menu"));
      await result.user.click(menu.getByRole("button", { name }));
      const actions = within(result.container.querySelector(".button-container"));
      expect(actions.getByRole("button", { name: /^Add/ })).toBeInTheDocument();
      expect(actions.getByRole("button", { name: /^Delete/ })).toBeInTheDocument();
    }
  });
});

describe("Testwood", () => {
  it("renders the same configuration", async () => {
    const result = renderDashboard(SQUADRONS.TESTWOOD);
    const { rows } = await openTab(result, "Badge Points");
    expect(Object.fromEntries(rows)).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// Write paths
// ---------------------------------------------------------------------------

const FLIGHT_POINTS = "SquadronDatabases/9999/FlightPoints";

describe("adding a category", () => {
  it("writes the category with integer points and shows it", async () => {
    const result = renderDashboard();
    await result.user.click(screen.getByRole("button", { name: "Add New Category" }));
    await result.user.type(screen.getByLabelText("Category Name:"), "Camp");
    await result.user.type(screen.getByLabelText("Points:"), "6");
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(result.writes()).toContainEqual({
      op: "update",
      path: `${FLIGHT_POINTS}/Event Category Points`,
      data: { Camp: 6 },
    });

    // waitFor, not a bare assertion: the write lands synchronously against the
    // fake, but the table only updates once the DataContext state change has
    // flushed. Asserting immediately passed on an idle machine and failed
    // under parallel-suite load -- a flake worth not reintroducing.
    await waitFor(() => {
      expect(tableToRows(result.container.querySelector("table")).rows).toContainEqual(["Camp", "6"]);
    });
  });

  it("writes nothing when a field is blank", async () => {
    const result = renderDashboard();
    await result.user.click(screen.getByRole("button", { name: "Add New Category" }));
    await result.user.type(screen.getByLabelText("Category Name:"), "Camp");
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(result.writes()).toEqual([]);
  });
});

describe("adding a badge type", () => {
  it("appends to the Badge Types array via arrayUnion", async () => {
    const result = renderDashboard();
    await openTab(result, "Badges");
    await result.user.click(screen.getByRole("button", { name: "Add New Badge" }));
    await result.user.type(screen.getByLabelText("New Entry:"), "Cyber");
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(result.store()[`${FLIGHT_POINTS}/Badges`]["Badge Types"]).toEqual([
      "Radio", "First Aid", "Shooting", "Adventure Training", "Sports", "Music", "Cyber",
    ]);
  });
});

describe("adding a badge price", () => {
  it("writes the price onto the Badge Points document", async () => {
    // CHARACTERIZATION: the button on the Badge Points tab is labelled
    // "Add Badge Type", the same wording as the unrelated action on the Badges
    // tab. Mislabelled, but recorded as-is.
    const result = renderDashboard();
    await openTab(result, "Badge Points");
    await result.user.click(screen.getByRole("button", { name: "Add Badge Type" }));
    await result.user.type(screen.getByLabelText("Badge Type:"), "Platinum Badge");
    await result.user.type(screen.getByLabelText("Points:"), "30");
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(result.store()[`${FLIGHT_POINTS}/Badge Points`]).toMatchObject({
      "Platinum Badge": 30,
      "Gold Badge": 20, // existing prices untouched
    });
  });
});

describe("deleting", () => {
  // .add-entry-popup was this dialog's own wrapper; it is a Modal now, so its
  // content carries the shared .popup-content like every other dialog.
  const popup = () => within(document.querySelector(".popup-content"));

  it("removes a category's field with deleteField", async () => {
    // The call site that exposed the fake's missing deleteField.
    const result = renderDashboard();
    await result.user.click(screen.getByRole("button", { name: "Delete Category" }));
    await result.user.selectOptions(popup().getByRole("combobox"), "Wing Event");
    await result.user.click(popup().getByRole("button", { name: "Delete" }));

    const stored = result.store()[`${FLIGHT_POINTS}/Event Category Points`];
    expect(stored["Wing Event"]).toBeUndefined();
    expect(stored["Parade Night"]).toBe(1);
    // And the table drops the row.
    const { rows } = { rows: tableToRows(result.container.querySelector("table")).rows };
    expect(rows.map(([name]) => name)).not.toContain("Wing Event");
  });

  it("removes a badge type from the array", async () => {
    const result = renderDashboard();
    await openTab(result, "Badges");
    await result.user.click(screen.getByRole("button", { name: "Delete Badge" }));
    await result.user.selectOptions(popup().getByRole("combobox"), "Music");
    await result.user.click(popup().getByRole("button", { name: "Delete" }));

    expect(result.store()[`${FLIGHT_POINTS}/Badges`]["Badge Types"]).toEqual([
      "Radio", "First Aid", "Shooting", "Adventure Training", "Sports",
    ]);
  });

  it("removes a special award from its array", async () => {
    const result = renderDashboard();
    await openTab(result, "Special Awards");
    await result.user.click(screen.getByRole("button", { name: "Delete Special Award" }));
    await result.user.selectOptions(popup().getByRole("combobox"), "Most Improved Cadet");
    await result.user.click(popup().getByRole("button", { name: "Delete" }));

    expect(result.store()[`${FLIGHT_POINTS}/Special Awards`]["Special Awards"]).toEqual([
      "Cadet of the Year", "Commandant's Commendation",
    ]);
  });

  it("deleting a category does not retroactively re-score its events", async () => {
    // CHARACTERIZATION: events store only the category NAME. Deleting the
    // category leaves those events pointing at a name with no price, so they
    // score 0 from then on -- history changes silently. Worth knowing.
    const result = renderDashboard();
    await result.user.click(screen.getByRole("button", { name: "Delete Category" }));
    await result.user.selectOptions(popup().getByRole("combobox"), "Wing Event");
    await result.user.click(popup().getByRole("button", { name: "Delete" }));

    expect(result.store()["SquadronDatabases/9999/EventLog/event-9999-06"]).toMatchObject({
      eventCategory: "Wing Event", // the event still names it
    });
  });
});

describe("editing", () => {
  const editPopup = () => within(document.querySelector(".popup-content"));

  it("renames a category, moving its points to the new key", async () => {
    const result = renderDashboard();
    // Click the "Wing Event" row to open the edit popup.
    const row = [...result.container.querySelectorAll("tbody tr")].find((tr) =>
      tr.textContent.includes("Wing Event")
    );
    await result.user.click(row);
    await screen.findByText("Edit Event Category");

    const nameInput = editPopup().getByLabelText("Name:");
    await result.user.clear(nameInput);
    await result.user.type(nameInput, "Wing Activity");
    await result.user.click(editPopup().getByRole("button", { name: "Confirm" }));

    const stored = result.store()[`${FLIGHT_POINTS}/Event Category Points`];
    expect(stored["Wing Event"]).toBeUndefined();
    expect(stored["Wing Activity"]).toBe(5);
  });
});
