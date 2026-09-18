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

  it("marks passed and unpassed exams so a screen reader gets both", () => {
    const { container } = renderView();
    const amelia = rowFor(container, "Amelia Hart");
    expect(within(amelia).getAllByText("Passed").length).toBeGreaterThan(0);
    expect(within(amelia).getAllByText("Not yet").length).toBeGreaterThan(0);
  });

  it("collapses the eleven Senior papers into a count", () => {
    const { container } = renderView();
    expect(rowFor(container, "Amelia Hart").textContent).toContain("of 11");
  });

  it("names the next exam each cadet needs", () => {
    const { container } = renderView();
    // Amelia has no Second Class record in the fixture, so that is what is
    // outstanding -- back-filling counts as the next thing needed.
    expect(rowFor(container, "Amelia Hart").textContent).toContain("Second Class");
  });
});

describe("the distribution strip", () => {
  it("accounts for every cadet across the six rungs", () => {
    const { data } = renderView();
    const strip = screen.getByLabelText("Where the squadron sits");
    const counts = [...strip.querySelectorAll("li")].map((item) =>
      Number(item.textContent.replace(/[^0-9]/g, ""))
    );
    expect(counts.reduce((a, b) => a + b, 0)).toBe(data.cadets.length);
  });
});

describe("filtering", () => {
  it("narrows to cadets one exam from promotion", async () => {
    const { container, user } = renderView();
    const before = bodyRows(container).length;

    await user.click(screen.getByRole("button", { name: "One exam from promotion" }));

    expect(bodyRows(container).length).toBeLessThanOrEqual(before);
  });

  it("searches by name", async () => {
    const { container, user } = renderView();
    await user.type(screen.getByLabelText("Search cadets"), "Petrov");
    expect(bodyRows(container)).toHaveLength(1);
  });
});
