/**
 * Squadron statistics.
 *
 * A new screen, so everything here is new behaviour. Three things are worth
 * pinning down:
 *
 * The page answers questions rather than listing tiles, and each answer is a
 * sentence derived from the same data as the numbers under it. A sentence that
 * disagreed with its own section would be worse than no sentence.
 *
 * Attendance is inferred from parade-night records, which is the only evidence
 * the app holds. A squadron that does not log them must see an honest "cannot
 * be worked out" rather than 0%.
 *
 * The cadets with nothing recorded are named. That panel is the only thing on
 * the page anyone can act on today, and it is the one most likely to be
 * quietly dropped in a future edit.
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

describe("the four questions", () => {
  it("asks all four", () => {
    renderView();
    expect(screen.getByRole("heading", { name: "How much is being recorded?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Who is turning up?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Is everyone progressing?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Is recognition reaching everyone?" })).toBeInTheDocument();
  });

  it("answers each one in a sentence before showing any number", () => {
    renderView();
    expect(screen.getByText(/records across .* dates in/)).toBeInTheDocument();
    expect(screen.getByText(/top five hold \d+%/)).toBeInTheDocument();
  });
});

describe("what it refuses to guess", () => {
  /*
   * Retention needs a discharge date the app does not store, and the Admin
   * Area deletes cadets outright. Saying so is more useful than a chart built
   * on the start dates of the survivors, which could only ever rise.
   */
  it("says why retention and age profile are absent", () => {
    renderView();
    const note = screen.getByText(/no discharge date and no date of birth/i);
    expect(note).toBeInTheDocument();
    expect(note.textContent).toMatch(/schema change/i);
  });

  it("does not report an attendance rate when no parade nights are logged", () => {
    renderView({
      data: { cadets: [{ id: "c1", forename: "Test", surname: "Cadet", flight: 2, startDate: "2024-01-01" }], events: [], flightPoints: {} },
    });
    expect(screen.getByText(/No parade nights have been logged/i)).toBeInTheDocument();
  });
});

describe("progression", () => {
  it("shows every rung of the classification ladder", () => {
    renderView();
    const funnel = screen.getByText("Where the squadron sits").closest("article");
    ["Junior", "Second Class", "First Class", "Leading", "Senior", "Master"].forEach((rung) => {
      expect(within(funnel).getByText(rung)).toBeInTheDocument();
    });
  });

  it("accounts for every cadet in the funnel", () => {
    const { data } = renderView();
    const funnel = screen.getByText("Where the squadron sits").closest("article");
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
    expect(screen.getByText(/on the books. Nothing has been logged against them/i)).toBeInTheDocument();
  });

  it("says so plainly when everybody has something", () => {
    renderView({
      data: {
        cadets: [{ id: "c1", forename: "Test", surname: "Cadet", flight: 2, startDate: "2024-01-01" }],
        events: [
          { id: "e1", cadetName: "Test Cadet", date: "2025-03-01", eventName: "Weekly Parade", eventCategory: "Parade Night", examName: "", badgeLevel: "", badgeCategory: "", specialAward: "" },
        ],
        flightPoints: {},
      },
    });
    expect(screen.getByText("Everyone has something")).toBeInTheDocument();
  });
});
