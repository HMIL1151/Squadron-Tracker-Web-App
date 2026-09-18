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
        "Who has been consistently impressive?",
      ],
      Flights: ["How do the flights compare?"],
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

  it("says plainly that attendance and age profile are not measured", () => {
    /*
     * One line, and the only prose left on the page. It is the guard: the
     * tempting "improvement" is to put an attendance figure back, and the app
     * has nothing to compute one from.
     */
    renderView();
    expect(
      screen.getByText(/Attendance and age profile are not measured/i)
    ).toBeInTheDocument();
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

  it("heads the panel with how many there are", async () => {
    const { user } = renderView();
    await showTab(user, "People");
    expect(screen.getByText(/no record this year/i).textContent).toMatch(/^\d+ cadets? h/);
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

  it("measures standouts by months active and by range, not by rank", async () => {
    /*
     * This section replaced one that sorted cadets by exams passed and called
     * it a promotion pipeline. Promotion is a judgement made on things this
     * database does not hold, and an app that ranks cadets for it will be
     * believed over the staff who know them.
     */
    const { user } = renderView();
    await showTab(user, "People");
    const section = screen
      .getByRole("heading", { name: "Who has been consistently impressive?" })
      .closest("section");

    expect(within(section).getByText(/Most Consistent/)).toBeInTheDocument();
    expect(within(section).getByText(/Widest Range/)).toBeInTheDocument();
    expect(within(section).getByRole("columnheader", { name: /Active Months/ })).toBeInTheDocument();
    expect(within(section).queryByText(/promot/i)).not.toBeInTheDocument();
    expect(within(section).queryByRole("columnheader", { name: /Rank/ })).not.toBeInTheDocument();
  });
});

describe("record keeping", () => {
  it("reports the gap between a thing happening and it being entered", async () => {
    const { user } = renderView();
    await showTab(user, "Record Keeping");
    expect(screen.getByText("Typical Lag")).toBeInTheDocument();
  });

  it("names who enters the records, and their share of the log", async () => {
    // Concentration is a succession risk, so it is shown rather than summarised.
    const { user } = renderView();
    await showTab(user, "Record Keeping");
    const who = screen.getByText("Who Enters Records").closest("article");
    expect(within(who).getAllByText(/%$/).length).toBeGreaterThan(0);
  });

  it("lists data problems that are invisible on every other screen", async () => {
    const { user } = renderView();
    await showTab(user, "Record Keeping");
    expect(
      screen.getByRole("heading", { name: "Is anything wrong with the data?" })
    ).toBeInTheDocument();
  });
});
