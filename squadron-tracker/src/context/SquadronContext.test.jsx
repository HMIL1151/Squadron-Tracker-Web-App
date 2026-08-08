/**
 * SquadronContext -- squadron identity and its flights.
 *
 * The reactivity test here is the point of Phase 7. flightMap used to be a
 * mutable module-level `let` in utils/mappings.js: renaming a flight replaced
 * the object but told React nothing, so anything already rendered kept showing
 * the old name until some unrelated state change forced a re-render. It also
 * survived logout, leaking one squadron's flight names into the next.
 */

import React, { useContext } from "react";
import { render, screen, act } from "@testing-library/react";

import { SquadronProvider, useSquadron } from "./SquadronContext";
import { DataContext } from "./DataContext";
import Table from "../components/Table/Table";
import { FAKETON_FLIGHTS, TESTWOOD_FLIGHTS } from "../test/dummyData";

const Probe = () => {
  const { squadronNumber, squadronDocId, flights, flightMap, setFlights, setSquadron } = useSquadron();
  return (
    <div>
      <span data-testid="number">{String(squadronNumber)}</span>
      <span data-testid="docId">{String(squadronDocId)}</span>
      <span data-testid="map">{JSON.stringify(flightMap)}</span>
      <span data-testid="count">{flights.length}</span>
      <button onClick={() => setFlights([{ name: "Renamed", competing: true, archived: false }])}>
        rename
      </button>
      <button onClick={() => setSquadron({ squadronNumber: null, squadronDocId: null, flights: [] })}>
        clear
      </button>
    </div>
  );
};

const renderProbe = (props = {}) =>
  render(
    <SquadronProvider {...props}>
      <Probe />
    </SquadronProvider>
  );

describe("flights", () => {
  it("starts empty when nothing is seeded", () => {
    renderProbe();
    expect(screen.getByTestId("number")).toHaveTextContent("null");
    expect(screen.getByTestId("count")).toHaveTextContent("0");
    expect(screen.getByTestId("map")).toHaveTextContent("{}");
  });

  it("derives a 1-based flightMap from the flights array", () => {
    renderProbe({ initialSquadronNumber: 9999, initialFlights: FAKETON_FLIGHTS });
    expect(JSON.parse(screen.getByTestId("map").textContent)).toEqual({
      1: "Staff Team",
      2: "Alpha",
      3: "Bravo",
      4: "Charlie",
    });
  });

  it("accepts the legacy string[] flight shape", () => {
    renderProbe({ initialSquadronNumber: 9998, initialFlights: TESTWOOD_FLIGHTS });
    expect(JSON.parse(screen.getByTestId("map").textContent)).toEqual({
      1: "Staff Team",
      2: "Atlas",
      3: "Tempest",
    });
  });

  it("re-renders consumers when flights change", () => {
    // THE Phase 7 regression. With the module-level global this assertion
    // failed: the map object was replaced but React never re-rendered.
    renderProbe({ initialSquadronNumber: 9999, initialFlights: FAKETON_FLIGHTS });
    expect(screen.getByTestId("map")).toHaveTextContent("Alpha");

    act(() => {
      screen.getByRole("button", { name: "rename" }).click();
    });

    expect(JSON.parse(screen.getByTestId("map").textContent)).toEqual({ 1: "Renamed" });
  });

  it("clears on logout so flights do not leak into the next squadron", () => {
    renderProbe({ initialSquadronNumber: 9999, initialFlights: FAKETON_FLIGHTS });

    act(() => {
      screen.getByRole("button", { name: "clear" }).click();
    });

    expect(screen.getByTestId("count")).toHaveTextContent("0");
    expect(screen.getByTestId("map")).toHaveTextContent("{}");
  });

  it("carries the squadron document id, which flight edits need to write back", () => {
    renderProbe({ initialSquadronNumber: 9999, initialSquadronDocId: "sqnlist-faketon" });
    expect(screen.getByTestId("docId")).toHaveTextContent("sqnlist-faketon");
  });
});

describe("a rendered Table follows a flight rename without remounting", () => {
  // Table maps a cadet's numeric flight to its name. This is what a user sees
  // break if flight names are not reactive.
  const CADETS = [{ Name: "Amelia Hart", Flight: 2 }];

  const Harness = () => {
    const { setFlights } = useSquadron();
    return (
      <>
        <button onClick={() => setFlights(["Staff Team", "Renamed Flight", "Bravo"])}>
          rename flight 2
        </button>
        <Table columns={["Name", "Flight"]} data={CADETS} disableHover />
      </>
    );
  };

  it("shows the new name immediately", () => {
    render(
      <DataContext.Provider value={{ data: { cadets: [], events: [], flightPoints: {} } }}>
        <SquadronProvider initialSquadronNumber={9999} initialFlights={FAKETON_FLIGHTS}>
          <Harness />
        </SquadronProvider>
      </DataContext.Provider>
    );

    expect(screen.getByText("Alpha")).toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "rename flight 2" }).click();
    });

    expect(screen.getByText("Renamed Flight")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).toBeNull();
  });
});
