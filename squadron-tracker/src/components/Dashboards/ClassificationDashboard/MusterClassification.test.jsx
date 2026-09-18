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
