/**
 * Flying and gliding on the Muster PTS board.
 *
 * Counted from the event log -- tagged records, and untagged ones guessed from
 * their name -- with a total that can be set by hand and that the log then
 * keeps adding to. The end-to-end test in the middle is the requirement
 * itself: set 10, log a flight through the same hook the event log uses, and
 * read 11.
 *
 * Its own file, like MusterRecordCategories.weapons.test.jsx, because the
 * main board suite is already long and none of these touch the badge columns.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import MusterPTSTracker from "./MusterPTSTracker";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { useSaveEvent } from "../../../databaseTools/databaseTools";
import { SQUADRONS, dataContextFor, userFor } from "../../../test/dummyData";

const activity = (id, cadetName, eventName, date, over = {}) => ({
  id,
  cadetName,
  date,
  eventName,
  eventCategory: "Squadron Event",
  badgeCategory: "",
  badgeLevel: "",
  examName: "",
  specialAward: "",
  ...over,
});

/** The fixture squadron plus some flights, with optional fields per cadet id. */
const withFlights = (cadetOver = {}) => {
  const base = dataContextFor(SQUADRONS.FAKETON);
  return {
    ...base,
    cadets: base.cadets.map((cadet) =>
      cadetOver[cadet.id] ? { ...cadet, ...cadetOver[cadet.id] } : cadet
    ),
    events: [
      ...base.events,
      activity("fly-1", "Amelia Hart", "AEF", "2024-08-10"),
      activity("fly-2", "Amelia Hart", "Trip to RAF Benson", "2025-02-01", { aviation: "flying" }),
      activity("fly-3", "Amelia Hart", "Gliding Induction Course", "2025-03-15"),
      // Looks like flying, told it was not.
      activity("fly-4", "Amelia Hart", "RAF Museum Flying Display", "2025-04-01", { aviation: "none" }),
      activity("fly-5", "Isla Muir", "AEF", "2025-05-20"),
    ],
  };
};

const renderView = (options = {}) =>
  renderWithProviders(<MusterPTSTracker user={userFor(SQUADRONS.FAKETON)} />, {
    squadron: SQUADRONS.FAKETON,
    uiVersion: "muster",
    ...options,
  });

const headers = (container) => [...container.querySelectorAll("thead th")].map((th) => th.textContent);
const columnHeaders = (container) =>
  [...container.querySelectorAll("thead tr:last-child th")].map((th) => th.textContent);
const rowFor = (container, name) =>
  [...container.querySelectorAll("tbody tr")].find((row) => row.textContent.includes(name));

/** One cadet's cell under a column heading. */
const cellsOf = (container, name) => {
  const heads = columnHeaders(container);
  const cells = [...rowFor(container, name).querySelectorAll("td, th")];
  return (header) => cells[heads.indexOf(header)];
};

/** What a sighted user sees in a cell, without the screen-reader sentence. */
const visibleText = (cell) =>
  [...cell.querySelector("button").childNodes]
    .filter((node) => !(node.nodeType === 1 && String(node.className).includes("visually-hidden")))
    .map((node) => node.textContent)
    .join("");

const showSummary = (user) => user.click(screen.getByRole("button", { name: "Highest Held" }));

const cadetWrites = (writes, id) => writes().filter((w) => w.path.endsWith(`/Cadets/${id}`));

describe("the columns", () => {
  it("gives flying and gliding two columns each, grouped in Every Level", async () => {
    const { container, user } = renderView();
    expect(headers(container)).toEqual(
      expect.arrayContaining(["Flying", "Flights", "Last Flight", "Gliding", "Glides", "Last Glide"])
    );
    await showSummary(user);
    expect(headers(container)).toEqual(
      expect.arrayContaining(["Flights", "Last Flight", "Glides", "Last Glide"])
    );
    expect(headers(container)).not.toContain("Flying");
  });

  it("counts tagged and guessed records, and not ones tagged as neither", () => {
    const { container } = renderView({ data: withFlights() });
    const amelia = cellsOf(container, "Amelia Hart");
    expect(visibleText(amelia("Flights"))).toBe("2");
    expect(visibleText(amelia("Last Flight"))).toBe("01 Feb 2025");
    expect(visibleText(amelia("Glides"))).toBe("1");
    expect(visibleText(amelia("Last Glide"))).toBe("15 Mar 2025");
  });

  it("shows a cadet who has never flown as a zero and a dash", () => {
    const { container } = renderView({ data: withFlights() });
    const ben = cellsOf(container, "Ben Okafor");
    expect(visibleText(ben("Flights"))).toBe("0");
    expect(visibleText(ben("Last Flight"))).toBe("—");
  });

  it("gives every cell a name a screen reader can act on", () => {
    const { container } = renderView({ data: withFlights() });
    const amelia = within(rowFor(container, "Amelia Hart"));
    expect(
      amelia.getAllByRole("button", { name: /Amelia Hart: 2 flights, last on 01 Feb 2025\. Edit flying record/ })
    ).toHaveLength(2);
  });

  it("totals the flights across the cadets showing", () => {
    const { container } = renderView({ data: withFlights() });
    const heads = columnHeaders(container);
    const totals = [...container.querySelectorAll("tfoot td, tfoot th")].map((cell) => cell.textContent);
    expect(totals[heads.indexOf("Flights")]).toBe("3");
    expect(totals[heads.indexOf("Glides")]).toBe("1");
  });

  it("ignores the badge filters, like the weapon columns", async () => {
    const { container, user } = renderView({ data: withFlights() });
    for (const button of screen.getAllByRole("button", { name: "None" })) {
      await user.click(button);
    }
    expect(headers(container)).toEqual(expect.arrayContaining(["Flights", "Glides"]));
    expect(visibleText(cellsOf(container, "Amelia Hart")("Flights"))).toBe("2");
  });
});

describe("setting a total by hand", () => {
  it("opens on what the log says, with the figures already filled in", async () => {
    const { container, user } = renderView({ data: withFlights() });
    await user.click(within(cellsOf(container, "Amelia Hart")("Flights")).getByRole("button"));
    expect(
      screen.getByText(/The event log has 2 flights for Amelia Hart, the last on 01 Feb 2025/)
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Total flights")).toHaveValue(2);
    expect(screen.getByLabelText("Last Flight")).toHaveValue("2025-02-01");
  });

  it("stores it on the cadet, with the records it already includes", async () => {
    const { container, user, writes } = renderView({ data: withFlights() });
    // Either cell opens the same dialog.
    await user.click(within(cellsOf(container, "Amelia Hart")("Last Flight")).getByRole("button"));
    await user.clear(screen.getByLabelText("Total flights"));
    await user.type(screen.getByLabelText("Total flights"), "10");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const written = cadetWrites(writes, "cadet-9999-01");
    expect(written).toHaveLength(1);
    expect(written[0].data).toEqual({
      flyingOverride: {
        count: 10,
        lastDate: "2025-02-01",
        counted: ["fly-1", "fly-2"],
        setAt: expect.any(String),
        setBy: expect.any(String),
      },
    });

    const amelia = cellsOf(container, "Amelia Hart");
    expect(visibleText(amelia("Flights"))).toBe("10*");
    expect(amelia("Flights").textContent).toContain("including a total set by hand");
    // Gliding is a separate figure and is left alone.
    expect(visibleText(amelia("Glides"))).toBe("1");
  });

  it("keeps adding logged flights on top: set 10, log a flight, read 11", async () => {
    const LogAFlight = () => {
      const saveEvent = useSaveEvent();
      return (
        <button
          type="button"
          onClick={() =>
            saveEvent({
              createdAt: new Date(),
              addedBy: "Test",
              cadetName: ["Ben Okafor"],
              date: "2025-06-10",
              eventName: "AEF",
              eventCategory: "Wing Event",
              aviation: "flying",
            })
          }
        >
          Log a flight
        </button>
      );
    };

    const { container, user } = renderWithProviders(
      <>
        <MusterPTSTracker user={userFor(SQUADRONS.FAKETON)} />
        <LogAFlight />
      </>,
      { squadron: SQUADRONS.FAKETON, uiVersion: "muster", data: withFlights() }
    );

    await user.click(within(cellsOf(container, "Ben Okafor")("Flights")).getByRole("button"));
    await user.clear(screen.getByLabelText("Total flights"));
    await user.type(screen.getByLabelText("Total flights"), "10");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(visibleText(cellsOf(container, "Ben Okafor")("Flights"))).toBe("10*");

    await user.click(screen.getByRole("button", { name: "Log a flight" }));
    const ben = cellsOf(container, "Ben Okafor");
    expect(visibleText(ben("Flights"))).toBe("11*");
    expect(visibleText(ben("Last Flight"))).toBe("10 Jun 2025");
  });

  it("says who set a total, and what has been added since", async () => {
    const { container, user } = renderView({
      data: withFlights({
        "cadet-9999-09": {
          flyingOverride: {
            count: 4,
            lastDate: "2025-01-01",
            counted: [],
            setAt: "2025-03-01T10:00:00.000Z",
            setBy: "Flt Lt Reed",
          },
        },
      }),
    });
    const isla = cellsOf(container, "Isla Muir");
    // Four by hand, plus the AEF in May that the figure did not include.
    expect(visibleText(isla("Flights"))).toBe("5*");
    expect(visibleText(isla("Last Flight"))).toBe("20 May 2025");

    await user.click(within(isla("Flights")).getByRole("button"));
    expect(
      screen.getByText(
        /set by hand by Flt Lt Reed on 01 Mar 2025, and 1 flight logged since has been added to it/
      )
    ).toBeInTheDocument();
  });

  it("goes back to the event log alone when cleared", async () => {
    const { container, user, writes } = renderView({
      data: withFlights({
        "cadet-9999-01": {
          flyingOverride: { count: 10, lastDate: "", counted: ["fly-1", "fly-2"], setAt: "", setBy: "x" },
        },
      }),
    });
    expect(visibleText(cellsOf(container, "Amelia Hart")("Flights"))).toBe("10*");

    await user.click(within(cellsOf(container, "Amelia Hart")("Flights")).getByRole("button"));
    await user.click(screen.getByRole("button", { name: "Use the Event Log Only" }));

    const written = cadetWrites(writes, "cadet-9999-01");
    expect(written).toHaveLength(1);
    expect(Object.keys(written[0].data)).toEqual(["flyingOverride"]);
    expect(visibleText(cellsOf(container, "Amelia Hart")("Flights"))).toBe("2");
  });

  it("offers no reset when nothing is set by hand", async () => {
    const { container, user } = renderView({ data: withFlights() });
    await user.click(within(cellsOf(container, "Amelia Hart")("Glides")).getByRole("button"));
    expect(screen.queryByRole("button", { name: "Use the Event Log Only" })).not.toBeInTheDocument();
  });

  /*
   * Opening a cell to look and pressing Save must not pin the cadet to a
   * hand-set figure nobody chose -- one that would then stop following
   * records deleted from the log.
   */
  it("writes nothing when saved without a change", async () => {
    const { container, user, writes } = renderView({ data: withFlights() });
    await user.click(within(cellsOf(container, "Amelia Hart")("Flights")).getByRole("button"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(writes().filter((w) => w.path.includes("/Cadets/"))).toHaveLength(0);
    expect(screen.queryByLabelText("Total flights")).not.toBeInTheDocument();
  });

  it("refuses a total that is not a whole number", async () => {
    const { container, user, writes } = renderView({ data: withFlights() });
    await user.click(within(cellsOf(container, "Ben Okafor")("Glides")).getByRole("button"));
    await user.clear(screen.getByLabelText("Total glides"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/whole number/);
    expect(writes().filter((w) => w.path.includes("/Cadets/"))).toHaveLength(0);
  });
});
