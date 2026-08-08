/**
 * CHARACTERIZATION -- Cadets Dashboard.
 *
 * Records what this dashboard renders today, so later refactors have to prove
 * they changed nothing. Assertions describe current behaviour, not desired
 * behaviour; where the two differ it is called out inline.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

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

// ---------------------------------------------------------------------------
// Write paths
// ---------------------------------------------------------------------------

const cadetWrites = (writes) => writes().filter((w) => w.path.includes("/Cadets/"));

describe("adding a cadet", () => {
  const fillAddForm = async (result, { forename, surname, rank, flight, startDate }) => {
    const { user } = result;
    await user.click(screen.getByRole("button", { name: "Add Cadet" }));
    await user.type(screen.getByLabelText("Forename:"), forename);
    await user.type(screen.getByLabelText("Surname:"), surname);
    await user.selectOptions(screen.getByLabelText("Rank:"), rank);
    await user.selectOptions(screen.getByLabelText("Flight:"), flight);
    // The date field is a native date input; type into it directly.
    await user.type(screen.getByLabelText("Start Date:"), startDate);
  };

  it("writes the new cadet with numeric rank and flight", async () => {
    const result = renderDashboard();
    await fillAddForm(result, {
      forename: "Kai",
      surname: "Woods",
      rank: "1",
      flight: "2",
      startDate: "2025-05-01",
    });
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    const writes = cadetWrites(result.writes);
    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe("set");
    expect(writes[0].data).toMatchObject({
      forename: "Kai",
      surname: "Woods",
      startDate: "2025-05-01",
      flight: 2, // parseInt'd, not the string from the select
      rank: 1,
      addedBy: "Admin User",
    });
  });

  it("capitalises names, including hyphenated and multi-word ones", async () => {
    // handleAddCadet's capitalizeWords: each word, and each hyphenated part.
    const result = renderDashboard();
    await fillAddForm(result, {
      forename: "mary jane",
      surname: "smith-JONES",
      rank: "1",
      flight: "2",
      startDate: "2025-05-01",
    });
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(cadetWrites(result.writes)[0].data).toMatchObject({
      forename: "Mary Jane",
      surname: "Smith-Jones",
    });
  });

  it("shows the new cadet in the table without a refetch", async () => {
    const result = renderDashboard();
    await fillAddForm(result, {
      forename: "Kai",
      surname: "Woods",
      rank: "1",
      flight: "2",
      startDate: "2025-05-01",
    });
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(screen.getByText("Woods")).toBeInTheDocument();
    expect(screen.getByText("Total Cadets: 11")).toBeInTheDocument();
  });

  it("writes nothing and shows a message when a field is missing", async () => {
    // Phase 5: this validation used to go through window.alert().
    const result = renderDashboard();
    await result.user.click(screen.getByRole("button", { name: "Add Cadet" }));
    await result.user.type(screen.getByLabelText("Forename:"), "Kai");
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(cadetWrites(result.writes)).toEqual([]);
    expect(await screen.findByText("Please fill in all fields.")).toBeInTheDocument();
  });

  it("offers the squadron's active flights, excluding archived ones", async () => {
    // Phase 9: archived Charlie is no longer offered for new cadets.
    const result = renderDashboard();
    await result.user.click(screen.getByRole("button", { name: "Add Cadet" }));
    const options = [...screen.getByLabelText("Flight:").querySelectorAll("option")]
      .map((o) => o.textContent)
      .filter((t) => !t.startsWith("Select"));
    expect(options).toEqual(["Staff Team", "Alpha", "Bravo"]);
  });

  it("still shows an archived flight when editing a cadet already in one", async () => {
    // Grace is in archived Charlie. Hiding it outright would blank her flight
    // the moment anyone opened her record and pressed Confirm.
    const result = renderDashboard();
    const row = [...result.container.querySelectorAll("tbody tr")].find((tr) =>
      tr.textContent.includes("O'Neill")
    );
    await result.user.click(row);
    await screen.findByText("Edit Cadet");

    const select = screen.getByLabelText("Flight:");
    expect(select).toHaveValue("4");
    expect([...select.querySelectorAll("option")].map((o) => o.textContent)).toContain(
      "Charlie (archived)"
    );
  });
});

describe("discharging a cadet", () => {
  const discharge = async (result, name) => {
    const { user } = result;
    await user.click(screen.getByRole("button", { name: "Discharge Cadet" }));
    await user.selectOptions(screen.getByRole("combobox"), name);
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    // The confirmation popup opens ON TOP of the discharge popup -- both stay
    // mounted, so there are two Confirm buttons. Scope to the confirmation.
    const confirmation = (await screen.findByText("Are You Sure?")).closest(".popup-content");
    await user.click(within(confirmation).getByRole("button", { name: "Confirm" }));
  };

  it("deletes the cadet's document", async () => {
    const result = renderDashboard();
    const isla = result.data.cadets.find((c) => c.surname === "Muir");
    await discharge(result, isla.id);

    expect(result.writes()).toContainEqual({
      op: "delete",
      path: `SquadronDatabases/9999/Cadets/${isla.id}`,
      data: undefined,
    });
  });

  it("removes the cadet from the table and the count", async () => {
    const result = renderDashboard();
    const isla = result.data.cadets.find((c) => c.surname === "Muir");
    await discharge(result, isla.id);

    expect(screen.queryByText("Muir")).toBeNull();
    expect(screen.getByText("Total Cadets: 9")).toBeInTheDocument();
  });

  it("leaves the cadet's events behind", async () => {
    // CHARACTERIZATION: discharge deletes only the cadet document. Event
    // history remains under the cadet's name -- which the points dashboards
    // will still count. Whether that is desirable is a product question; the
    // suite records that it is what happens.
    const result = renderDashboard();
    const amelia = result.data.cadets.find((c) => c.surname === "Hart");
    await discharge(result, amelia.id);

    const eventPaths = result.writes().filter((w) => w.path.includes("/EventLog/"));
    expect(eventPaths).toEqual([]);
    expect(result.store()["SquadronDatabases/9999/EventLog/event-9999-01"]).toBeDefined();
  });

  it("writes nothing and says so when no cadet is selected", async () => {
    const result = renderDashboard();
    await result.user.click(screen.getByRole("button", { name: "Discharge Cadet" }));
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));
    const confirmation = (await screen.findByText("Are You Sure?")).closest(".popup-content");
    await result.user.click(within(confirmation).getByRole("button", { name: "Confirm" }));

    expect(cadetWrites(result.writes)).toEqual([]);
    expect(await screen.findByText("Please select a cadet to discharge.")).toBeInTheDocument();
  });
});

describe("editing a cadet", () => {
  const openEditFor = async (result, surname) => {
    const row = [...result.container.querySelectorAll("tbody tr")].find((tr) =>
      tr.textContent.includes(surname)
    );
    await result.user.click(row);
    await screen.findByText("Edit Cadet");
  };

  it("updates the cadet's document with the changed fields", async () => {
    const result = renderDashboard();
    const isla = result.data.cadets.find((c) => c.surname === "Muir");
    await openEditFor(result, "Muir");

    const flightSelect = screen.getByLabelText("Flight:");
    await result.user.selectOptions(flightSelect, "3");
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    const update = result
      .writes()
      .find((w) => w.op === "update" && w.path === `SquadronDatabases/9999/Cadets/${isla.id}`);
    expect(update).toBeDefined();
    // CHARACTERIZATION: the select's value arrives as a string and is stored
    // as-is -- unlike add, which parseInts it. The table still renders it
    // because flightMap lookup coerces, but the stored type now differs from
    // added cadets. Worth knowing before anything sorts or filters on it.
    expect(update.data.flight).toBe("3");
  });

  it("shows the edit in the table immediately", async () => {
    const result = renderDashboard();
    await openEditFor(result, "Muir");
    await result.user.selectOptions(screen.getByLabelText("Flight:"), "3");
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    const rows = rowsByHeader(result.container.querySelector("table"));
    expect(rows.find((r) => r.Surname === "Muir").Flight).toBe("Bravo");
  });

  it("cascades a rename into every one of the cadet's events", async () => {
    // PopupManager.handleEditCadet updates each matching EventLog document's
    // cadetName. Amelia has 7 events; all must follow her new name.
    const result = renderDashboard();
    await openEditFor(result, "Hart");

    const surnameInput = screen.getByLabelText("Surname:");
    await result.user.clear(surnameInput);
    await result.user.type(surnameInput, "Hartley");
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    const eventUpdates = result
      .writes()
      .filter((w) => w.op === "update" && w.path.includes("/EventLog/"));
    expect(eventUpdates).toHaveLength(7);
    eventUpdates.forEach((w) => expect(w.data).toEqual({ cadetName: "Amelia Hartley" }));
  });

  it("does not touch other cadets' events on a rename", async () => {
    const result = renderDashboard();
    await openEditFor(result, "Hart");
    const surnameInput = screen.getByLabelText("Surname:");
    await result.user.clear(surnameInput);
    await result.user.type(surnameInput, "Hartley");
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    // Ben's event is untouched in the store.
    expect(result.store()["SquadronDatabases/9999/EventLog/event-9999-08"].cadetName).toBe(
      "Ben Okafor"
    );
  });

  it("shows who added the cadet and when", async () => {
    const result = renderDashboard();
    await openEditFor(result, "Muir");
    const popup = within(document.querySelector(".popup-content"));
    expect(popup.getByText(/Added By:/).parentElement.textContent).toContain("Admin User");
    expect(popup.getByText(/Created At:/)).toBeInTheDocument();
  });
});
