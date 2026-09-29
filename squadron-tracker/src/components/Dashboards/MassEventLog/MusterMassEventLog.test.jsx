/**
 * The Muster event log.
 *
 * The two interfaces share useMassEventLog, so the scoring is already covered
 * by MassEventLog.test.jsx and is not re-asserted here. What IS worth testing
 * is everything the classic screen cannot do: filtering, the ordering, and
 * whether the totals above the table agree with the rows below them.
 *
 * That last one is the point of the strip. A summary that keeps showing
 * all-time figures while the table shows one year is worse than no summary --
 * it is a number people quote in a report.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import MusterMassEventLog from "./MusterMassEventLog";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { rowsByHeader } from "../../../test/domSnapshot";
import { SQUADRONS, userFor } from "../../../test/dummyData";

const renderView = (squadron = SQUADRONS.FAKETON) =>
  renderWithProviders(<MusterMassEventLog user={userFor(squadron)} />, {
    squadron,
    uiVersion: "muster",
  });

const rows = (container) => rowsByHeader(container.querySelector("table"));

const tileValue = (label) =>
  screen.getByText(label).parentElement.textContent.replace(label, "").trim();

describe("what the table shows", () => {
  it("renders one row per event", () => {
    const { container, data } = renderView();
    expect(rows(container)).toHaveLength(data.events.length);
  });

  /*
   * The classic screen inherits whatever order Firestore returns, which is
   * roughly insertion order -- so the record you just added lands at the
   * bottom of a page of history.
   */
  it("puts the newest record first", () => {
    const { container } = renderView();
    const dates = rows(container).map((row) => row.Date);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
  });

  it("shows which flight each cadet is in, which the classic screen does not", () => {
    const { container } = renderView();
    const amelia = rows(container).find((row) => row.Cadet.includes("Amelia Hart"));
    expect(amelia.Cadet).toContain("Alpha");
  });
});

describe("filtering", () => {
  it("narrows to a year", async () => {
    const { container, user, data } = renderView();
    const all = data.events.length;

    await user.selectOptions(screen.getByLabelText("Year"), "2025");

    const shown = rows(container);
    expect(shown.length).toBeLessThan(all);
    expect(shown.every((row) => row.Date.startsWith("2025"))).toBe(true);
  });

  it("searches on cadet name and on the record", async () => {
    const { container, user } = renderView();

    await user.type(screen.getByLabelText("Search records"), "Amelia");
    expect(rows(container).every((row) => row.Cadet.includes("Amelia"))).toBe(true);
  });

  it("offers a way back when a filter hides everything", async () => {
    const { container, user } = renderView();

    await user.type(screen.getByLabelText("Search records"), "nobody by this name");
    expect(rows(container)).toHaveLength(0);
    expect(screen.getByText("Nothing Matches Those Filters")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show All Records" }));
    expect(rows(container).length).toBeGreaterThan(0);
  });
});

describe("the totals above the table", () => {
  it("counts every record when no year is chosen", () => {
    const { data } = renderView();
    expect(tileValue("Records logged")).toBe(String(data.events.length));
  });

  /*
   * The regression worth guarding. Summary tiles that ignore the filter
   * beneath them are how a squadron ends up reporting an all-time total as a
   * training-year one.
   */
  it("follows the year filter rather than staying on all time", async () => {
    const { container, user } = renderView();

    await user.selectOptions(screen.getByLabelText("Year"), "2025");

    expect(tileValue("Records in 2025")).toBe(String(rows(container).length));
  });

  it("reports the squadron's strength from the cadet list, not the log", () => {
    const { data } = renderView();
    expect(tileValue("Cadets on strength")).toBe(String(data.cadets.length));
  });
});

describe("adding a record", () => {
  it("opens the same popup the classic screen uses", async () => {
    const { user } = renderView();
    await user.click(screen.getByRole("button", { name: "Add Record" }));
    expect(screen.getByText(/add.*record/i)).toBeInTheDocument();
  });
});

/*
 * One activity on several dates -- "road marching on the 3rd, 10th and 17th"
 * -- is one form rather than three. The classic popup never offers it; see
 * MassEventLog.test.jsx, whose snapshot holds that screen still.
 */
describe("adding a record on several dates", () => {
  const popup = () => within(screen.getByRole("dialog"));
  const eventWrites = (writes) => writes().filter((w) => w.path.includes("/EventLog/"));

  const fillEvent = async (result, name) => {
    const { user } = result;
    await user.click(screen.getByRole("button", { name: "Add Record" }));
    await user.type(popup().getByLabelText("Name(s):"), name.slice(0, 4));
    const suggestion = (await popup().findAllByText(name)).find((el) => el.tagName === "LI");
    await user.click(suggestion);
    await user.type(popup().getByLabelText("Date:"), "2025-06-03");
    await user.click(popup().getByRole("button", { name: "+ Add another date" }));
    await user.type(popup().getByLabelText("Date 2:"), "2025-06-10");
    await user.click(popup().getByRole("button", { name: "+ Add another date" }));
    await user.type(popup().getByLabelText("Date 3:"), "2025-06-17");
  };

  it("writes one record per date", async () => {
    const result = renderView();
    await fillEvent(result, "Isla Muir");
    await result.user.click(popup().getByRole("button", { name: "Event/Other" }));
    await result.user.type(popup().getByLabelText("Event Description:"), "road march");
    await result.user.selectOptions(popup().getByLabelText("Event Category:"), "Squadron Event");
    await result.user.click(popup().getByRole("button", { name: "Add Event" }));

    expect(
      eventWrites(result.writes).map((w) => [w.data.cadetName, w.data.eventName, w.data.date])
    ).toEqual([
      ["Isla Muir", "Road March", "2025-06-03"],
      ["Isla Muir", "Road March", "2025-06-10"],
      ["Isla Muir", "Road March", "2025-06-17"],
    ]);
  });

  it("drops a date that is removed before saving", async () => {
    const result = renderView();
    await fillEvent(result, "Isla Muir");
    await result.user.click(popup().getByRole("button", { name: "Remove date 2" }));
    await result.user.click(popup().getByRole("button", { name: "Event/Other" }));
    await result.user.type(popup().getByLabelText("Event Description:"), "road march");
    await result.user.selectOptions(popup().getByLabelText("Event Category:"), "Squadron Event");
    await result.user.click(popup().getByRole("button", { name: "Add Event" }));

    expect(eventWrites(result.writes).map((w) => w.data.date)).toEqual([
      "2025-06-03",
      "2025-06-17",
    ]);
  });

  it("refuses several dates for a badge, which is only passed once", async () => {
    const result = renderView();
    await fillEvent(result, "Isla Muir");
    await result.user.click(popup().getByRole("button", { name: "Badge" }));
    await result.user.selectOptions(popup().getByLabelText("Badge Type:"), "Radio");
    await result.user.selectOptions(popup().getByLabelText("Badge Level:"), "Blue");
    await result.user.click(popup().getByRole("button", { name: "Add Event" }));

    expect(eventWrites(result.writes)).toEqual([]);
    expect(popup().getByText(/only passed once/)).toBeInTheDocument();
  });
});
