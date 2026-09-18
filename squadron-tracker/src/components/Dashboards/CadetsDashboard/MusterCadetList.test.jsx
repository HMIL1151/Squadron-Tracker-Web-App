/**
 * The Muster cadet list.
 *
 * The writes are shared with the classic screen through useCadetList and are
 * already covered by CadetsDashboard.test.jsx, so this covers what is new:
 * the derived columns, and the detail panel.
 *
 * The derived columns are the part worth guarding. Classification, badge count
 * and points are all computed here from the event log rather than read off the
 * cadet, so a change to how any of them is derived shows up as a wrong number
 * on a screen staff read rather than as an error.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import MusterCadetList from "./MusterCadetList";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { rowsByHeader } from "../../../test/domSnapshot";
import { SQUADRONS, userFor } from "../../../test/dummyData";

const renderView = (squadron = SQUADRONS.FAKETON) =>
  renderWithProviders(<MusterCadetList user={userFor(squadron)} />, {
    squadron,
    uiVersion: "muster",
  });

const rows = (container) => rowsByHeader(container.querySelector("table"));

describe("the list", () => {
  it("shows every cadet on strength", () => {
    const { container, data } = renderView();
    expect(rows(container)).toHaveLength(data.cadets.length);
  });

  it("sorts by name, so the same cadet is always in the same place", () => {
    const { container } = renderView();
    const names = rows(container).map((row) => row.Cadet.split("\n")[0]);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("puts rank under the name rather than in its own column", () => {
    const { container } = renderView();
    // Harry is rank 5 in the fixture, the only cadet above Sergeant.
    const harry = rows(container).find((row) => row.Cadet.includes("Harry"));
    expect(harry.Cadet).toContain("Cadet Warrant Officer");
  });

  it("derives classification from exams rather than reading a stored field", () => {
    const { container } = renderView();
    // Amelia has two exam records in the fixture, so she is exams + 1.
    const amelia = rows(container).find((row) => row.Cadet.includes("Amelia Hart"));
    expect(amelia.Classification).toContain("First Class");
  });

  /*
   * A dash rather than a 0. A column of zeroes reads as a list of failures;
   * "nothing recorded" and "recorded as none" are different states and only
   * the first one is true here.
   */
  it("shows a dash rather than a zero for a cadet with no badges", () => {
    const { container } = renderView();
    // Isla has no events at all in the fixture, deliberately.
    const isla = rows(container).find((row) => row.Cadet.includes("Isla"));
    expect(isla.Badges).toBe("—");
  });
});

describe("filtering", () => {
  it("narrows by flight", async () => {
    const { container, user } = renderView();
    const before = rows(container).length;

    await user.selectOptions(screen.getByLabelText("Flight"), "2");

    const after = rows(container);
    expect(after.length).toBeLessThan(before);
    expect(after.every((row) => row.Flight === "Alpha")).toBe(true);
  });

  it("searches by name", async () => {
    const { container, user } = renderView();
    await user.type(screen.getByLabelText("Search cadets"), "Okafor");
    expect(rows(container)).toHaveLength(1);
  });
});

describe("the detail panel", () => {
  it("stays closed until a cadet is chosen", () => {
    renderView();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  /*
   * Docked rather than modal is the argument for this screen, so the list has
   * to still be there once the panel opens.
   */
  it("opens beside the list rather than over it", async () => {
    const { container, user } = renderView();
    await user.click(within(container.querySelector("tbody")).getByText("Amelia Hart"));

    const panel = screen.getByRole("complementary");
    expect(within(panel).getByRole("heading", { name: "Amelia Hart" })).toBeInTheDocument();
    expect(rows(container).length).toBeGreaterThan(1);
  });

  it("lists the badges that cadet actually holds", async () => {
    const { container, user } = renderView();
    await user.click(within(container.querySelector("tbody")).getByText("Amelia Hart"));

    /*
     * Scoped to the badge list: "Silver Radio" is also the most recent record,
     * so it legitimately appears twice in the panel.
     */
    const badges = screen.getByRole("complementary").querySelector("ul");
    expect(within(badges).getByText(/Silver\s+Radio/)).toBeInTheDocument();
  });

  it("closes again", async () => {
    const { container, user } = renderView();
    await user.click(within(container.querySelector("tbody")).getByText("Amelia Hart"));
    await user.click(screen.getByRole("button", { name: "Close cadet details" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});
