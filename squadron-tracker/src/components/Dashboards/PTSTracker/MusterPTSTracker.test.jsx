/**
 * The Muster PTS board.
 *
 * Two behaviours carry the screen and neither is obvious from reading it:
 * a cell shows the HIGHEST badge held rather than all of them, and an empty
 * column is called out by name. The second is the more useful one -- a
 * syllabus area nobody holds anything in is invisible on a board that only
 * shows what people have.
 *
 * The filters have the most tests here, because this screen shipped without
 * them and they are the reason it gets opened: "who got a Bronze this year"
 * is a question about a slice of the log. The one that matters most is the
 * combination -- "highest held" has to mean "highest of the levels still
 * switched on", or the board quietly contradicts the filter above it.
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

/*
 * Fixture facts these tests lean on, all from dummyData:
 *   Amelia Hart    Radio Blue 2024-03-12, Bronze 2024-11-05, Silver 2025-04-18
 *   Grace O'Neill  Radio Blue 2024-10-08
 *   Harry B-J      Shooting Gold 2024-04-02  (his only badge)
 *   Jack Petrov    First Aid Bronze 2024-12-03, Silver 2025-06-01
 *   Eve Nakamura   Adventure Training Silver 2024-08-19, Gold 2025-01-30
 */

/** A level toggle in the toolbar, on or off. */
const chipFor = (level) =>
  screen.getAllByRole("button").find(
    (button) => button.textContent.trim() === level && button.hasAttribute("aria-pressed")
  );

/** The count on one of the tiles along the top. */
const tileFor = (level) =>
  within(screen.getByLabelText("Badges Awarded")).getByText(level).closest("div").parentElement;

describe("filtering by badge level", () => {
  it("starts with every level showing", () => {
    renderView();
    ["Blue", "Bronze", "Silver", "Gold"].forEach((level) => {
      expect(chipFor(level)).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("falls back to the highest level still switched on", async () => {
    /*
     * The one that would break quietly. Amelia holds Blue, Bronze AND Silver
     * Radio; with Silver switched off her cell is Bronze -- not Silver, and
     * not empty.
     */
    const { user, container } = renderView();
    await user.click(chipFor("Silver"));

    const amelia = rowFor(container, "Amelia Hart");
    expect(amelia.textContent).toContain("05 Nov 2024");
    expect(amelia.textContent).not.toContain("18 Apr 2025");
  });

  it("hides that level's columns in the expanded view", async () => {
    const { user, container } = renderView();
    await user.click(screen.getByRole("button", { name: "Every Level" }));
    expect(headers(container).filter((header) => header === "Gold").length).toBeGreaterThan(0);

    await user.click(chipFor("Gold"));
    expect(headers(container).filter((header) => header === "Gold")).toEqual([]);
  });

  it("counts only the levels still showing", async () => {
    const { user, container } = renderView();
    const held = (name) => Number([...rowFor(container, name).cells].at(-1).textContent);
    expect(held("Amelia Hart")).toBe(1);

    await user.click(chipFor("Silver"));
    await user.click(chipFor("Bronze"));
    await user.click(chipFor("Blue"));
    expect(held("Amelia Hart")).toBe(0);
  });

  it("turns them all off and all back on", async () => {
    const { user } = renderView();
    await user.click(screen.getByRole("button", { name: "None" }));
    ["Blue", "Bronze", "Silver", "Gold"].forEach((level) => {
      expect(chipFor(level)).toHaveAttribute("aria-pressed", "false");
    });

    await user.click(screen.getByRole("button", { name: "All" }));
    ["Blue", "Bronze", "Silver", "Gold"].forEach((level) => {
      expect(chipFor(level)).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("keeps the strip's totals honest when a level is excluded", async () => {
    /*
     * A Blue tile reading 0 because Blue is switched off would be a lie about
     * the squadron. The tile dims instead; the number stays true.
     */
    const { user } = renderView();
    const before = tileFor("Blue").textContent;

    await user.click(chipFor("Blue"));
    expect(tileFor("Blue").textContent).toBe(before);
  });
});

describe("filtering by when the badge was awarded", () => {
  const useRange = async (user, fromYear, toYear) => {
    await user.selectOptions(screen.getByLabelText("Awarded"), "range");
    const years = screen.getAllByLabelText("Year");
    await user.selectOptions(screen.getByLabelText("From"), "01");
    await user.selectOptions(years[0], fromYear);
    await user.selectOptions(screen.getByLabelText("To"), "12");
    await user.selectOptions(years[1], toYear);
  };

  it("shows the range controls only once a range is chosen", async () => {
    const { user } = renderView();
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Awarded"), "range");
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Year")).toHaveLength(2);
  });

  it("offers every year a badge was actually awarded in", async () => {
    const { user } = renderView();
    await user.selectOptions(screen.getByLabelText("Awarded"), "range");
    const years = [...screen.getAllByLabelText("Year")[0].options].map((option) => option.value);
    expect(years).toEqual(["2024", "2025"]);
  });

  it("drops awards from outside the window", async () => {
    const { user, container } = renderView();
    await useRange(user, "2025", "2025");

    // Grace's only Radio badge is from October 2024.
    expect(rowFor(container, "Grace O'Neill").textContent).not.toContain("08 Oct 2024");
    // Amelia's Silver is April 2025, and survives.
    expect(rowFor(container, "Amelia Hart").textContent).toContain("18 Apr 2025");
  });

  it("falls back to the highest award inside the window", async () => {
    // Jack holds Bronze (Dec 2024) and Silver (Jun 2025) First Aid.
    const { user, container } = renderView();
    await useRange(user, "2024", "2024");

    expect(rowFor(container, "Jack Petrov").textContent).toContain("03 Dec 2024");
    expect(rowFor(container, "Jack Petrov").textContent).not.toContain("01 Jun 2025");
  });

  it("counts the strip's totals within the window too", async () => {
    const { user } = renderView();
    // Harry's Shooting Gold (Apr 2024) and Eve's Adventure Training Gold (Jan 2025).
    expect(tileFor("Gold").textContent).toContain("2");

    await useRange(user, "2025", "2025");
    expect(tileFor("Gold").textContent).toContain("1");
  });
});

describe("a badge the filter is hiding", () => {
  /*
   * The duplicate-award guard, and the whole reason `everHeld` exists.
   *
   * An empty summary cell is a button that awards that badge. If a cadet's
   * only badge in an area is filtered out and the cell falls back to that
   * button, the obvious next click awards a badge they already hold.
   */
  it("shows a dash rather than offering to award it again", async () => {
    const { user, container } = renderView();
    await user.click(chipFor("Gold"));

    const harry = rowFor(container, "Harry Blythe-Jones");
    expect(
      within(harry).queryByRole("button", { name: /Award a Shooting badge/ })
    ).not.toBeInTheDocument();
    expect(within(harry).getByTitle("Held, but outside the current filter")).toBeInTheDocument();
  });

  it("still offers an award where the cadet holds nothing at all", async () => {
    const { user, container } = renderView();
    await user.click(chipFor("Gold"));

    // Harry has never held a Radio badge, filter or no filter.
    const harry = rowFor(container, "Harry Blythe-Jones");
    expect(within(harry).getByRole("button", { name: /Award a Radio badge/ })).toBeInTheDocument();
  });
});
