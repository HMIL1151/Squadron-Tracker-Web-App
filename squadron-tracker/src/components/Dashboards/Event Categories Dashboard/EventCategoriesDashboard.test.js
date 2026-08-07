/**
 * CHARACTERIZATION -- Record Categories.
 *
 * This is where the points values every other dashboard reads are configured, so
 * what it shows and what it writes both matter to Phase 6.
 *
 * Four tabs, one table visible at a time -- so each tab has to be opened before
 * its contents can be asserted.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import EventCategoriesDashboard from "./EventCategoriesDashboard";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { tableToRows } from "../../../test/domSnapshot";
import { SQUADRONS } from "../../../test/dummyData";

const renderDashboard = (squadron = SQUADRONS.FAKETON) =>
  renderWithProviders(<EventCategoriesDashboard />, { squadron });

const TABS = ["Record Categories", "Badges", "Badge Points", "Special Awards"];

const openTab = async (result, name) => {
  const menu = within(result.container.querySelector(".horizontal-menu"));
  await result.user.click(menu.getByRole("button", { name }));
  return tableToRows(result.container.querySelector("table"));
};

describe("tabs", () => {
  it("offers all four", () => {
    const { container } = renderDashboard();
    const menu = within(container.querySelector(".horizontal-menu"));
    TABS.forEach((name) => expect(menu.getByRole("button", { name })).toBeInTheDocument());
  });

  it("opens on Record Categories", () => {
    const { container } = renderDashboard();
    const menu = within(container.querySelector(".horizontal-menu"));
    expect(menu.getByRole("button", { name: "Record Categories" })).toHaveClass("active");
  });

  it("shows one table at a time", () => {
    const { container } = renderDashboard();
    expect(container.querySelectorAll("table")).toHaveLength(1);
  });
});

describe("configured values", () => {
  it("records what every tab contains", async () => {
    const result = renderDashboard();
    const byTab = {};
    for (const name of TABS) {
      byTab[name] = await openTab(result, name);
    }
    expect(byTab).toMatchSnapshot();
  });

  it("lists event categories with their points", async () => {
    const result = renderDashboard();
    const { rows } = await openTab(result, "Record Categories");
    expect(Object.fromEntries(rows)).toEqual({
      "Parade Night": "1",
      "Squadron Event": "3",
      "Wing Event": "5",
      "Regional Event": "8",
      "National Event": "12",
    });
  });

  it("lists badge types", async () => {
    const result = renderDashboard();
    const { rows } = await openTab(result, "Badges");
    expect(rows.flat()).toEqual([
      "Radio", "First Aid", "Shooting", "Adventure Training", "Sports", "Music",
    ]);
  });

  it("lists special awards", async () => {
    const result = renderDashboard();
    const { rows } = await openTab(result, "Special Awards");
    expect(rows.flat()).toEqual([
      "Cadet of the Year", "Most Improved Cadet", "Commandant's Commendation",
    ]);
  });
});

describe("the prices other dashboards score with", () => {
  it("matches what Mass Event Log and Flight Points use", async () => {
    // If these ever drift from the points characterization tests, one of the
    // two is wrong -- this is the shared source of truth for both.
    const result = renderDashboard();
    const { rows } = await openTab(result, "Badge Points");
    expect(Object.fromEntries(rows)).toEqual({
      "Blue Badge": "5",
      "Bronze Badge": "10",
      "Silver Badge": "15",
      "Gold Badge": "20",
      Exam: "8",
      Special: "25",
    });
  });
});

describe("controls", () => {
  it("offers add and delete on each tab", async () => {
    const result = renderDashboard();
    for (const name of TABS) {
      const menu = within(result.container.querySelector(".horizontal-menu"));
      await result.user.click(menu.getByRole("button", { name }));
      const actions = within(result.container.querySelector(".button-container"));
      expect(actions.getByRole("button", { name: /^Add/ })).toBeInTheDocument();
      expect(actions.getByRole("button", { name: /^Delete/ })).toBeInTheDocument();
    }
  });
});

describe("Testwood", () => {
  it("renders the same configuration", async () => {
    const result = renderDashboard(SQUADRONS.TESTWOOD);
    const { rows } = await openTab(result, "Badge Points");
    expect(Object.fromEntries(rows)).toMatchSnapshot();
  });
});
