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
 * them and they are the reason it gets opened: "who has their DofE" and "who
 * got a Bronze this year" are questions about a slice of the log. The one
 * that matters most is the combination -- "highest held" has to mean "highest
 * of the levels still switched on", or the board quietly contradicts the
 * filter above it.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import MusterPTSTracker from "./MusterPTSTracker";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { SQUADRONS, dataContextFor, userFor } from "../../../test/dummyData";

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

/*
 * The board opens on Every Level, so anything about the one-cell-per-area
 * view has to ask for it. Worth the extra line in each test: which view is
 * being described is then written down rather than inherited.
 */
const showSummary = (user) => user.click(screen.getByRole("button", { name: "Highest Held" }));

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
  it("shows only the highest badge held in an area", async () => {
    const { container, user } = renderView();
    await showSummary(user);
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
  it("shows when the badge was awarded rather than repeating its level", async () => {
    const { container, user } = renderView();
    await showSummary(user);
    const amelia = rowFor(container, "Amelia Hart");
    const cell = within(amelia).getByTitle("Silver Radio");
    expect(cell.textContent).toContain("18 Apr 2025");
    expect(cell.textContent).toContain("Silver");
  });

  /*
   * An empty cell is how you award a badge from this screen, which is the
   * behaviour the classic tracker had and the first Muster version lost.
   */
  it("offers an empty cell as a way to award that badge", async () => {
    const { container, user } = renderView();
    await showSummary(user);
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
  it("opens on Every Level, the way the classic tracker did", () => {
    /*
     * "Highest held" is the tidier board and was the original default. The
     * question people bring to this screen is which badges a cadet has, not
     * how far up one ladder they got.
     */
    const { container } = renderView();
    const heads = headers(container);
    expect(heads.filter((head) => head === "Blue").length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: "Every Level" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("folds down to one column per syllabus area", async () => {
    const { container, user } = renderView();
    await showSummary(user);

    const heads = headers(container);
    expect(heads).toEqual(expect.arrayContaining(["Radio", "Shooting"]));
    expect(heads.filter((head) => head === "Blue")).toHaveLength(0);
  });

  /*
   * The expanded view is not decoration. The summary shows one cell per area,
   * so a cadet holding Silver Radio has nowhere to click to record the Bronze
   * they were awarded late -- the classic layout is the only one that can
   * express a badge below a level already held.
   */
  it("expands to four levels per area", async () => {
    const { container, user } = renderView();
    await showSummary(user);
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

/*
 * Fixture facts these tests lean on, all from dummyData:
 *   Amelia Hart    Radio Blue 2024-03-12, Bronze 2024-11-05, Silver 2025-04-18
 *   Grace O'Neill  Radio Blue 2024-10-08
 *   Harry B-J      Shooting Gold 2024-04-02  (his only badge)
 *   Jack Petrov    First Aid Bronze 2024-12-03, Silver 2025-06-01
 *   Eve Nakamura   Adventure Training Silver 2024-08-19, Gold 2025-01-30
 */

/*
 * The two filter rows are fieldsets, so each is a group with a name -- which
 * is what keeps "All" and "None" unambiguous now that both rows have a pair.
 */
const levelRow = () => within(screen.getByRole("group", { name: "Badge levels to show" }));
const subjectRow = () => within(screen.getByRole("group", { name: "Syllabus areas to show" }));

/** A level toggle. Its accessible name carries the count, so match the start. */
const chipFor = (level) => levelRow().getByRole("button", { name: new RegExp("^" + level) });

/** What the level chip reads, count and all. */
const chipText = (level) => chipFor(level).textContent;

describe("the count beside each level", () => {
  /*
   * The counts used to be five tiles above the board, deep enough to cost a
   * third of the visible rows on a 900px window. They ride on the filters
   * now, which is both smaller and more use: the control and the number it
   * refers to are the same object.
   */
  it("counts every badge in the log by its level", () => {
    renderView({
      data: {
        events: [
          {
            cadetName: "Amelia Hart",
            date: "2025-01-05",
            badgeCategory: "Radio",
            badgeLevel: "Blue",
            examName: "",
            eventName: "",
            eventCategory: "",
            specialAward: "",
          },
          {
            cadetName: "Ben Okafor",
            date: "2025-02-05",
            badgeCategory: "Radio",
            badgeLevel: "Blue",
            examName: "",
            eventName: "",
            eventCategory: "",
            specialAward: "",
          },
          {
            cadetName: "Ben Okafor",
            date: "2025-03-05",
            badgeCategory: "Radio",
            badgeLevel: "Gold",
            examName: "",
            eventName: "",
            eventCategory: "",
            specialAward: "",
          },
        ],
      },
    });

    expect(chipText("Blue")).toContain("2");
    expect(chipText("Gold")).toContain("1");
    expect(chipText("Silver")).toContain("0");
  });

  it("names syllabus areas nobody holds a badge in", () => {
    /*
     * The one fact the board cannot show. An area nobody has a badge in is an
     * empty column, and an empty column is invisible on a screen that only
     * displays what people have.
     */
    renderView({
      data: {
        events: [
          {
            cadetName: "Amelia Hart",
            date: "2025-01-05",
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

    const gaps = screen.getByLabelText("Syllabus Gaps");
    expect(within(gaps).getByText("Music")).toBeInTheDocument();
    expect(within(gaps).getByText("Cyber")).toBeInTheDocument();
    expect(within(gaps).queryByText("Radio")).not.toBeInTheDocument();
  });

  it("says nothing at all when every area is covered", () => {
    // The shared fixture has at least one badge in every configured area.
    renderView();
    expect(screen.queryByLabelText("Syllabus Gaps")).not.toBeInTheDocument();
  });
});

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
    await user.click(levelRow().getByRole("button", { name: "None" }));
    ["Blue", "Bronze", "Silver", "Gold"].forEach((level) => {
      expect(chipFor(level)).toHaveAttribute("aria-pressed", "false");
    });

    await user.click(levelRow().getByRole("button", { name: "All" }));
    ["Blue", "Bronze", "Silver", "Gold"].forEach((level) => {
      expect(chipFor(level)).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("keeps its own count honest when it is switched off", async () => {
    /*
     * "Blue 0" because Blue is switched off would be a lie about the
     * squadron. The chip goes pale; the number stays true.
     */
    const { user } = renderView();
    const before = chipText("Blue");

    await user.click(chipFor("Blue"));
    expect(chipFor("Blue")).toHaveAttribute("aria-pressed", "false");
    expect(chipText("Blue")).toBe(before);
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

  it("counts within the window too", async () => {
    const { user } = renderView();
    // Harry's Shooting Gold (Apr 2024) and Eve's Adventure Training Gold (Jan 2025).
    expect(chipText("Gold")).toContain("2");

    await useRange(user, "2025", "2025");
    expect(chipText("Gold")).toContain("1");
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
    await showSummary(user);
    await user.click(chipFor("Gold"));

    const harry = rowFor(container, "Harry Blythe-Jones");
    expect(
      within(harry).queryByRole("button", { name: /Award a Shooting badge/ })
    ).not.toBeInTheDocument();
    expect(within(harry).getByTitle("Held, but outside the current filter")).toBeInTheDocument();
  });

  it("still offers an award where the cadet holds nothing at all", async () => {
    const { user, container } = renderView();
    await showSummary(user);
    await user.click(chipFor("Gold"));

    // Harry has never held a Radio badge, filter or no filter.
    const harry = rowFor(container, "Harry Blythe-Jones");
    expect(within(harry).getByRole("button", { name: /Award a Radio badge/ })).toBeInTheDocument();
  });
});

describe("filtering by syllabus area", () => {
  const subjectChip = (name) => subjectRow().getByRole("button", { name });

  it("drops that area's column from the board", async () => {
    /*
     * A click hides the thing you clicked. An earlier version made the first
     * click mean "only this one", which turned hiding a single subject into
     * hiding every other subject.
     */
    const { user, container } = renderView();
    expect(headers(container)).toEqual(expect.arrayContaining(["Radio"]));

    await user.click(subjectChip("Radio"));
    expect(headers(container)).not.toEqual(expect.arrayContaining(["Radio"]));
    expect(headers(container)).toEqual(expect.arrayContaining(["Shooting", "Music"]));
  });

  it("shows one area on its own in two clicks", async () => {
    // None, then the one you want -- the same gesture as the classic tracker.
    const { user, container } = renderView();
    await user.click(subjectRow().getByRole("button", { name: "None" }));
    await user.click(subjectChip("Radio"));

    expect(headers(container).filter((header) => header === "Radio")).toHaveLength(1);
    ["Shooting", "Music", "First Aid"].forEach((area) => {
      expect(headers(container)).not.toEqual(expect.arrayContaining([area]));
    });
  });

  it("counts only the areas still showing", async () => {
    // Amelia holds Radio in the fixture and nothing else.
    const { user, container } = renderView();
    const held = (name) => Number([...rowFor(container, name).cells].at(-1).textContent);
    expect(held("Amelia Hart")).toBe(1);

    await user.click(subjectChip("Radio"));
    expect(held("Amelia Hart")).toBe(0);
  });

  it("counts the levels within the chosen areas", async () => {
    /*
     * Amelia's Silver Radio is the only Silver Radio in the fixture, so
     * dropping Radio has to move the Silver count.
     */
    const { user } = renderView();
    const before = chipText("Silver");

    await user.click(subjectChip("Radio"));
    expect(chipText("Silver")).not.toBe(before);
  });

  it("restores every area", async () => {
    const { user, container } = renderView();
    await user.click(subjectChip("Radio"));
    await user.click(subjectRow().getByRole("button", { name: "All" }));

    expect(headers(container)).toEqual(
      expect.arrayContaining(["Radio", "Shooting", "Music", "First Aid"])
    );
  });
});

describe("the totals row", () => {
  /*
   * The classic tracker counts, under each badge column, how many cadets hold
   * it. That is "how many have their Blue First Aid", which the squadron-wide
   * count on the level chips cannot answer -- it counts Blues of every
   * subject. This screen had no totals at all.
   */
  const totalsCells = (container) =>
    [...container.querySelectorAll("tfoot td")].map((cell) => cell.textContent.trim());

  it("counts how many cadets hold each badge", async () => {
    const { user, container, data } = renderView();
    await user.click(screen.getByRole("button", { name: "Highest Held" }));

    const radioAt = headers(container).indexOf("Radio");
    expect(radioAt).toBeGreaterThan(-1);

    const holders = new Set(
      (data.events || [])
        .filter((event) => event.badgeCategory === "Radio" && event.badgeLevel)
        .map((event) => event.cadetName)
    );
    expect(totalsCells(container)[radioAt]).toBe(String(holders.size));
  });

  it("totals the badges held across the squadron", async () => {
    const { user, container } = renderView();
    await user.click(screen.getByRole("button", { name: "Highest Held" }));

    const held = [...container.querySelectorAll("tbody tr")].map((row) =>
      Number([...row.cells].at(-1).textContent)
    );
    const sum = held.reduce((a, b) => a + b, 0);
    expect(totalsCells(container).at(-1)).toBe(String(sum));
  });

  it("counts only what the filters leave showing", async () => {
    // A total that ignores the filter above it is the same lie as a tile that does.
    const { user, container } = renderView();
    await user.click(screen.getByRole("button", { name: "Highest Held" }));
    const before = totalsCells(container).at(-1);

    await user.click(chipFor("Blue"));
    await user.click(chipFor("Bronze"));
    await user.click(chipFor("Silver"));
    await user.click(chipFor("Gold"));

    expect(totalsCells(container).at(-1)).not.toBe(before);
    expect(totalsCells(container).at(-1)).toBe("0");
  });
});


/*
 * Weapon handling tests. The frozen clock is 2025-06-15, so a 12-month pass
 * from 2024-06-15 runs out today and one from 2024-06-16 runs out tomorrow.
 */
describe("weapon handling tests", () => {
  const withWeapons = () => {
    const base = dataContextFor(SQUADRONS.FAKETON);
    const pass = (id, cadetName, weaponName, date) => ({
      id,
      cadetName,
      weaponName,
      date,
      badgeCategory: "",
      badgeLevel: "",
      examName: "",
      eventName: "",
      eventCategory: "",
      specialAward: "",
    });
    return {
      ...base,
      flightPoints: { ...base.flightPoints, Weapons: { Rifle: 12, Pistol: 6 } },
      events: [
        ...base.events,
        pass("wht-1", "Amelia Hart", "Rifle", "2024-06-15"),
        pass("wht-2", "Isla Muir", "Rifle", "2024-06-16"),
        pass("wht-3", "Isla Muir", "Pistol", "2024-01-01"),
        pass("wht-4", "Isla Muir", "Pistol", "2025-03-01"),
      ],
    };
  };

  const renderWeapons = () => renderView({ data: withWeapons() });

  it("gives every configured weapon a column, in both views", async () => {
    const { container, user } = renderWeapons();
    expect(headers(container)).toEqual(expect.arrayContaining(["Weapon Handling", "Pistol", "Rifle"]));
    await showSummary(user);
    expect(headers(container)).toEqual(expect.arrayContaining(["Pistol", "Rifle"]));
  });

  it("has no weapon columns until a weapon is configured", () => {
    const { container } = renderView();
    expect(headers(container)).not.toContain("Weapon Handling");
  });

  it("turns a pass red on the day it runs out", () => {
    const { container } = renderWeapons();
    const amelia = within(rowFor(container, "Amelia Hart"));
    expect(amelia.getByRole("button", { name: /Expired 15 Jun 2025/ })).toBeInTheDocument();

    const isla = within(rowFor(container, "Isla Muir"));
    expect(isla.getByRole("button", { name: /In date until 16 Jun 2025/ })).toBeInTheDocument();
  });

  it("goes by the latest pass, not the first", () => {
    // Isla's January 2024 Pistol pass expired long ago; March 2025 has not.
    const { container } = renderWeapons();
    const isla = within(rowFor(container, "Isla Muir"));
    expect(isla.getByRole("button", { name: /01 Mar 2025.*In date until 01 Sept? 2025/ })).toBeInTheDocument();
  });

  it("counts only cadets who are in date", () => {
    const { container } = renderWeapons();
    const heads = [...container.querySelectorAll("thead tr:last-child th")].map((th) => th.textContent);
    const totals = [...container.querySelectorAll("tfoot td, tfoot th")].map((cell) => cell.textContent);
    // Rifle: Amelia expired, Isla in date.
    expect(totals[heads.indexOf("Rifle")]).toBe("1");
  });

  it("records a pass from an empty cell, as an event log record", async () => {
    const { container, user, writes } = renderWeapons();
    const ben = within(rowFor(container, "Ben Okafor"));
    await user.click(ben.getByRole("button", { name: "Record a Rifle handling test for Ben Okafor" }));
    await user.type(screen.getByLabelText("Date passed"), "2025-06-10");
    await user.click(screen.getByRole("button", { name: "Record Pass" }));

    const written = writes().filter((w) => w.path.includes("/EventLog/"));
    expect(written).toHaveLength(1);
    expect(written[0].data).toMatchObject({
      cadetName: "Ben Okafor",
      weaponName: "Rifle",
      date: "2025-06-10",
    });
    expect(
      within(rowFor(container, "Ben Okafor")).getByRole("button", { name: /In date until 10 Jun 2026/ })
    ).toBeInTheDocument();
  });

  it("records a re-test over an expired pass", async () => {
    const { container, user, writes } = renderWeapons();
    await user.click(
      within(rowFor(container, "Amelia Hart")).getByRole("button", { name: /Expired 15 Jun 2025/ })
    );
    expect(screen.getByText(/Last passed 15 Jun 2024/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Date passed"), "2025-06-14");
    await user.click(screen.getByRole("button", { name: "Record Pass" }));

    expect(writes().filter((w) => w.path.includes("/EventLog/"))).toHaveLength(1);
    expect(
      within(rowFor(container, "Amelia Hart")).getByRole("button", { name: /In date until 14 Jun 2026/ })
    ).toBeInTheDocument();
  });

  it("ignores the level filter, which is about what was awarded when", async () => {
    const { container, user } = renderWeapons();
    const levels = within(screen.getByRole("group", { name: "Badge levels to show" }));
    await user.click(levels.getByRole("button", { name: "None" }));
    expect(headers(container)).not.toContain("Blue");
    expect(headers(container)).toEqual(expect.arrayContaining(["Rifle", "Pistol"]));
  });

  it("has a Subjects chip of its own that shows and hides the columns", async () => {
    const { container, user } = renderWeapons();
    const chip = screen.getByRole("button", { name: "Weapon Handling" });
    expect(chip).toHaveAttribute("aria-pressed", "true");

    await user.click(chip);
    expect(headers(container)).not.toContain("Rifle");
    expect(headers(container)).not.toContain("Weapon Handling");
    // The badge subjects are untouched.
    expect(headers(container)).toContain("Radio");

    await user.click(chip);
    expect(headers(container)).toEqual(expect.arrayContaining(["Rifle", "Pistol"]));
  });

  it("goes with the other subjects on None, and comes back on All", async () => {
    const { container, user } = renderWeapons();
    const subjects = within(screen.getByRole("group", { name: "Syllabus areas to show" }));
    await user.click(subjects.getByRole("button", { name: "None" }));
    expect(headers(container)).not.toContain("Rifle");
    await user.click(subjects.getByRole("button", { name: "All" }));
    expect(headers(container)).toContain("Rifle");
  });

  /* "Only the WHTs" in two clicks, the same as any other subject. */
  it("shows the weapon columns on their own", async () => {
    const { container, user } = renderWeapons();
    const subjects = within(screen.getByRole("group", { name: "Syllabus areas to show" }));
    await user.click(subjects.getByRole("button", { name: "None" }));
    await user.click(subjects.getByRole("button", { name: "Weapon Handling" }));
    expect(headers(container)).toEqual(expect.arrayContaining(["Rifle", "Pistol"]));
    expect(headers(container)).not.toContain("Radio");
    expect(headers(container)).not.toContain("Flights");
  });

  it("offers no Weapon Handling chip until a weapon is configured", () => {
    renderView();
    expect(screen.queryByRole("button", { name: "Weapon Handling" })).not.toBeInTheDocument();
  });
});
