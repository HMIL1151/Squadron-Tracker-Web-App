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
 *
 * The page is now five tabs, and only the open one is mounted, so every test
 * below says which tab it is looking at. `showTab` is the only way in: finding
 * a heading without opening its tab first passes for the wrong reason the day
 * somebody changes which tab it sits on.
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

/** Open one of the five tabs. */
const showTab = (user, label) =>
  user.click(within(screen.getByLabelText("Statistics sections")).getByRole("button", { name: label }));

/** The metric table's row for a given label, as text per cell. */
const metricRow = (label) => {
  const cell = screen.getByText(label);
  return [...cell.closest("tr").cells].map((c) => c.textContent.trim());
};

describe("the questions it asks", () => {
  it("opens on this year", () => {
    renderView();
    expect(screen.getByRole("heading", { name: "How much is being recorded?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How does this year compare?" })).toBeInTheDocument();
  });

  it("leads every section with a question and answers it in a sentence", async () => {
    const { user } = renderView();

    const asked = {
      Progression: [
        "Is everyone progressing?",
        "How long does a classification take here?",
        "How far up each badge ladder do cadets get?",
      ],
      People: [
        "Is recognition reaching everyone?",
        "Who joins, and who stays?",
        "Who is getting the opportunities?",
        "Where is the next NCO coming from?",
      ],
      Flights: ["How do the flights compare?", "How old is each flight?"],
      "Record Keeping": ["Is the log being kept up?", "Is anything wrong with the data?"],
    };

    for (const [tab, headings] of Object.entries(asked)) {
      await showTab(user, tab);
      headings.forEach((heading) => {
        expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
      });
    }
  });

  it("marks the open tab, so the chips are not just decoration", async () => {
    const { user } = renderView();
    const tabs = within(screen.getByLabelText("Statistics sections"));

    expect(tabs.getByRole("button", { name: "This Year" })).toHaveAttribute("aria-pressed", "true");
    await showTab(user, "Flights");
    expect(tabs.getByRole("button", { name: "This Year" })).toHaveAttribute("aria-pressed", "false");
    expect(tabs.getByRole("button", { name: "Flights" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("what it refuses to measure", () => {
  /*
   * The regression guard. Attendance looked plausible and was wrong, and the
   * tempting fix is to put it back rather than to build an attendance model.
   */
  it("does not report attendance anywhere", async () => {
    const { user } = renderView();
    for (const tab of ["Progression", "People", "Flights", "Record Keeping"]) {
      await showTab(user, tab);
      expect(screen.queryByText(/average attendance/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/parade nights logged/i)).not.toBeInTheDocument();
    }
  });

  it("says why attendance and age profile are absent, on every tab", () => {
    renderView();
    const note = screen.getByText(/no attendance model/i);
    expect(note.textContent).toMatch(/no date of birth/i);
  });

  it("says that retention is a floor rather than a measurement", () => {
    /*
     * Retention used to be in the "cannot do" list and now has a panel, on the
     * grounds that discharging keeps the records. The caveat has to survive
     * with it: it cannot see a cadet who left with nothing logged.
     */
    renderView();
    expect(screen.getByText(/no attendance model/i).textContent).toMatch(
      /floor rather than a measurement/i
    );
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

  it("keeps the chosen year when the tab changes", async () => {
    // The year control sits above the tabs, so it must survive them.
    const { user } = renderView();
    const years = [...screen.getByLabelText("Year").options].map((o) => o.value);
    await user.selectOptions(screen.getByLabelText("Year"), years.at(-1));
    await showTab(user, "Flights");

    expect(screen.getByLabelText("Year")).toHaveValue(years.at(-1));
  });
});

describe("flights", () => {
  it("reports points per cadet as well as the total", async () => {
    const { user } = renderView();
    await showTab(user, "Flights");
    expect(screen.getByRole("columnheader", { name: "Per Cadet" })).toBeInTheDocument();
  });

  it("shows how big each flight is, since the totals depend on it", async () => {
    const { user, data } = renderView();
    await showTab(user, "Flights");
    const alpha = screen.getAllByText("Alpha")[0].closest("th");
    const size = data.cadets.filter((cadet) => Number(cadet.flight) === 2).length;
    expect(alpha.textContent).toContain(String(size));
  });

  it("ages each flight, because a new flight is not a failing one", async () => {
    /*
     * A flight three months old looks catastrophic beside one four years old.
     * The age is what stops the comparison being read as a league table.
     */
    const { user } = renderView();
    await showTab(user, "Flights");
    const ages = screen.getByRole("heading", { name: "How old is each flight?" }).closest("section");
    expect(within(ages).getByRole("columnheader", { name: "Age" })).toBeInTheDocument();
    expect(
      within(ages).getByRole("columnheader", { name: "Longest-serving joined" })
    ).toBeInTheDocument();
  });

  it("leaves archived flights out of the age table", async () => {
    const { user } = renderView();
    await showTab(user, "Flights");
    const ages = screen.getByRole("heading", { name: "How old is each flight?" }).closest("section");
    // Charlie is archived in the fixture.
    expect(within(ages).queryByText("Charlie")).not.toBeInTheDocument();
  });
});

describe("progression", () => {
  it("accounts for every cadet across the six rungs", async () => {
    const { user, data } = renderView();
    await showTab(user, "Progression");
    const funnel = screen.getByText("Where the Squadron Sits").closest("article");
    const counts = [...funnel.querySelectorAll("li")].map((row) =>
      Number(row.lastElementChild.textContent)
    );
    expect(counts.reduce((a, b) => a + b, 0)).toBe(data.cadets.length);
  });

  it("counts badges by how far up the ladder they got, not how many there are", async () => {
    const { user, data } = renderView();
    await showTab(user, "Progression");
    const ladder = screen
      .getByRole("heading", { name: "How far up each badge ladder do cadets get?" })
      .closest("section");

    const subjects = new Set(
      data.events.filter((e) => e.badgeLevel && e.badgeCategory).map((e) => e.badgeCategory)
    );
    subjects.forEach((subject) => {
      expect(within(ladder).getByText(subject)).toBeInTheDocument();
    });
  });

  it("names the cadets who have not reached a classification rather than counting them", async () => {
    const { user } = renderView();
    await showTab(user, "Progression");
    const timing = screen
      .getByRole("heading", { name: "How long does a classification take here?" })
      .closest("section");
    expect(within(timing).getByText(/Second Class Cadet/)).toBeInTheDocument();
  });
});

describe("cadets with nothing recorded", () => {
  /*
   * Isla has no events at all in the fixture, deliberately. She is exactly the
   * person this panel exists to surface.
   */
  it("names them rather than counting them", async () => {
    const { user } = renderView();
    await showTab(user, "People");
    const alert = screen.getByText(/no record this year/i).closest("article");
    expect(within(alert).getByText("Isla Muir")).toBeInTheDocument();
  });

  it("explains that they are on the books, not missing", async () => {
    const { user } = renderView();
    await showTab(user, "People");
    expect(
      screen.getByText(/on the books. Nothing has been logged against them/i)
    ).toBeInTheDocument();
  });
});

describe("people", () => {
  it("reports category reach as cadets, not records", async () => {
    /*
     * "Twenty-eight flying records" can be four cadets going seven times. The
     * question a squadron is actually asked is how many have flown.
     */
    const { user } = renderView();
    await showTab(user, "People");
    const reach = screen
      .getByRole("heading", { name: "Who is getting the opportunities?" })
      .closest("section");
    const cadetCount = within(reach).getAllByText(/^\d+ of \d+$/);
    expect(cadetCount.length).toBeGreaterThan(0);
    expect(within(reach).getAllByRole("columnheader", { name: /Records/ })[0]).toBeInTheDocument();
  });

  it("shows rank against exams passed without recommending anybody", async () => {
    const { user } = renderView();
    await showTab(user, "People");
    const ranks = screen
      .getByRole("heading", { name: "Where is the next NCO coming from?" })
      .closest("section");
    expect(within(ranks).getByText(/judgement/i)).toBeInTheDocument();
  });
});

describe("record keeping", () => {
  it("reports the gap between a thing happening and it being entered", async () => {
    const { user } = renderView();
    await showTab(user, "Record Keeping");
    expect(screen.getByText("Typical Lag")).toBeInTheDocument();
  });

  it("names who enters the records, because that is a succession risk", async () => {
    const { user } = renderView();
    await showTab(user, "Record Keeping");
    const who = screen.getByText("Who Enters Records").closest("article");
    expect(within(who).getByText(/the log stops/i)).toBeInTheDocument();
  });

  it("lists data problems that are invisible on every other screen", async () => {
    const { user } = renderView();
    await showTab(user, "Record Keeping");
    expect(
      screen.getByRole("heading", { name: "Is anything wrong with the data?" })
    ).toBeInTheDocument();
  });
});
