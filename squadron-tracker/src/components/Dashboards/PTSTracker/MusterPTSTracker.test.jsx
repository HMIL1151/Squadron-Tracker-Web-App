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

const renderView = (options = {}) =>
  renderWithProviders(<MusterPTSTracker user={userFor(SQUADRONS.FAKETON)} />, {
    squadron: SQUADRONS.FAKETON,
    uiVersion: "muster",
    ...options,
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
    // Silver Radio was awarded 2025-04-18; Blue and Bronze are older.
    expect(amelia.textContent).toContain("18 Apr 2025");
    expect(amelia.textContent).not.toContain("12 Mar 2024");
  });

  /*
   * The date, not the level name. A chip reading "Silver" repeats what its
   * colour already says; the date answers "when", which is what staff open
   * this board for. The level stays available to a screen reader.
   */
  it("shows when the badge was awarded rather than repeating its level", () => {
    const { container } = renderView();
    const amelia = rowFor(container, "Amelia Hart");
    const cell = within(amelia).getByTitle("Silver Radio");
    expect(cell.textContent).toContain("18 Apr 2025");
    expect(cell.textContent).toContain("Silver");
  });

  /*
   * An empty cell is how you award a badge from this screen, which is the
   * behaviour the classic tracker had and the first Muster version lost.
   */
  it("offers an empty cell as a way to award that badge", () => {
    const { container } = renderView();
    const isla = rowFor(container, "Isla Muir");
    expect(
      within(isla).getAllByRole("button", { name: /^Award a .* badge to Isla Muir$/ }).length
    ).toBeGreaterThan(0);
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

describe("the two views", () => {
  it("starts on the summary, one column per syllabus area", () => {
    const { container } = renderView();
    const heads = headers(container);
    expect(heads).toEqual(expect.arrayContaining(["Radio", "Shooting"]));
    expect(heads.filter((h) => h === "Blue")).toHaveLength(0);
  });

  /*
   * The expanded view is not decoration. The summary shows one cell per area,
   * so a cadet holding Silver Radio has nowhere to click to record the Bronze
   * they were awarded late -- the classic layout is the only one that can
   * express a badge below a level already held.
   */
  it("expands to four levels per area", async () => {
    const { container, user } = renderView();
    await user.click(screen.getByRole("button", { name: "Every Level" }));

    const heads = headers(container);
    expect(heads.filter((h) => h === "Blue").length).toBeGreaterThan(1);
    expect(heads.filter((h) => h === "Gold").length).toBeGreaterThan(1);
  });

  it("names each area once, over its four columns", async () => {
    const { container, user } = renderView();
    await user.click(screen.getByRole("button", { name: "Every Level" }));

    const groupRow = container.querySelector("thead tr");
    const radio = [...groupRow.children].find((cell) => cell.textContent === "Radio");
    expect(radio).toBeDefined();
    expect(radio.getAttribute("colspan")).toBe("4");
  });

  it("takes the level from the column when awarding from the expanded view", async () => {
    const { container, user } = renderView();
    await user.click(screen.getByRole("button", { name: "Every Level" }));

    const add = container.querySelector("tbody button");
    await user.click(add);

    expect(screen.getByText(/Taken from the column you clicked/i)).toBeInTheDocument();
  });
});

describe("awards by level", () => {
  it("counts every badge in the log by its level", () => {
    const { data } = renderView();
    const strip = screen.getByLabelText("Badges Awarded");
    const gold = data.events.filter((event) => event.badgeLevel === "Gold").length;
    expect(within(strip).getByText("Gold").closest("div").parentElement.textContent).toContain(
      String(gold)
    );
  });

  /*
   * The point of the strip. A subject the squadron has never run does not
   * appear anywhere else on the screen.
   */
  /*
   * The point of the strip. A subject the squadron has never run does not
   * appear anywhere else on the screen -- an empty column looks the same as a
   * column nobody has got round to.
   *
   * The shared fixture happens to cover every area, so the gap case needs its
   * own dataset rather than a lucky fixture.
   */
  it("names syllabus areas nobody holds a badge in", () => {
    renderView({
      data: {
        cadets: [
          { id: "c1", forename: "Test", surname: "Cadet", flight: 2, startDate: "2024-01-01" },
        ],
        events: [
          {
            id: "e1",
            cadetName: "Test Cadet",
            date: "2025-03-01",
            badgeCategory: "Radio",
            badgeLevel: "Blue",
            examName: "",
            eventName: "",
            eventCategory: "",
            specialAward: "",
          },
        ],
        flightPoints: { Badges: { "Badge Types": ["Radio", "Music", "Cyber"] } },
      },
    });

    const strip = screen.getByLabelText("Badges Awarded");
    expect(within(strip).getByText("Music")).toBeInTheDocument();
    expect(within(strip).getByText("Cyber")).toBeInTheDocument();
    expect(within(strip).queryByText("Radio")).not.toBeInTheDocument();
  });

  it("says so plainly when every area is covered", () => {
    renderView();
    // The shared fixture has at least one badge in every configured area.
    expect(screen.getByText("Every Area Covered")).toBeInTheDocument();
  });
});
