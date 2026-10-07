/**
 * Flights and glides in the Muster event log.
 *
 * This is where the PTS board's Flying and Gliding columns get their data:
 * an Event/Other record is tagged as a flight or a glide when it is added,
 * with the tag guessed from what it is called, and any record can be retagged
 * from its details -- which is how an old, guessed record that was wrong gets
 * put right.
 *
 * The rule worth holding to is that an ordinary record is stored exactly as
 * before. "Weekly Parade" must not gain an `aviation` field just because the
 * form now asks the question.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import MusterMassEventLog from "./MusterMassEventLog";
import MassEventLog from "./MassEventLog";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { SQUADRONS, dataContextFor, userFor } from "../../../test/dummyData";

const renderView = (options = {}) =>
  renderWithProviders(<MusterMassEventLog user={userFor(SQUADRONS.FAKETON)} />, {
    squadron: SQUADRONS.FAKETON,
    uiVersion: "muster",
    ...options,
  });

const popup = () => within(screen.getByRole("dialog"));
const eventWrites = (writes) => writes().filter((w) => w.path.includes("/EventLog/"));

/** Opens Add Record and fills in an Event/Other record for Isla Muir. */
const startActivity = async (user, description, category = "Squadron Event") => {
  await user.click(screen.getByRole("button", { name: "Add Record" }));
  await user.type(popup().getByLabelText("Name(s):"), "Isla");
  const suggestion = (await popup().findAllByText("Isla Muir")).find((el) => el.tagName === "LI");
  await user.click(suggestion);
  await user.type(popup().getByLabelText("Date:"), "2025-06-03");
  await user.click(popup().getByRole("button", { name: "Event/Other" }));
  await user.type(popup().getByLabelText("Event Description:"), description);
  await user.selectOptions(popup().getByLabelText("Event Category:"), category);
};

describe("adding a record", () => {
  it("guesses a flight from the description", async () => {
    const { user } = renderView();
    await startActivity(user, "AEF at Benson");
    expect(popup().getByLabelText("PTS board:")).toHaveValue("flying");
  });

  it("guesses a glide from the description", async () => {
    const { user } = renderView();
    await startActivity(user, "gliding induction course");
    expect(popup().getByLabelText("PTS board:")).toHaveValue("gliding");
  });

  it("writes the tag on a flight", async () => {
    const { user, writes } = renderView();
    await startActivity(user, "AEF at Benson", "Wing Event");
    await user.click(popup().getByRole("button", { name: "Add Event" }));

    const written = eventWrites(writes);
    expect(written).toHaveLength(1);
    // The category and points are untouched -- the tag rides alongside.
    expect(written[0].data).toMatchObject({
      cadetName: "Isla Muir",
      eventName: "AEF at Benson",
      eventCategory: "Wing Event",
      aviation: "flying",
    });
  });

  it("tags one record per date when several are given", async () => {
    const { user, writes } = renderView();
    await user.click(screen.getByRole("button", { name: "Add Record" }));
    await user.type(popup().getByLabelText("Name(s):"), "Isla");
    await user.click((await popup().findAllByText("Isla Muir")).find((el) => el.tagName === "LI"));
    await user.type(popup().getByLabelText("Date:"), "2025-06-03");
    await user.click(popup().getByRole("button", { name: "+ Add another date" }));
    await user.type(popup().getByLabelText("Date 2:"), "2025-06-10");
    await user.click(popup().getByRole("button", { name: "Event/Other" }));
    await user.type(popup().getByLabelText("Event Description:"), "gliding");
    await user.selectOptions(popup().getByLabelText("Event Category:"), "Squadron Event");
    await user.click(popup().getByRole("button", { name: "Add Event" }));

    expect(eventWrites(writes).map((w) => [w.data.date, w.data.aviation])).toEqual([
      ["2025-06-03", "gliding"],
      ["2025-06-10", "gliding"],
    ]);
  });

  it("keeps a choice once made, whatever is typed after", async () => {
    const { user, writes } = renderView();
    await startActivity(user, "Trip to Syerston");
    await user.selectOptions(popup().getByLabelText("PTS board:"), "gliding");
    await user.type(popup().getByLabelText("Event Description:"), " AEF");
    expect(popup().getByLabelText("PTS board:")).toHaveValue("gliding");
    await user.click(popup().getByRole("button", { name: "Add Event" }));
    expect(eventWrites(writes)[0].data.aviation).toBe("gliding");
  });

  /* Otherwise it would be guessed back into a flight the moment it is read. */
  it("stores 'none' when it overrules a guess", async () => {
    const { user, writes } = renderView();
    await startActivity(user, "Flying display visit");
    await user.selectOptions(popup().getByLabelText("PTS board:"), "none");
    await user.click(popup().getByRole("button", { name: "Add Event" }));
    expect(eventWrites(writes)[0].data.aviation).toBe("none");
  });

  it("stores an ordinary record exactly as before", async () => {
    const { user, writes } = renderView();
    await startActivity(user, "road march");
    expect(popup().getByLabelText("PTS board:")).toHaveValue("none");
    await user.click(popup().getByRole("button", { name: "Add Event" }));
    expect(eventWrites(writes)[0].data).not.toHaveProperty("aviation");
  });

  it("is not asked of a badge", async () => {
    const { user } = renderView();
    await user.click(screen.getByRole("button", { name: "Add Record" }));
    await user.click(popup().getByRole("button", { name: "Badge" }));
    expect(popup().queryByLabelText("PTS board:")).not.toBeInTheDocument();
  });

  it("is not asked by the classic screen", async () => {
    const { user } = renderWithProviders(<MassEventLog user={userFor(SQUADRONS.FAKETON)} />, {
      squadron: SQUADRONS.FAKETON,
    });
    await user.click(screen.getByRole("button", { name: "Add New Record" }));
    await user.click(screen.getByRole("button", { name: "Event/Other" }));
    expect(screen.queryByLabelText("PTS board:")).not.toBeInTheDocument();
  });
});

describe("the table", () => {
  /*
   * Guessed or tagged, a counted record says so. A wrong guess has to be
   * visible somewhere other than as a total on another screen.
   */
  it("marks flights and glides, including guessed ones", () => {
    const base = dataContextFor(SQUADRONS.FAKETON);
    const extra = (id, eventName, aviation) => ({
      id,
      cadetName: "Isla Muir",
      date: "2025-06-01",
      eventName,
      eventCategory: "Squadron Event",
      badgeCategory: "",
      badgeLevel: "",
      examName: "",
      specialAward: "",
      ...(aviation ? { aviation } : {}),
    });
    const { container } = renderView({
      data: {
        ...base,
        events: [
          ...base.events,
          extra("x1", "AEF"),
          extra("x2", "Day out", "gliding"),
          extra("x3", "Flying display", "none"),
        ],
      },
    });
    const rowText = (name) =>
      [...container.querySelectorAll("tbody tr")].find((row) => row.textContent.includes(name)).textContent;
    expect(rowText("AEF")).toContain("Flight");
    expect(rowText("Day out")).toContain("Glide");
    expect(rowText("Flying display")).not.toMatch(/Flight|Glide/);
  });
});

describe("retagging a record", () => {
  const openRecord = async (user, container, name) => {
    const row = [...container.querySelectorAll("tbody tr")].find((r) => r.textContent.includes(name));
    await user.click(row);
    await screen.findByText("Event Details");
  };

  it("marks an existing record as a flight", async () => {
    const { user, container, writes } = renderView();
    await openRecord(user, container, "Sqn Fieldcraft Day");
    await user.selectOptions(screen.getByLabelText("PTS board:"), "flying");

    const written = eventWrites(writes);
    expect(written).toEqual([
      expect.objectContaining({ op: "update", path: expect.stringMatching(/event-9999-13$/), data: { aviation: "flying" } }),
    ]);
    expect(screen.getByLabelText("PTS board:")).toHaveValue("flying");
  });

  it("removes the tag again rather than storing a needless 'none'", async () => {
    const { user, container, writes } = renderView();
    await openRecord(user, container, "Sqn Fieldcraft Day");
    await user.selectOptions(screen.getByLabelText("PTS board:"), "flying");
    await user.selectOptions(screen.getByLabelText("PTS board:"), "none");

    const last = eventWrites(writes).at(-1);
    expect(Object.keys(last.data)).toEqual(["aviation"]);
    expect(last.data.aviation).not.toBe("none");
    expect(screen.getByLabelText("PTS board:")).toHaveValue("none");
  });

  it("is not offered on a badge", async () => {
    const { user, container } = renderView();
    await openRecord(user, container, "Blue Radio");
    expect(screen.queryByLabelText("PTS board:")).not.toBeInTheDocument();
  });
});
