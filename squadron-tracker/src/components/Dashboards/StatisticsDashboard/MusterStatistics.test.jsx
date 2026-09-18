/**
 * Squadron statistics.
 *
 * Most of this screen is year-on-year, so most of what is worth testing is
 * that a figure and its comparison come from the same place. "284 records"
 * next to a change of "+74" is only useful if both were counted the same way.
 *
 * The other thing held still here is what the page REFUSES to show. Attendance
 * was on this page and was taken off, because the app has no attendance model
 * -- only parade-night records, written when someone remembers. It reported
 * 10% for a squadron whose cadets all turned up, which is worse than silence.
 * The footnote saying so is tested, because the obvious "improvement" someone
 * makes later is to put a number back.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import MusterStatistics from "./MusterStatistics";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { SQUADRONS, userFor } from "../../../test/dummyData";

const renderView = (options = {}) =>
  renderWithProviders(<MusterStatistics user={userFor(SQUADRONS.FAKETON)} />, {
    squadron: SQUADRONS.FAKETON,
    uiVersion: "muster",
    ...options,
  });

/** The metric table's row for a given label, as text per cell. */
const metricRow = (label) => {
  const cell = screen.getByText(label);
  return [...cell.closest("tr").cells].map((c) => c.textContent.trim());
};

describe("the questions it asks", () => {
  it("leads each section with a question and answers it in a sentence", () => {
    renderView();
    expect(screen.getByRole("heading", { name: "How much is being recorded?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How does this year compare?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How do the flights compare?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Is everyone progressing?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Is recognition reaching everyone?" })).toBeInTheDocument();
  });
});

describe("what it refuses to measure", () => {
  /*
   * The regression guard. Attendance looked plausible and was wrong, and the
   * tempting fix is to put it back rather than to build an attendance model.
   */
  it("does not report attendance anywhere", () => {
    renderView();
    expect(screen.queryByText(/average attendance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/parade nights logged/i)).not.toBeInTheDocument();
  });

  it("says why attendance, retention and age profile are absent", () => {
    renderView();
    const note = screen.getByText(/no attendance model/i);
    expect(note.textContent).toMatch(/no discharge date and no date of birth/i);
    expect(note.textContent).toMatch(/schema change/i);
  });
});

describe("year on year", () => {
  it("gives every year with records a column", () => {
    const { data } = renderView();
    const logged = new Set(data.events.map((event) => event.date.slice(0, 4)));
    logged.forEach((year) => {
      expect(screen.getAllByText(year).length).toBeGreaterThan(0);
    });
  });

  it("compares the same metric it reports", () => {
    renderView();
    const row = metricRow("Records logged");
    // [label, ...one cell per year, change]
    expect(row.length).toBeGreaterThanOrEqual(3);
    expect(row[0]).toBe("Records logged");
  });

  it("shows a dash rather than a change for the earliest year", async () => {
    const { user } = renderView();
    const years = [...screen.getByLabelText("Year").options].map((o) => o.value);
    await user.selectOptions(screen.getByLabelText("Year"), years.at(-1));

    expect(metricRow("Records logged").at(-1)).toBe("—");
  });

  it("counts records for the chosen year, not for all time", async () => {
    const { user, data } = renderView();
    const years = [...screen.getByLabelText("Year").options].map((o) => o.value);
    const chosen = years[0];

    await user.selectOptions(screen.getByLabelText("Year"), chosen);

    const expected = data.events.filter((event) => event.date.startsWith(chosen)).length;
    expect(metricRow("Records logged")).toContain(String(expected));
  });
});

describe("flights", () => {
  it("reports points per cadet as well as the total", () => {
    renderView();
    expect(screen.getByRole("columnheader", { name: "Per Cadet" })).toBeInTheDocument();
  });

  it("shows how big each flight is, since the totals depend on it", () => {
    const { data } = renderView();
    const alpha = screen.getByText("Alpha").closest("th");
    const size = data.cadets.filter((cadet) => Number(cadet.flight) === 2).length;
    expect(alpha.textContent).toContain(String(size));
  });
});

describe("progression", () => {
  it("accounts for every cadet across the six rungs", () => {
    const { data } = renderView();
    const funnel = screen.getByText("Where the Squadron Sits").closest("article");
    const counts = [...funnel.querySelectorAll("li")].map((row) =>
      Number(row.lastElementChild.textContent)
    );
    expect(counts.reduce((a, b) => a + b, 0)).toBe(data.cadets.length);
  });
});

describe("cadets with nothing recorded", () => {
  /*
   * Isla has no events at all in the fixture, deliberately. She is exactly the
   * person this panel exists to surface.
   */
  it("names them rather than counting them", () => {
    renderView();
    const alert = screen.getByText(/no record this year/i).closest("article");
    expect(within(alert).getByText("Isla Muir")).toBeInTheDocument();
  });

  it("explains that they are on the books, not missing", () => {
    renderView();
    expect(
      screen.getByText(/on the books. Nothing has been logged against them/i)
    ).toBeInTheDocument();
  });
});
