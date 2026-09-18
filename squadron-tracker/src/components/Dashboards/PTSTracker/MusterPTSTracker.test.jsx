/**
 * The Muster PTS board.
 *
 * Two behaviours carry the screen and neither is obvious from reading it:
 * a cell shows the HIGHEST badge held rather than all of them, and an empty
 * column is called out by name. The second is the more useful one -- a
 * syllabus area nobody holds anything in is invisible on a board that only
 * shows what people have.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import MusterPTSTracker from "./MusterPTSTracker";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { SQUADRONS, userFor } from "../../../test/dummyData";

const renderView = (squadron = SQUADRONS.FAKETON) =>
  renderWithProviders(<MusterPTSTracker user={userFor(squadron)} />, {
    squadron,
    uiVersion: "muster",
  });

const headers = (container) =>
  [...container.querySelectorAll("thead th")].map((th) => th.textContent);
const rowFor = (container, name) =>
  [...container.querySelectorAll("tbody tr")].find((row) => row.textContent.includes(name));

describe("the board", () => {
  it("gives every syllabus area a column", () => {
    const { container } = renderView();
    expect(headers(container)).toEqual(
      expect.arrayContaining(["Radio", "Shooting", "First Aid"])
    );
  });

  /*
   * Amelia holds Blue, Bronze AND Silver Radio in the fixture. Listing all
   * three is three times the ink for one fact; the fact is how far up the
   * ladder she is.
   */
  it("shows only the highest badge held in an area", () => {
    const { container } = renderView();
    const amelia = rowFor(container, "Amelia Hart");
    expect(within(amelia).getByText("Silver")).toBeInTheDocument();
    expect(within(amelia).queryByText("Bronze")).not.toBeInTheDocument();
  });

  it("marks an area with nothing recorded, for a screen reader too", () => {
    const { container } = renderView();
    const isla = rowFor(container, "Isla Muir");
    expect(within(isla).getAllByText("No badge").length).toBeGreaterThan(0);
  });

  it("counts how many areas each cadet holds something in", () => {
    const { container } = renderView();
    const isla = rowFor(container, "Isla Muir");
    expect(isla.lastElementChild.textContent).toBe("0");
  });

  it("puts the cadets with the most badges first", () => {
    const { container } = renderView();
    const held = [...container.querySelectorAll("tbody tr")].map((row) =>
      Number(row.lastElementChild.textContent)
    );
    expect(held).toEqual([...held].sort((a, b) => b - a));
  });
});

describe("awards by level", () => {
  it("counts every badge in the log by its level", () => {
    const { data } = renderView();
    const strip = screen.getByLabelText("Badges awarded");
    const gold = data.events.filter((event) => event.badgeLevel === "Gold").length;
    expect(within(strip).getByText("Gold").closest("div").parentElement.textContent).toContain(
      String(gold)
    );
  });

  /*
   * The point of the strip. A subject the squadron has never run does not
   * appear anywhere else on the screen.
   */
  it("names syllabus areas nobody holds a badge in", () => {
    const { container } = renderView();
    const strip = screen.getByLabelText("Badges awarded");
    const configured = headers(container).slice(1, -1);
    const untouched = configured.filter((area) => {
      const rows = [...container.querySelectorAll("tbody tr")];
      const index = headers(container).indexOf(area);
      return rows.every((row) => row.cells[index].textContent.includes("No badge"));
    });

    untouched.forEach((area) => {
      expect(within(strip).getByText(area)).toBeInTheDocument();
    });
  });
});
