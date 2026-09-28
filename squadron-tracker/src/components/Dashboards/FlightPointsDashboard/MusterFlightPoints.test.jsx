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
import { screen, waitFor, within } from "@testing-library/react";

import MusterFlightPoints from "./MusterFlightPoints";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { SQUADRONS, userFor } from "../../../test/dummyData";
import { getCadetPoints } from "../../../utils/points";

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

describe("points allocated to a flight", () => {
  /*
   * Team points are staff allocations -- a tug of war, a tidy hangar -- kept
   * in their own document rather than in the event log, so they need a read
   * of their own.
   *
   * This screen shipped without that read, which made the standings quietly
   * wrong rather than visibly incomplete: the fixture allocates 40 to Alpha
   * and 25 to Bravo, and both were simply missing from the totals with
   * nothing to say a number had been left out. The classic screen has always
   * added them. These tests exist because that failure is invisible.
   */
  const cardFor = (name) =>
    cards().find((card) => card.textContent.includes(name));

  it("adds the allocation to the flight's total", async () => {
    const { data } = renderView();

    await waitFor(() => {
      const alpha = cardFor("Alpha");
      const earned = (data.cadets || [])
        .filter((cadet) => Number(cadet.flight) === 2)
        .reduce(
          (sum, cadet) =>
            sum +
            getCadetPoints(
              `${cadet.forename} ${cadet.surname}`,
              String(new Date().getFullYear()),
              data.events,
              data.flightPoints
            ),
          0
        );
      // 40 is the fixture's allocation to flight 2.
      expect(alpha.textContent).toContain(String(earned + 40));
    });
  });

  it("allocates points to a flight", async () => {
    const { user, writes } = renderView();
    await user.click(screen.getByRole("button", { name: "Allocate Points" }));

    const dialog = within(screen.getByRole("dialog"));
    await user.selectOptions(dialog.getByLabelText("Flight"), "2");
    await user.type(dialog.getByLabelText("Points"), "15");
    await user.click(dialog.getByRole("button", { name: "Allocate Points" }));

    await waitFor(() => {
      const teamWrites = writes().filter((write) => write.path.includes("TeamPoints"));
      expect(teamWrites.length).toBeGreaterThan(0);
    });
  });

  it("refuses an allocation with no flight chosen", async () => {
    const { user, writes } = renderView();
    await user.click(screen.getByRole("button", { name: "Allocate Points" }));

    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Points"), "15");
    await user.click(dialog.getByRole("button", { name: "Allocate Points" }));

    expect(dialog.getByText("Choose a flight.")).toBeInTheDocument();
    expect(writes().filter((write) => write.path.includes("TeamPoints"))).toHaveLength(0);
  });

  it("refuses an allocation with no points", async () => {
    const { user, writes } = renderView();
    await user.click(screen.getByRole("button", { name: "Allocate Points" }));

    const dialog = within(screen.getByRole("dialog"));
    await user.selectOptions(dialog.getByLabelText("Flight"), "2");
    await user.click(dialog.getByRole("button", { name: "Allocate Points" }));

    expect(dialog.getByText(/Enter the number of points/)).toBeInTheDocument();
    expect(writes().filter((write) => write.path.includes("TeamPoints"))).toHaveLength(0);
  });

  it("offers the staff flight too, which earns no cadet points", async () => {
    // Allocation is not limited to competing flights in the classic screen.
    const { user } = renderView();
    await user.click(screen.getByRole("button", { name: "Allocate Points" }));

    const choices = [...within(screen.getByRole("dialog")).getByLabelText("Flight").options].map(
      (option) => option.textContent
    );
    expect(choices).toEqual(expect.arrayContaining(["Staff Team", "Alpha", "Bravo"]));
  });
});
