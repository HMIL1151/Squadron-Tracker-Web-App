/**
 * Muster flight points.
 *
 * The points arithmetic is utils/points and covered there. What matters here
 * is the framing: standings in order, and points-per-cadet alongside the raw
 * total. The second is the whole argument for the screen -- a flight of eleven
 * beating a flight of six has not necessarily done better, and the standings
 * get read out on parade.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import MusterFlightPoints from "./MusterFlightPoints";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { SQUADRONS, userFor } from "../../../test/dummyData";

const renderView = (squadron = SQUADRONS.FAKETON) =>
  renderWithProviders(<MusterFlightPoints user={userFor(squadron)} />, {
    squadron,
    uiVersion: "muster",
  });

const cards = () => [...screen.getByLabelText("Flight Standings").querySelectorAll("article")];

describe("standings", () => {
  it("shows only the flights that compete", () => {
    const { data } = renderView();
    // The fixture's staff flight does not compete and one flight is archived.
    expect(cards().length).toBeGreaterThan(0);
    expect(cards().length).toBeLessThan(data.cadets.length);
    expect(cards().some((card) => card.textContent.includes("Staff Team"))).toBe(false);
  });

  it("orders them by total, highest first", () => {
    renderView();
    const totals = cards().map((card) =>
      Number(card.textContent.match(/(\d+)\s*points/)[1])
    );
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
  });

  it("numbers the positions", () => {
    renderView();
    expect(cards()[0].textContent.startsWith("1")).toBe(true);
  });

  /*
   * The fair comparison, next to the headline one rather than buried.
   */
  it("shows points per cadet alongside the raw total", () => {
    renderView();
    expect(cards()[0].textContent).toMatch(/per cadet/);
    expect(cards()[0].textContent).toMatch(/cadets?$/);
  });

  it("says who leads and by how much", () => {
    renderView();
    expect(screen.getByText(/leads .* by \d+/)).toBeInTheDocument();
  });
});

describe("the year line", () => {
  it("draws one line per competing flight", () => {
    const { container } = renderView();
    expect(container.querySelectorAll("polyline")).toHaveLength(cards().length);
  });

  it("describes itself for anyone who cannot see it", () => {
    renderView();
    const chart = screen.getByRole("img");
    expect(chart.getAttribute("aria-label")).toMatch(/finished on \d+ points/);
  });
});

describe("contributors", () => {
  it("lists the biggest scorers, highest first", () => {
    const { container } = renderView();
    const points = [...container.querySelectorAll("tbody tr")].map((row) =>
      Number(row.lastElementChild.textContent)
    );
    expect(points.length).toBeGreaterThan(0);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });

  it("says why the list is there", () => {
    renderView();
    expect(screen.getByText(/before the standings are read out/i)).toBeInTheDocument();
  });
});
