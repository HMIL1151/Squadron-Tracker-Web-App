/**
 * CHARACTERIZATION -- Cadets Dashboard.
 *
 * Records what this dashboard renders today, so later refactors have to prove
 * they changed nothing. Assertions describe current behaviour, not desired
 * behaviour; where the two differ it is called out inline.
 */

import React from "react";
import { screen } from "@testing-library/react";

import CadetsDashboard from "./CadetsDashboard";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { rowsByHeader, toStructure } from "../../../test/domSnapshot";
import { SQUADRONS, userFor } from "../../../test/dummyData";

const renderDashboard = (squadron = SQUADRONS.FAKETON) =>
  renderWithProviders(<CadetsDashboard user={userFor(squadron)} />, { squadron });

describe("Faketon (new flight shape)", () => {
  it("renders the cadet table", () => {
    const { container } = renderDashboard();
    expect(toStructure(container.querySelector(".table-dashboard-container"))).toMatchSnapshot();
  });

  it("lists every cadet with mapped rank, flight and classification", () => {
    const { container } = renderDashboard();
    expect(rowsByHeader(container.querySelector("table"))).toMatchSnapshot();
  });

  it("sorts cadets by forename, as DataContext delivers them", () => {
    const { container } = renderDashboard();
    const forenames = rowsByHeader(container.querySelector("table")).map((r) => r.Forename);
    expect(forenames).toEqual([
      "Amelia", "Ben", "Chloe", "Daniel", "Eve", "Femi", "Grace", "Harry", "Isla", "Jack",
    ]);
  });

  it("maps rank numbers to names", () => {
    const { container } = renderDashboard();
    const rows = rowsByHeader(container.querySelector("table"));
    expect(rows.find((r) => r.Surname === "Hart").Rank).toBe("Sergeant");
    expect(rows.find((r) => r.Surname === "Blythe-Jones").Rank).toBe("Cadet Warrant Officer");
    expect(rows.find((r) => r.Surname === "Okafor").Rank).toBe("Cadet");
  });

  it("maps flight indices to the squadron's flight names", () => {
    const { container } = renderDashboard();
    const rows = rowsByHeader(container.querySelector("table"));
    expect(rows.find((r) => r.Surname === "Hart").Flight).toBe("Alpha"); // index 2
    expect(rows.find((r) => r.Surname === "Foster").Flight).toBe("Bravo"); // index 3
    expect(rows.find((r) => r.Surname === "Blythe-Jones").Flight).toBe("Staff Team"); // index 1
  });

  it("still shows the name of an archived flight", () => {
    // Grace sits in Charlie, which is archived. Archiving must never orphan a
    // cadet's flight label -- that is the whole reason Add/Edit Flights archives
    // rather than deletes.
    const { container } = renderDashboard();
    const grace = rowsByHeader(container.querySelector("table")).find((r) => r.Surname === "O'Neill");
    expect(grace.Flight).toBe("Charlie");
  });

  it("derives classification from the cadet's exam count", () => {
    // Classification is not stored. CadetsDashboard counts events with a
    // non-empty examName and adds one, capped at 12.
    const { container } = renderDashboard();
    const rows = rowsByHeader(container.querySelector("table"));

    // Amelia has 2 exams -> 3 -> "First Class"
    expect(rows.find((r) => r.Surname === "Hart").Classification).toBe("First Class");
    // Isla has no events at all -> 1 -> "Junior"
    expect(rows.find((r) => r.Surname === "Muir").Classification).toBe("Junior");
    // Jack has 1 exam -> 2 -> "Second Class"
    expect(rows.find((r) => r.Surname === "Petrov").Classification).toBe("Second Class");
  });

  it("computes service length against the frozen clock", () => {
    const { container } = renderDashboard();
    const rows = rowsByHeader(container.querySelector("table"));
    // Femi joined 2025-02-10; frozen now is 2025-06-15.
    expect(rows.find((r) => r.Surname === "Adeyemi")["Service Length"]).toBe("0 Yrs, 4 Mos, 5 Days");
    // Harry joined 2019-04-08.
    expect(rows.find((r) => r.Surname === "Blythe-Jones")["Service Length"]).toBe("6 Yrs, 2 Mos, 7 Days");
  });

  it("shows the cadet count", () => {
    renderDashboard();
    expect(screen.getByText("Total Cadets: 10")).toBeInTheDocument();
  });

  it("offers add and discharge actions", () => {
    renderDashboard();
    expect(screen.getByRole("button", { name: "Add Cadet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discharge Cadet" })).toBeInTheDocument();
  });
});

describe("Testwood (legacy string[] flight shape)", () => {
  it("renders the cadet table", () => {
    const { container } = renderDashboard(SQUADRONS.TESTWOOD);
    expect(rowsByHeader(container.querySelector("table"))).toMatchSnapshot();
  });

  it("resolves legacy flight names exactly as the object shape does", () => {
    const { container } = renderDashboard(SQUADRONS.TESTWOOD);
    const rows = rowsByHeader(container.querySelector("table"));
    expect(rows.find((r) => r.Surname === "Lawson").Flight).toBe("Atlas"); // index 2
    expect(rows.find((r) => r.Surname === "Sharma").Flight).toBe("Tempest"); // index 3
    expect(rows.find((r) => r.Surname === "Bright").Flight).toBe("Staff Team"); // index 1
  });

  it("shows its own cadet count", () => {
    renderDashboard(SQUADRONS.TESTWOOD);
    expect(screen.getByText("Total Cadets: 4")).toBeInTheDocument();
  });
});
