/**
 * CHARACTERIZATION -- Mass Event Log.
 *
 * One of the three places event points are calculated. Records what this
 * dashboard scores today so Phase 6 has to prove the unified implementation
 * agrees with it, row for row.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import MassEventLog from "./MassEventLog";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { rowsByHeader } from "../../../test/domSnapshot";
import { SQUADRONS, userFor } from "../../../test/dummyData";

const renderDashboard = (squadron = SQUADRONS.FAKETON) =>
  renderWithProviders(<MassEventLog user={userFor(squadron)} />, { squadron });

/** Every rendered row as "Name | Record | Points", sorted for a stable compare. */
const scoreLines = (container) =>
  rowsByHeader(container.querySelector("table"))
    .map((r) => `${r.Name} | ${r.Record} | ${r.Points}`)
    .sort();

describe("event log contents", () => {
  it("renders every event with its description and points", () => {
    const { container } = renderDashboard();
    expect(scoreLines(container)).toMatchSnapshot();
  });

  it("shows one row per event", () => {
    const { container, data } = renderDashboard();
    expect(rowsByHeader(container.querySelector("table"))).toHaveLength(data.events.length);
  });

  it("describes each kind of event", () => {
    const { container } = renderDashboard();
    const rows = rowsByHeader(container.querySelector("table"));
    const recordFor = (name, date) => rows.find((r) => r.Name === name && r.Date === date).Record;

    expect(recordFor("Amelia Hart", "2024-03-12")).toBe("Blue Radio"); // badge: level + category
    expect(recordFor("Amelia Hart", "2024-06-01")).toBe("First Class Cadet"); // exam: name
    expect(recordFor("Amelia Hart", "2025-05-10")).toBe("Wing Athletics"); // event: name
    expect(recordFor("Amelia Hart", "2024-12-15")).toBe("Cadet of the Year"); // special: award
  });
});

describe("points, as this dashboard computes them", () => {
  const pointsFor = (container, name, date) =>
    rowsByHeader(container.querySelector("table")).find((r) => r.Name === name && r.Date === date).Points;

  it("prices badges by level", () => {
    const { container } = renderDashboard();
    expect(pointsFor(container, "Amelia Hart", "2024-03-12")).toBe("5"); // Blue
    expect(pointsFor(container, "Amelia Hart", "2024-11-05")).toBe("10"); // Bronze
    expect(pointsFor(container, "Amelia Hart", "2025-04-18")).toBe("15"); // Silver
    expect(pointsFor(container, "Eve Nakamura", "2025-01-30")).toBe("20"); // Gold
  });

  it("prices every exam the same", () => {
    const { container } = renderDashboard();
    expect(pointsFor(container, "Amelia Hart", "2024-06-01")).toBe("8");
    expect(pointsFor(container, "Eve Nakamura", "2025-03-11")).toBe("8");
  });

  it("prices events by their category", () => {
    const { container } = renderDashboard();
    expect(pointsFor(container, "Ben Okafor", "2025-03-06")).toBe("1"); // Parade Night
    expect(pointsFor(container, "Chloe Ramsey", "2025-04-05")).toBe("3"); // Squadron Event
    expect(pointsFor(container, "Amelia Hart", "2025-05-10")).toBe("5"); // Wing Event
    expect(pointsFor(container, "Grace O'Neill", "2025-02-14")).toBe("8"); // Regional Event
    expect(pointsFor(container, "Eve Nakamura", "2024-07-22")).toBe("12"); // National Event
  });

  it("prices every special award the same", () => {
    const { container } = renderDashboard();
    expect(pointsFor(container, "Amelia Hart", "2024-12-15")).toBe("25");
    expect(pointsFor(container, "Harry Blythe-Jones", "2025-01-20")).toBe("25");
  });

  it("scores an uncategorised event as zero", () => {
    // CHARACTERIZATION: this dispatches on `event.eventName` but then looks up
    // `Event Category Points[event.eventCategory]`, which is "" here, so the
    // lookup misses and falls back to 0. FightPointsDashboard reaches the same
    // 0 by a different route (it dispatches on eventCategory and falls through
    // to its warn branch). Phase 6 must keep this at 0 while unifying the two.
    const { container } = renderDashboard();
    expect(pointsFor(container, "Jack Petrov", "2025-03-29")).toBe("0");
  });

  it("counts all events regardless of year", () => {
    // Unlike Flight Points, this dashboard does no year filtering at all --
    // 2024 and 2025 events are listed together.
    const { container } = renderDashboard();
    const years = new Set(rowsByHeader(container.querySelector("table")).map((r) => r.Date.slice(0, 4)));
    expect([...years].sort()).toEqual(["2024", "2025"]);
  });
});

describe("controls", () => {
  it("offers adding a record", () => {
    renderDashboard();
    expect(screen.getByRole("button", { name: "Add New Record" })).toBeInTheDocument();
  });

  it("finishes loading", () => {
    const { container } = renderDashboard();
    expect(container.querySelector(".loading-popup")).toBeNull();
  });
});

describe("Testwood (legacy flight shape)", () => {
  it("renders its own events", () => {
    const { container } = renderDashboard(SQUADRONS.TESTWOOD);
    expect(scoreLines(container)).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// Write paths
// ---------------------------------------------------------------------------

const eventWrites = (writes) => writes().filter((w) => w.path.includes("/EventLog/"));

/**
 * Open the Add popup and pick cadets via the autocomplete.
 *
 * Every query is scoped to the popup: the event table behind it contains the
 * same cadet names, so unscoped text queries are ambiguous.
 */
const popup = () => within(document.querySelector(".popup-content"));

const openAddPopup = async (result, names) => {
  const { user } = result;
  await user.click(screen.getByRole("button", { name: "Add New Record" }));
  for (const name of names) {
    const input = popup().getByLabelText("Name(s):");
    await user.clear(input);
    await user.type(input, name.slice(0, 4));
    // Suggestions are <li> items inside the popup's autocomplete list.
    const suggestion = (await popup().findAllByText(name)).find((el) => el.tagName === "LI");
    await user.click(suggestion);
  }
};

describe("adding an event", () => {
  it("saves an Event/Other record for one cadet", async () => {
    const result = renderDashboard();
    await openAddPopup(result, ["Isla Muir"]);
    await result.user.type(screen.getByLabelText("Date:"), "2025-06-10");
    await result.user.click(screen.getByRole("button", { name: "Event/Other" }));
    await result.user.type(screen.getByLabelText("Event Description:"), "night hike");
    await result.user.selectOptions(screen.getByLabelText("Event Category:"), "Squadron Event");
    await result.user.click(screen.getByRole("button", { name: "Add Event" }));

    const writes = eventWrites(result.writes);
    expect(writes).toHaveLength(1);
    expect(writes[0].data).toMatchObject({
      cadetName: "Isla Muir",
      date: "2025-06-10",
      eventName: "Night Hike", // capitalised on the way in
      eventCategory: "Squadron Event",
      addedBy: "Admin User",
    });
  });

  it("keeps acronyms upper-case in event descriptions", async () => {
    // AddEventPopup carries an exception list (RAF, DofE, NCO, ...) so
    // "raf museum visit" does not become "Raf Museum Visit".
    const result = renderDashboard();
    await openAddPopup(result, ["Isla Muir"]);
    await result.user.type(screen.getByLabelText("Date:"), "2025-06-10");
    await result.user.click(screen.getByRole("button", { name: "Event/Other" }));
    await result.user.type(screen.getByLabelText("Event Description:"), "raf dofe expedition");
    await result.user.selectOptions(screen.getByLabelText("Event Category:"), "Wing Event");
    await result.user.click(screen.getByRole("button", { name: "Add Event" }));

    expect(eventWrites(result.writes)[0].data.eventName).toBe("RAF DofE Expedition");
  });

  it("saves one document per selected cadet", async () => {
    const result = renderDashboard();
    await openAddPopup(result, ["Isla Muir", "Femi Adeyemi"]);
    await result.user.type(screen.getByLabelText("Date:"), "2025-06-10");
    await result.user.click(screen.getByRole("button", { name: "Event/Other" }));
    await result.user.type(screen.getByLabelText("Event Description:"), "sports day");
    await result.user.selectOptions(screen.getByLabelText("Event Category:"), "Squadron Event");
    await result.user.click(screen.getByRole("button", { name: "Add Event" }));

    expect(eventWrites(result.writes).map((w) => w.data.cadetName)).toEqual([
      "Isla Muir",
      "Femi Adeyemi",
    ]);
  });

  it("saves a badge with its type and level", async () => {
    const result = renderDashboard();
    await openAddPopup(result, ["Isla Muir"]);
    await result.user.type(screen.getByLabelText("Date:"), "2025-06-10");
    await result.user.click(screen.getByRole("button", { name: "Badge" }));
    await result.user.selectOptions(screen.getByLabelText("Badge Type:"), "Radio");
    await result.user.selectOptions(screen.getByLabelText("Badge Level:"), "Blue");
    await result.user.click(screen.getByRole("button", { name: "Add Event" }));

    expect(eventWrites(result.writes)[0].data).toMatchObject({
      cadetName: "Isla Muir",
      badgeCategory: "Radio",
      badgeLevel: "Blue",
      eventName: "",
    });
  });

  it("silently skips a duplicate badge", async () => {
    // Amelia already holds Blue Radio -- useSaveEvent's duplicate detection.
    const result = renderDashboard();
    await openAddPopup(result, ["Amelia Hart"]);
    await result.user.type(screen.getByLabelText("Date:"), "2025-06-10");
    await result.user.click(screen.getByRole("button", { name: "Badge" }));
    await result.user.selectOptions(screen.getByLabelText("Badge Type:"), "Radio");
    await result.user.selectOptions(screen.getByLabelText("Badge Level:"), "Blue");
    await result.user.click(screen.getByRole("button", { name: "Add Event" }));

    expect(eventWrites(result.writes)).toEqual([]);
  });

  it("rejects a date outside the allowed window before saving", async () => {
    // AddEventPopup validates before handleAddEvent ever runs.
    const result = renderDashboard();
    await openAddPopup(result, ["Isla Muir"]);
    await result.user.type(screen.getByLabelText("Date:"), "2010-01-01");
    await result.user.click(screen.getByRole("button", { name: "Event/Other" }));
    await result.user.type(screen.getByLabelText("Event Description:"), "old event");
    await result.user.click(screen.getByRole("button", { name: "Add Event" }));

    expect(eventWrites(result.writes)).toEqual([]);
  });

  it("removes a selected cadet again via the chip's remove button", async () => {
    const result = renderDashboard();
    await openAddPopup(result, ["Isla Muir", "Femi Adeyemi"]);
    const chip = popup().getByText("Isla Muir").closest(".selected-name");
    await result.user.click(within(chip).getByRole("button"));

    const chips = [...document.querySelectorAll(".selected-name")].map((c) =>
      c.textContent.replace("×", "").trim()
    );
    expect(chips).toEqual(["Femi Adeyemi"]);
  });
});

describe("deleting an event", () => {
  it("deletes the document and drops the row", async () => {
    const result = renderDashboard();
    // Click Femi's only event row to open the details popup.
    const row = [...result.container.querySelectorAll("tbody tr")].find((tr) =>
      tr.textContent.includes("Femi Adeyemi")
    );
    await result.user.click(row);
    await screen.findByText("Event Details");
    await result.user.click(screen.getByRole("button", { name: "Remove Event" }));

    expect(result.writes()).toContainEqual({
      op: "delete",
      path: "SquadronDatabases/9999/EventLog/event-9999-21",
      data: undefined,
    });
    expect(
      [...result.container.querySelectorAll("tbody tr")].filter((tr) =>
        tr.textContent.includes("Femi Adeyemi")
      )
    ).toEqual([]);
  });

  it("shows the event's audit trail in the details popup", async () => {
    const result = renderDashboard();
    const row = [...result.container.querySelectorAll("tbody tr")].find((tr) =>
      tr.textContent.includes("Femi Adeyemi")
    );
    await result.user.click(row);
    await screen.findByText("Event Details");

    const popup = document.querySelector(".popup-content");
    expect(popup.textContent).toContain("Added By: Admin User");
    expect(popup.textContent).toContain("Blue Music");
  });
});
