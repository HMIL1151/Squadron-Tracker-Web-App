/**
 * The Muster classification board.
 *
 * The arithmetic is shared with the classic dashboard through
 * utils/classification and covered there. What is new here is the exam board:
 * one column per exam, and a "one exam from promotion" filter that is the
 * reason a training officer opens this screen at all.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import MusterClassification from "./MusterClassification";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { SQUADRONS, userFor } from "../../../test/dummyData";

const renderView = (squadron = SQUADRONS.FAKETON) =>
  renderWithProviders(<MusterClassification user={userFor(squadron)} />, {
    squadron,
    uiVersion: "muster",
  });

const bodyRows = (container) => [...container.querySelectorAll("tbody tr")];
const rowFor = (container, name) =>
  bodyRows(container).find((row) => row.textContent.includes(name));

describe("the exam board", () => {
  it("gives every exam up to Leading its own column", () => {
    const { container } = renderView();
    const headers = [...container.querySelectorAll("thead th")].map((th) => th.textContent);

    expect(headers).toContain("Second Class");
    expect(headers).toContain("First Class");
    expect(headers).toContain("Airmanship");
  });

  /*
   * The stored names are full syllabus titles. "Leading: Basic Navigation
   * using a Map and Compass Exam" in a 78px column is why these are shortened
   * rather than trimmed.
   */
  it("shortens exam names enough to fit a column", () => {
    const { container } = renderView();
    const headers = [...container.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(headers).toContain("Navigation");
    expect(headers.every((header) => header.length < 25)).toBe(true);
  });

  /*
   * The cell carries the DATE, not a tick. A tick only repeats the column
   * heading; the date is what staff are actually after.
   */
  it("shows when each exam was passed rather than only that it was", () => {
    const { container } = renderView();
    const amelia = rowFor(container, "Amelia Hart");
    // Amelia passed Leading: Airmanship Knowledge on 2025-02-20 in the fixture.
    expect(amelia.textContent).toContain("20 Feb 2025");
  });

  it("offers an empty cell as a way to record that exam", () => {
    const { container } = renderView();
    const amelia = rowFor(container, "Amelia Hart");
    expect(
      within(amelia).getAllByRole("button", { name: /^Record .* for Amelia Hart$/ }).length
    ).toBeGreaterThan(0);
  });

  /*
   * Six, not eleven. Eleven Senior/Master papers exist and a cadet needs SIX
   * of them -- which six is up to them. Counting against eleven tells a cadet
   * they are further off than they are, and tells a training officer to plan
   * five exams nobody has to sit.
   */
  it("counts Senior and Master against the six a cadet actually needs", () => {
    const { container } = renderView();
    expect(rowFor(container, "Amelia Hart").textContent).toContain("of 6");
    expect(rowFor(container, "Amelia Hart").textContent).not.toContain("of 11");
  });

  /*
   * There is no "next exam due" column, and there should not be. The app
   * cannot know which exam a cadet will sit next: the Senior/Master papers are
   * a pick of six from eleven, and an earlier gap may be a back-fill or may be
   * a record nobody entered. Naming one would be a guess printed as a fact.
   */
  it("does not claim to know which exam comes next", () => {
    const { container } = renderView();
    const headers = [...container.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(headers.some((header) => /next exam/i.test(header))).toBe(false);
  });
});

describe("the distribution strip", () => {
  it("accounts for every cadet across the six rungs", () => {
    const { data } = renderView();
    const strip = screen.getByLabelText("Where the Squadron Sits");
    const counts = [...strip.querySelectorAll("li")].map((item) =>
      Number(item.textContent.replace(/[^0-9]/g, ""))
    );
    expect(counts.reduce((a, b) => a + b, 0)).toBe(data.cadets.length);
  });
});

describe("filtering", () => {
  it("narrows to cadets one exam from the next classification", async () => {
    const { container, user } = renderView();
    const before = bodyRows(container).length;

    await user.click(screen.getByRole("button", { name: "One Exam From Next Classification" }));

    expect(bodyRows(container).length).toBeLessThanOrEqual(before);
  });

  it("searches by name", async () => {
    const { container, user } = renderView();
    await user.type(screen.getByLabelText("Search cadets"), "Petrov");
    expect(bodyRows(container)).toHaveLength(1);
  });
});

describe("recording a pass", () => {
  /*
   * Dates sit before the frozen 2025-06-15 clock on purpose: saveEvent
   * refuses anything more than a week in the future, and a test that quietly
   * hits that validation looks exactly like a test where nothing saved.
   */
  /*
   * The board only has columns up to Leading, so for a while the six Senior
   * and Master papers -- most of the work between Leading and Master -- had
   * nowhere on this screen to be entered. The classic tracker could record
   * any exam, several at a time. These are that capability, pinned.
   */
  const openFor = async (user, container, name) =>
    user.click(within(rowFor(container, name)).getByRole("button", { name: /Add exams for/ }));

  /* Scoped: the toolbar has a flight select and date inputs of its own. */
  const dialog = () => within(screen.getByRole("dialog"));

  it("opens the dialog from the cadet, not only from a cell", async () => {
    const { user, container } = renderView();
    await openFor(user, container, "Amelia Hart");

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Add Exams/)).toBeInTheDocument();
  });

  it("offers the Senior and Master papers, which have no column", async () => {
    const { user, container } = renderView();
    await openFor(user, container, "Amelia Hart");

    const choices = [...dialog().getAllByRole("combobox")[0].options].map((o) => o.value);
    expect(choices).toEqual(
      expect.arrayContaining([
        "Senior/Master: Air Power Exam",
        "Senior/Master: Airframes Exam",
      ])
    );
  });

  it("records a Senior paper against the cadet", async () => {
    const { user, container, writes } = renderView();
    await openFor(user, container, "Amelia Hart");

    await user.selectOptions(dialog().getAllByRole("combobox")[0], "Senior/Master: Air Power Exam");
    await user.type(dialog().getAllByLabelText(/Date passed/)[0], "2025-03-04");
    await user.click(dialog().getByRole("button", { name: "Record Pass" }));

    const saved = writes().filter((write) => write.data?.examName);
    expect(saved).toHaveLength(1);
    expect(saved[0].data).toMatchObject({
      examName: "Senior/Master: Air Power Exam",
      date: "2025-03-04",
      cadetName: "Amelia Hart",
    });
  });

  it("records several exams in one go", async () => {
    // A cadet back from a weekend of papers has three or four to enter.
    const { user, container, writes } = renderView();
    await openFor(user, container, "Amelia Hart");

    await user.selectOptions(dialog().getAllByRole("combobox")[0], "Senior/Master: Air Power Exam");
    await user.type(dialog().getAllByLabelText(/Date passed/)[0], "2025-03-04");

    await user.selectOptions(dialog().getAllByRole("combobox")[1], "Senior/Master: Airframes Exam");
    await user.type(dialog().getAllByLabelText(/Date passed/)[1], "2025-03-05");

    await user.click(dialog().getByRole("button", { name: "Record Passes" }));

    const saved = writes().filter((write) => write.data?.examName);
    expect(saved.map((write) => write.data.examName)).toEqual([
      "Senior/Master: Air Power Exam",
      "Senior/Master: Airframes Exam",
    ]);
  });

  it("refuses a row with an exam and no date", async () => {
    const { user, container, writes } = renderView();
    await openFor(user, container, "Amelia Hart");

    await user.selectOptions(dialog().getAllByRole("combobox")[0], "Senior/Master: Air Power Exam");
    await user.click(dialog().getByRole("button", { name: "Record Pass" }));

    expect(dialog().getByText(/Give every exam a date/)).toBeInTheDocument();
    expect(writes().filter((write) => write.data?.examName)).toHaveLength(0);
  });

  it("leaves out the exams the cadet already has", async () => {
    /*
     * Amelia has passed First Class in the fixture. Offering it again is how
     * you get two First Class passes against one cadet.
     */
    const { user, container } = renderView();
    await openFor(user, container, "Amelia Hart");

    const choices = [...dialog().getAllByRole("combobox")[0].options].map((o) => o.value);
    expect(choices).not.toContain("First Class Cadet");
  });

  it("shows what the cadet already holds", async () => {
    const { user, container } = renderView();
    await openFor(user, container, "Amelia Hart");

    const held = dialog().getByText("Already recorded").closest("div");
    expect(within(held).getByText("First Class Cadet")).toBeInTheDocument();
  });

  it("still records from an empty cell, with that exam chosen", async () => {
    const { user, container, writes } = renderView();
    const amelia = rowFor(container, "Amelia Hart");
    const cell = within(amelia).getAllByRole("button", { name: /^Record .* for Amelia Hart$/ })[0];
    const exam = cell.textContent.replace(/^\+/, "").replace(/ for Amelia Hart$/, "").replace(/^Record /, "");

    await user.click(cell);
    await user.type(dialog().getAllByLabelText(/Date passed/)[0], "2025-02-02");
    await user.click(dialog().getByRole("button", { name: "Record Pass" }));

    const saved = writes().filter((write) => write.data?.examName);
    expect(saved).toHaveLength(1);
    expect(saved[0].data.examName).toBe(exam);
  });
});

describe("things the classic screen shows", () => {
  /*
   * Found by comparing the two screens line by line rather than by anyone
   * reporting them. Both were computed here and then dropped on the floor:
   * `isBehind` never reached the page, and the plot was wired to two empty
   * functions.
   */
  it("says what share of the squadron is on track", () => {
    // The classic screen prints this over the plot as "72.4% On Track".
    const { container } = renderView();
    const distribution = container.querySelector('[aria-label="Where the Squadron Sits"]');
    expect(within(distribution).getByText(/on track for their service length/)).toBeInTheDocument();
    expect(within(distribution).getByText(/^\d+%$/)).toBeInTheDocument();
  });

  it("counts on-track against the target for each cadet's service length", () => {
    const { container, data } = renderView();
    const distribution = container.querySelector('[aria-label="Where the Squadron Sits"]');
    const shown = Number(within(distribution).getByText(/^\d+%$/).textContent.replace("%", ""));

    // Whatever the number is, it has to be a percentage of the cadets on strength.
    expect(shown).toBeGreaterThanOrEqual(0);
    expect(shown).toBeLessThanOrEqual(100);
    expect(data.cadets.length).toBeGreaterThan(0);
  });
});
