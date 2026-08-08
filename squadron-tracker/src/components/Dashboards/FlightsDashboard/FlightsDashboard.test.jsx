/**
 * Add/Edit Flights.
 *
 * The feature this whole cleanup was for. Written test-first against the
 * behaviour agreed up front: index-based identity, archive rather than delete,
 * an explicit per-flight competing flag, and legacy string[] squadrons
 * upgrading in place.
 */

import React from "react";
import { screen, waitFor, within } from "@testing-library/react";

import FlightsDashboard from "./FlightsDashboard";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { rowsByHeader } from "../../../test/domSnapshot";
import { SQUADRONS, userFor } from "../../../test/dummyData";

const SQUADRON_DOC = {
  [SQUADRONS.FAKETON]: "sqnlist-faketon",
  [SQUADRONS.TESTWOOD]: "sqnlist-testwood",
};

const renderDashboard = (squadron = SQUADRONS.FAKETON) =>
  renderWithProviders(<FlightsDashboard />, {
    squadron,
    user: userFor(squadron),
    squadronDocId: SQUADRON_DOC[squadron],
  });

const flightRows = (container) => rowsByHeader(container.querySelector("table"));
const popup = () => within(document.querySelector(".popup-content"));

const openFlight = async (result, name) => {
  const row = [...result.container.querySelectorAll("tbody tr")].find((tr) =>
    tr.textContent.includes(name)
  );
  await result.user.click(row);
  await screen.findByText("Edit Flight");
};

/** The flights array as it now stands in the fake's SquadronList document. */
const storedFlights = (result, squadron = SQUADRONS.FAKETON) =>
  result.store()[`SquadronList/${SQUADRON_DOC[squadron]}`].flights;

describe("the flight list", () => {
  it("shows every flight with its cadet count, competing state and status", () => {
    const { container } = renderDashboard();
    expect(flightRows(container)).toEqual([
      { Flight: "Staff Team", Cadets: "1", Competing: "No", Status: "Active" },
      { Flight: "Alpha", Cadets: "4", Competing: "Yes", Status: "Active" },
      { Flight: "Bravo", Cadets: "4", Competing: "Yes", Status: "Active" },
      { Flight: "Charlie", Cadets: "1", Competing: "Yes", Status: "Archived" },
    ]);
  });

  it("shows an archived flight rather than hiding it", () => {
    // Admins need to see what is archived in order to un-archive it.
    const { container } = renderDashboard();
    const charlie = flightRows(container).find((r) => r.Flight === "Charlie");
    expect(charlie.Status).toBe("Archived");
  });

  it("explains why flights cannot be deleted", () => {
    renderDashboard();
    expect(screen.getByText(/cannot be deleted/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("renders a legacy string[] squadron", () => {
    const { container } = renderDashboard(SQUADRONS.TESTWOOD);
    expect(flightRows(container)).toEqual([
      { Flight: "Staff Team", Cadets: "1", Competing: "No", Status: "Active" },
      { Flight: "Atlas", Cadets: "2", Competing: "Yes", Status: "Active" },
      { Flight: "Tempest", Cadets: "1", Competing: "Yes", Status: "Active" },
    ]);
  });
});

describe("adding a flight", () => {
  const addFlightNamed = async (result, name, { competing = true } = {}) => {
    await result.user.click(screen.getByRole("button", { name: "Add Flight" }));
    await screen.findByText("Add Flight", { selector: "h2" });
    await result.user.type(popup().getByLabelText("Flight name:"), name);
    if (!competing) {
      await result.user.click(popup().getByRole("checkbox"));
    }
    await result.user.click(popup().getByRole("button", { name: "Confirm" }));
  };

  it("appends it and writes the object shape", async () => {
    const result = renderDashboard();
    await addFlightNamed(result, "Delta");

    await waitFor(() => {
      expect(storedFlights(result)).toHaveLength(5);
    });
    expect(storedFlights(result)[4]).toEqual({
      name: "Delta",
      competing: true,
      archived: false,
    });
  });

  it("leaves every existing flight index untouched", async () => {
    // The property that keeps existing cadets pointing at the right flight.
    const result = renderDashboard();
    const before = storedFlights(result);
    await addFlightNamed(result, "Delta");

    await waitFor(() => expect(storedFlights(result)).toHaveLength(5));
    expect(storedFlights(result).slice(0, 4)).toEqual(before);
  });

  it("gives the new flight a TeamPoints key so points can be allocated to it", async () => {
    const result = renderDashboard();
    await addFlightNamed(result, "Delta");

    await waitFor(() => {
      expect(
        result.store()["SquadronDatabases/9999/FlightPoints/TeamPoints"]["5"]
      ).toBe(0);
    });
  });

  it("shows it in the list immediately", async () => {
    const result = renderDashboard();
    await addFlightNamed(result, "Delta");

    await waitFor(() => {
      expect(flightRows(result.container).map((r) => r.Flight)).toContain("Delta");
    });
    expect(flightRows(result.container).find((r) => r.Flight === "Delta")).toMatchObject({
      Cadets: "0",
      Competing: "Yes",
      Status: "Active",
    });
  });

  it("can add a non-competing flight", async () => {
    const result = renderDashboard();
    await addFlightNamed(result, "Support", { competing: false });

    await waitFor(() => expect(storedFlights(result)).toHaveLength(5));
    expect(storedFlights(result)[4].competing).toBe(false);
  });

  it("refuses a blank name", async () => {
    const result = renderDashboard();
    await result.user.click(screen.getByRole("button", { name: "Add Flight" }));
    await screen.findByText("Add Flight", { selector: "h2" });
    await result.user.click(popup().getByRole("button", { name: "Confirm" }));

    expect(popup().getByText(/needs a name/i)).toBeInTheDocument();
    expect(storedFlights(result)).toHaveLength(4);
  });

  it("refuses a duplicate name", async () => {
    const result = renderDashboard();
    await result.user.click(screen.getByRole("button", { name: "Add Flight" }));
    await screen.findByText("Add Flight", { selector: "h2" });
    await result.user.type(popup().getByLabelText("Flight name:"), "alpha");
    await result.user.click(popup().getByRole("button", { name: "Confirm" }));

    expect(popup().getByText(/cannot share a name/i)).toBeInTheDocument();
    expect(storedFlights(result)).toHaveLength(4);
  });

  it("upgrades a legacy squadron to the object shape on first save", async () => {
    // The lazy migration. Nothing else has to run.
    const result = renderDashboard(SQUADRONS.TESTWOOD);
    expect(storedFlights(result, SQUADRONS.TESTWOOD).every((f) => typeof f === "string")).toBe(true);

    await addFlightNamed(result, "Vulcan");

    await waitFor(() => {
      expect(storedFlights(result, SQUADRONS.TESTWOOD)).toHaveLength(4);
    });
    expect(storedFlights(result, SQUADRONS.TESTWOOD)).toEqual([
      { name: "Staff Team", competing: false, archived: false },
      { name: "Atlas", competing: true, archived: false },
      { name: "Tempest", competing: true, archived: false },
      { name: "Vulcan", competing: true, archived: false },
    ]);
  });
});

describe("editing a flight", () => {
  it("renames it", async () => {
    const result = renderDashboard();
    await openFlight(result, "Alpha");

    const input = popup().getByLabelText("Flight name:");
    await result.user.clear(input);
    await result.user.type(input, "Anson");
    await result.user.click(popup().getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(storedFlights(result)[1].name).toBe("Anson");
    });
  });

  it("updates the list without a reload", async () => {
    // What the Phase 7 context change bought. Against the old module-level
    // flightMap the table would still say "Alpha".
    const result = renderDashboard();
    await openFlight(result, "Alpha");
    const input = popup().getByLabelText("Flight name:");
    await result.user.clear(input);
    await result.user.type(input, "Anson");
    await result.user.click(popup().getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(flightRows(result.container).map((r) => r.Flight)).toContain("Anson");
    });
    expect(flightRows(result.container).map((r) => r.Flight)).not.toContain("Alpha");
  });

  it("shows how many cadets are in the flight", async () => {
    const result = renderDashboard();
    await openFlight(result, "Alpha");
    expect(popup().getByText(/4 cadets currently in this flight/)).toBeInTheDocument();
  });

  it("uses the singular for a flight with one cadet", async () => {
    const result = renderDashboard();
    await openFlight(result, "Staff Team");
    expect(popup().getByText(/1 cadet currently in this flight/)).toBeInTheDocument();
  });

  it("toggles competing off", async () => {
    const result = renderDashboard();
    await openFlight(result, "Alpha");
    const [competing] = popup().getAllByRole("checkbox");
    await result.user.click(competing);
    await result.user.click(popup().getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(storedFlights(result)[1].competing).toBe(false);
    });
  });

  it("refuses to archive a flight that still has cadets", async () => {
    const result = renderDashboard();
    await openFlight(result, "Alpha");
    const [, archived] = popup().getAllByRole("checkbox");
    await result.user.click(archived);
    await result.user.click(popup().getByRole("button", { name: "Confirm" }));

    expect(popup().getByText(/Alpha still has 4 cadets/)).toBeInTheDocument();
    expect(storedFlights(result)[1].archived).toBe(false);
  });

  it("archives an empty flight", async () => {
    const result = renderDashboard();
    // Add an empty flight, then archive it.
    await result.user.click(screen.getByRole("button", { name: "Add Flight" }));
    await screen.findByText("Add Flight", { selector: "h2" });
    await result.user.type(popup().getByLabelText("Flight name:"), "Delta");
    await result.user.click(popup().getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(storedFlights(result)).toHaveLength(5));

    await openFlight(result, "Delta");
    const [, archived] = popup().getAllByRole("checkbox");
    await result.user.click(archived);
    await result.user.click(popup().getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(storedFlights(result)[4].archived).toBe(true);
    });
  });

  it("un-archives a flight", async () => {
    const result = renderDashboard();
    await openFlight(result, "Charlie");
    const [, archived] = popup().getAllByRole("checkbox");
    expect(archived).toBeChecked();
    await result.user.click(archived);
    await result.user.click(popup().getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(storedFlights(result)[3].archived).toBe(false);
    });
  });

  it("refuses to leave the squadron with no competing flight", async () => {
    const result = renderDashboard();

    // Turn Alpha off, then try Bravo -- which would leave none.
    await openFlight(result, "Alpha");
    await result.user.click(popup().getAllByRole("checkbox")[0]);
    await result.user.click(popup().getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(storedFlights(result)[1].competing).toBe(false));

    await openFlight(result, "Bravo");
    await result.user.click(popup().getAllByRole("checkbox")[0]);
    await result.user.click(popup().getByRole("button", { name: "Confirm" }));

    expect(popup().getByText(/must be competing/i)).toBeInTheDocument();
    expect(storedFlights(result)[2].competing).toBe(true);
  });

  it("does not touch cadet records", async () => {
    // Renaming a flight must never rewrite a cadet: the link is positional.
    const result = renderDashboard();
    await openFlight(result, "Alpha");
    const input = popup().getByLabelText("Flight name:");
    await result.user.clear(input);
    await result.user.type(input, "Anson");
    await result.user.click(popup().getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(storedFlights(result)[1].name).toBe("Anson"));
    expect(result.writes().filter((w) => w.path.includes("/Cadets/"))).toEqual([]);
    expect(result.store()["SquadronDatabases/9999/Cadets/cadet-9999-01"].flight).toBe(2);
  });
});

describe("when the squadron directory entry is missing", () => {
  it("refuses to save rather than silently dropping the change", async () => {
    const result = renderWithProviders(<FlightsDashboard />, {
      squadron: SQUADRONS.FAKETON,
      user: userFor(SQUADRONS.FAKETON),
      // squadronDocId deliberately absent
    });

    await result.user.click(screen.getByRole("button", { name: "Add Flight" }));
    await screen.findByText("Add Flight", { selector: "h2" });
    await result.user.type(popup().getByLabelText("Flight name:"), "Delta");
    await result.user.click(popup().getByRole("button", { name: "Confirm" }));

    expect(popup().getByText(/directory entry was not found/i)).toBeInTheDocument();
    expect(result.writes()).toEqual([]);
  });
});
