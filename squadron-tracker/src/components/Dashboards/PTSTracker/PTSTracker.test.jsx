/**
 * CHARACTERIZATION -- PTS Tracker.
 *
 * A badge matrix: cadets down the side, badge type/level across the top, with
 * the award date in the cell. Reads only from DataContext, so it is a pure
 * render of the seeded data.
 *
 * The header is two rows -- a badge-type row using colSpan, then a level row --
 * so column labels have to be reconstructed from both to line up with cells.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import PTSTracker from "./PTSTracker";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { SQUADRONS, userFor } from "../../../test/dummyData";

const renderTracker = (squadron = SQUADRONS.FAKETON) =>
  renderWithProviders(<PTSTracker user={userFor(squadron)} />, { squadron });

const text = (el) => el.textContent.replace(/\s+/g, " ").trim();

/** Flat column labels ("Blue Radio", ...) rebuilt from the two header rows. */
const columnLabels = (table) => {
  const [typeRow, levelRow] = table.querySelectorAll("thead tr");
  // Skip the rowSpan=2 "Cadet Name" cell.
  const types = [...typeRow.querySelectorAll("th")].slice(1);
  const levels = [...levelRow.querySelectorAll("th")].map(text);

  const labels = [];
  let cursor = 0;
  types.forEach((th) => {
    const span = Number(th.getAttribute("colspan") || 1);
    for (let i = 0; i < span; i += 1) labels.push(`${levels[cursor + i]} ${text(th)}`);
    cursor += span;
  });
  return labels;
};

/** { cadetName: { "Blue Radio": "2024-03-12", ... } } for held badges only. */
const badgesByCadet = (container) => {
  const table = container.querySelector("table");
  const labels = columnLabels(table);
  const out = {};

  [...table.querySelectorAll("tbody tr")].forEach((tr) => {
    const cells = [...tr.querySelectorAll("td")];
    const name = text(cells[0]);
    if (!name || name === "Total") return; // totals row handled separately
    const held = {};
    cells.slice(1).forEach((td, i) => {
      if (text(td)) held[labels[i]] = text(td);
    });
    out[name] = held;
  });
  return out;
};

const totalsRow = (container) => {
  const table = container.querySelector("table");
  const labels = columnLabels(table);
  const row = [...table.querySelectorAll("tbody tr")].find((tr) => text(tr.querySelector("td")) === "Total");
  const counts = [...row.querySelectorAll("td")].slice(1).map(text);
  return Object.fromEntries(labels.map((l, i) => [l, counts[i]]).filter(([, c]) => c !== "0"));
};

describe("badge matrix", () => {
  it("renders one row per cadet plus a totals row", () => {
    const { container, data } = renderTracker();
    const names = [...container.querySelectorAll("tbody tr td:first-child")].map(text);
    expect(names).toHaveLength(data.cadets.length + 1);
    expect(names[names.length - 1]).toBe("Total");
  });

  it("records which badges each cadet holds, and when", () => {
    const { container } = renderTracker();
    expect(badgesByCadet(container)).toMatchSnapshot();
  });

  it("shows the award date in the cell", () => {
    const { container } = renderTracker();
    expect(badgesByCadet(container)["Amelia Hart"]["Blue Radio"]).toBe("2024-03-12");
  });

  it("leaves a cadet with no badges entirely blank", () => {
    const { container } = renderTracker();
    expect(badgesByCadet(container)["Isla Muir"]).toEqual({});
  });

  it("shows badges from every year by default", () => {
    // Amelia's Blue and Bronze Radio are 2024, her Silver is 2025 -- all three
    // appear because the default date mode is "all".
    const { container } = renderTracker();
    expect(Object.keys(badgesByCadet(container)["Amelia Hart"]).sort()).toEqual([
      "Blue Radio", "Bronze Radio", "Silver Radio",
    ]);
  });

  it("does not show exams, events or awards -- badges only", () => {
    const { container } = renderTracker();
    // Amelia has two exams, an event and a special award; none is a badge.
    expect(Object.keys(badgesByCadet(container)["Amelia Hart"])).toHaveLength(3);
  });
});

describe("totals", () => {
  it("counts holders per badge column", () => {
    const { container } = renderTracker();
    expect(totalsRow(container)).toMatchSnapshot();
  });

  it("counts the two Blue Radio holders", () => {
    // Amelia and Grace hold Blue Radio; nobody else does.
    const { container } = renderTracker();
    expect(totalsRow(container)["Blue Radio"]).toBe("2");
  });
});

describe("columns", () => {
  it("has a column for every badge type at every level", () => {
    const { container } = renderTracker();
    const labels = columnLabels(container.querySelector("table"));
    // 6 badge types from FlightPoints/Badges x 4 levels
    expect(labels).toHaveLength(24);
    expect(labels).toEqual(expect.arrayContaining(["Blue Radio", "Gold Music"]));
  });

  it("expands every badge type by default", () => {
    const { container } = renderTracker();
    const types = [...container.querySelectorAll(".PTSTracker-tab")].filter((t) =>
      t.classList.contains("expanded")
    );
    expect(types).toHaveLength(6);
  });
});

describe("filters", () => {
  it("offers all four badge levels, all selected", () => {
    const { container } = renderTracker();
    const controls = within(container.querySelector(".PTSTracker-buttons") || container);
    ["Blue", "Bronze", "Silver", "Gold"].forEach((level) => {
      expect(controls.getByRole("button", { name: level })).toHaveClass("selected");
    });
  });

  it("offers hiding all levels at once", () => {
    renderTracker();
    expect(screen.getByRole("button", { name: "Hide All Badge Levels" })).toBeInTheDocument();
  });

  it("offers hiding all badge types at once", () => {
    renderTracker();
    expect(screen.getByRole("button", { name: "Hide All Badge Types" })).toBeInTheDocument();
  });

  it("drops a level's columns when it is deselected", async () => {
    const { container, user } = renderTracker();
    const controls = within(container.querySelector(".PTSTracker-buttons") || container);
    await user.click(controls.getByRole("button", { name: "Gold" }));
    const labels = columnLabels(container.querySelector("table"));
    expect(labels).toHaveLength(18); // 6 types x 3 remaining levels
    expect(labels.filter((l) => l.startsWith("Gold"))).toEqual([]);
  });
});

describe("Testwood (legacy flight shape)", () => {
  it("records its badges", () => {
    const { container } = renderTracker(SQUADRONS.TESTWOOD);
    expect(badgesByCadet(container)).toMatchSnapshot();
  });
});
