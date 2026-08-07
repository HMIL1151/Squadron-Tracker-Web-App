/**
 * CHARACTERIZATION -- Flight Points.
 *
 * The second of the three places event points are calculated, and the one that
 * differs most from the others: it filters by year and it hardcodes which
 * flights compete.
 *
 * Phase 6 unifies the scoring; Phase 9 replaces the hardcoded flights. Both have
 * to reproduce what is recorded here, or explain precisely why not.
 */

import React from "react";
import { screen, waitFor, within } from "@testing-library/react";

import FightPointsDashboard from "./FightPointsDashboard";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { rowsByHeader } from "../../../test/domSnapshot";
import { SQUADRONS, userFor } from "../../../test/dummyData";

/**
 * Renders and waits for the initial load to finish.
 *
 * This dashboard is the only one that awaits Firestore during render --
 * fetchTeamPoints reads the TeamPoints document -- so it shows "Loading..."
 * with no table until that promise settles.
 */
const renderDashboard = async (squadron = SQUADRONS.FAKETON) => {
  const result = renderWithProviders(<FightPointsDashboard user={userFor(squadron)} />, { squadron });
  await screen.findByRole("table");
  return result;
};

const pointsByCadet = (container) =>
  Object.fromEntries(
    rowsByHeader(container.querySelector("table")).map((r) => [r.Name, Number(r["Points Earned"])])
  );

describe("per-cadet points for the current year", () => {
  it("scores every cadet", async () => {
    const { container } = await renderDashboard();
    expect(pointsByCadet(container)).toMatchSnapshot();
  });

  it("counts only events in the selected year", async () => {
    // Defaults to the frozen clock's year, 2025. Amelia's three 2025 events
    // score 15 + 8 + 5; her 2024 badge, exam and award are excluded.
    const { container } = await renderDashboard();
    expect(pointsByCadet(container)["Amelia Hart"]).toBe(28);
  });

  it("gives a cadet with no events zero", async () => {
    const { container } = await renderDashboard();
    expect(pointsByCadet(container)["Isla Muir"]).toBe(0);
  });

  it("includes the 1 January event", async () => {
    // CHARACTERIZATION, and the reason the suite pins TZ=UTC.
    // This dashboard buckets by `new Date(date).getFullYear()`, which reads the
    // *local* year of a UTC-midnight instant. Under UTC that is 2025 and Ben
    // scores his Blue badge (5) plus a parade night (1). West of UTC the same
    // code would bucket it as 2024 and score him 1.
    //
    // Worth being precise about: this never misfires for UK users, because
    // London is never behind UTC. Phase 6 removes the fragility rather than
    // fixing a bug UK squadrons are currently hitting.
    const { container } = await renderDashboard();
    expect(pointsByCadet(container)["Ben Okafor"]).toBe(6);
  });

  it("scores an uncategorised event as zero, same as Mass Event Log", async () => {
    // Reached by a different route than Mass Event Log: that one dispatches on
    // eventName then misses the category lookup, this one dispatches on
    // eventCategory and falls through to its warn branch. Same answer today --
    // Phase 6 must keep it that way.
    const { container } = await renderDashboard();
    // Silver badge 15 + exam 8 + uncategorised event 0
    expect(pointsByCadet(container)["Jack Petrov"]).toBe(23);
  });

  it("scores cadets in non-competing and archived flights too", async () => {
    // They earn points; they are only excluded from the chart.
    const { container } = await renderDashboard();
    expect(pointsByCadet(container)["Harry Blythe-Jones"]).toBe(25); // Staff Team
    expect(pointsByCadet(container)["Grace O'Neill"]).toBe(8); // archived Charlie
  });
});

describe("flight totals in the chart", () => {
  it("shows only flights 2 and 3", async () => {
    // CHARACTERIZATION OF A LIMITATION, not of intent. The filter is literally
    // `flight === "2" || flight === "3"` in four places, so Faketon's Staff Team
    // and Charlie never appear however they are configured. Phase 9 replaces
    // this with the per-flight `competing` flag and this expectation changes.
    const { container } = await renderDashboard();
    const legend = container.querySelectorAll("span");
    const names = [...legend].map((s) => s.textContent.trim());
    expect(names).toEqual(["Alpha", "Bravo"]);
  });

  it("adds allocated team points to the earned totals", async () => {
    // Alpha: Amelia 28 + Ben 6 + Chloe 13 + Isla 0 = 47, plus 40 allocated = 87
    // Bravo: Daniel 6 + Eve 53 + Femi 5 + Jack 23 = 87, plus 25 allocated = 112
    const { container } = await renderDashboard();
    const labels = [...container.querySelectorAll("div")]
      .map((d) => d.textContent.trim())
      .filter((t) => /^\d+$/.test(t));
    expect(labels).toEqual(expect.arrayContaining(["87", "112"]));
  });
});

describe("year selector", () => {
  it("defaults to the frozen clock's year", async () => {
    await renderDashboard();
    expect(screen.getByLabelText(/year/i)).toHaveValue("2025");
  });

  it("offers the last ten years", async () => {
    await renderDashboard();
    const options = within(screen.getByLabelText(/year/i)).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016",
    ]);
  });
});

describe("controls", () => {
  it("offers allocating points to a flight", async () => {
    await renderDashboard();
    expect(screen.getByRole("button", { name: "Allocate Points to Flight" })).toBeInTheDocument();
  });
});

describe("allocating points to a flight", () => {
  const openAllocate = async (result) => {
    await result.user.click(screen.getByRole("button", { name: "Allocate Points to Flight" }));
    await screen.findByRole("heading", { name: "Allocate Points to Flight" });
  };

  it("increments the flight's TeamPoints field", async () => {
    const result = await renderDashboard();
    await openAllocate(result);
    await result.user.selectOptions(screen.getByLabelText(/flight:/i), "2");
    await result.user.type(screen.getByLabelText(/points to add/i), "15");
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    // Alpha (flight 2) had 40 allocated; 40 + 15 = 55.
    await waitFor(() => {
      expect(result.store()["SquadronDatabases/9999/FlightPoints/TeamPoints"]["2"]).toBe(55);
    });
  });

  it("refreshes the chart total after allocating", async () => {
    const result = await renderDashboard();
    await openAllocate(result);
    await result.user.selectOptions(screen.getByLabelText(/flight:/i), "2");
    await result.user.type(screen.getByLabelText(/points to add/i), "15");
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    // Alpha earned 47 + (40 + 15) allocated = 102.
    await waitFor(() => {
      const labels = [...result.container.querySelectorAll("div")]
        .map((d) => d.textContent.trim())
        .filter((t) => /^\d+$/.test(t));
      expect(labels).toContain("102");
    });
  });

  it("rejects a missing flight or points with an inline error", async () => {
    const result = await renderDashboard();
    await openAllocate(result);
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(
      await screen.findByText("Please select a flight and enter a valid number of points.")
    ).toBeInTheDocument();
    expect(result.writes()).toEqual([]);
  });

  it("offers every flight cadets are assigned to, including archived ones", async () => {
    // CHARACTERIZATION: the dropdown is built from cadet assignments, not the
    // flights array -- so archived Charlie appears because Grace is in it, and
    // an empty flight would not appear at all. Phase 9 revisits this.
    const result = await renderDashboard();
    await openAllocate(result);
    const options = [...screen.getByLabelText(/flight:/i).querySelectorAll("option")]
      .map((o) => o.textContent)
      .filter((t) => t !== "Select Flight");
    expect(options).toEqual(["Staff Team", "Alpha", "Bravo", "Charlie"]);
  });
});

describe("Testwood (legacy flight shape)", () => {
  it("scores its cadets", async () => {
    const { container } = await renderDashboard(SQUADRONS.TESTWOOD);
    expect(pointsByCadet(container)).toMatchSnapshot();
  });

  it("shows its two competing flights", async () => {
    const { container } = await renderDashboard(SQUADRONS.TESTWOOD);
    const names = [...container.querySelectorAll("span")].map((s) => s.textContent.trim());
    expect(names).toEqual(["Atlas", "Tempest"]);
  });
});
