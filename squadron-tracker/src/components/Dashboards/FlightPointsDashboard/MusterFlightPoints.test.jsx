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

/*
 * Two tables now: the short "who is carrying each flight" list under the
 * chart, and the full roll beside it. Scoped by caption rather than by
 * position, so reordering the page does not silently test the other one.
 */
const tableWithCaption = (container, pattern) =>
  [...container.querySelectorAll("table")].find((table) =>
    pattern.test(table.querySelector("caption")?.textContent || "")
  );

const pointsColumn = (table) =>
  [...table.querySelectorAll("tbody tr")].map((row) => Number(row.lastElementChild.textContent));

describe("contributors", () => {
  it("lists the biggest scorers, highest first", () => {
    const { container } = renderView();
    const points = pointsColumn(tableWithCaption(container, /carrying each flight/i));
    expect(points.length).toBeGreaterThan(0);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });

  it("says why the list is there", () => {
    renderView();
    expect(screen.getByText(/before the standings are read out/i)).toBeInTheDocument();
  });
});

describe("the full roll", () => {
  /*
   * Duplicates a column of the cadet list on purpose. This is the screen open
   * when someone is working out who to chase, and sending them elsewhere to
   * find out who scored nothing turns one question into two screens.
   */
  it("lists every cadet, including the ones on nothing", () => {
    const { container, data } = renderView();
    const roll = tableWithCaption(container, /every cadet/i);
    expect(roll.querySelectorAll("tbody tr")).toHaveLength(data.cadets.length);
  });

  it("counts how many have scored nothing", () => {
    renderView();
    expect(screen.getByText(/\d+ on nothing/)).toBeInTheDocument();
  });

  it("is sorted by points, so the bottom of the list is the useful end", () => {
    const { container } = renderView();
    const points = pointsColumn(tableWithCaption(container, /every cadet/i));
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });
});
