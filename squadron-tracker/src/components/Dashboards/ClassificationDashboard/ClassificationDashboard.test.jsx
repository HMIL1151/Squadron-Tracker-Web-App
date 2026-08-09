/**
 * CHARACTERIZATION -- Classification Tracker.
 *
 * Plots each cadet's classification against their service length and compares it
 * to the expected progression. The scatter plot is Chart.js on a canvas, which
 * jsdom cannot render, so these assert the table beside it -- which carries the
 * same numbers.
 */

import React from "react";
import { vi } from "vitest";

import ClassificationDashboard from "./ClassificationDashboard";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { rowsByHeader } from "../../../test/domSnapshot";
import { SQUADRONS, userFor } from "../../../test/dummyData";

/**
 * Chart.js measures its canvas via getComputedStyle on the parent node, which
 * jsdom cannot provide -- it throws during render.
 *
 * Rather than shim enough of the DOM to make a canvas draw (whose pixels no
 * assertion could read anyway), the Graph is replaced with a component that
 * records the props it was handed. That characterizes what the dashboard plots,
 * which is the part this app owns; how Chart.js draws it is not.
 */
// vi.hoisted, because vi.mock is hoisted above the imports: a plain const here
// would still be in its temporal dead zone when the factory is registered.
// The factory also has to return a module shape ({ default }), where Jest's
// interop accepted the component directly.
const { graphProps } = vi.hoisted(() => ({ graphProps: [] }));

vi.mock("./Graph", () => ({
  default: (props) => {
    graphProps.push(props);
    return <canvas data-testid="classification-graph" />;
  },
}));

const renderDashboard = (squadron = SQUADRONS.FAKETON) => {
  graphProps.length = 0;
  return renderWithProviders(<ClassificationDashboard user={userFor(squadron)} />, { squadron });
};

const progression = (container) => rowsByHeader(container.querySelector("table"));

/** Props the Graph was last rendered with. */
const lastGraphProps = () => graphProps[graphProps.length - 1];

describe("progression table", () => {
  it("records every cadet's classification against their target", () => {
    const { container } = renderDashboard();
    expect(progression(container)).toMatchSnapshot();
  });

  it("lists every cadet", () => {
    const { container, data } = renderDashboard();
    expect(progression(container)).toHaveLength(data.cadets.length);
  });

  it("measures service in whole months from the frozen clock", () => {
    const { container } = renderDashboard();
    const rows = progression(container);
    // Femi joined 2025-02-10; frozen now is 2025-06-15.
    expect(rows.find((r) => r.Name === "Femi Adeyemi")["Service (Months)"]).toBe("4");
    // Harry joined 2019-04-08 -- 6 years and 2 months.
    expect(rows.find((r) => r.Name === "Harry Blythe-Jones")["Service (Months)"]).toBe("74");
  });

  it("derives classification from exam count, as the cadet list does", () => {
    const { container } = renderDashboard();
    const rows = progression(container);
    expect(rows.find((r) => r.Name === "Amelia Hart").Classification).toBe("First Class");
    expect(rows.find((r) => r.Name === "Isla Muir").Classification).toBe("Junior");
  });

  it("sets a target classification from service length alone", () => {
    // Banded: <2 months -> Junior, <6 -> Second Class, <8 -> First Class, and so
    // on. Independent of what the cadet has actually passed.
    const { container } = renderDashboard();
    const rows = progression(container);
    // Isla joined 2025-05-01, so about 1 month -> target Junior.
    expect(rows.find((r) => r.Name === "Isla Muir")["Target Classification"]).toBe("Junior");
    // Femi at 4 months -> target Second Class.
    expect(rows.find((r) => r.Name === "Femi Adeyemi")["Target Classification"]).toBe("Second Class");
  });

  it("colours rows by whether the cadet is on track", () => {
    // Green when classification >= target, red otherwise. Amelia has two exams
    // but nearly four years' service, so she is behind.
    const { container } = renderDashboard();
    const rows = [...container.querySelectorAll("tbody tr")];
    const amelia = rows.find((tr) => tr.textContent.includes("Amelia Hart"));
    const isla = rows.find((tr) => tr.textContent.includes("Isla Muir"));
    /*
     * Read from --row-bg rather than backgroundColor. Table.jsx hands the
     * caller's colour to CSS as a custom property instead of setting the
     * background inline, because an inline background outranks any class and
     * left the hover highlight unable to apply. The colour this dashboard
     * chooses per row is unchanged; only where it is applied moved.
     */
    expect(amelia.style.getPropertyValue("--row-bg")).toBe("#f8d7da"); // behind
    expect(isla.style.getPropertyValue("--row-bg")).toBe("#d4edda"); // on track
  });
});

describe("what gets plotted", () => {
  it("renders the graph alongside the table", () => {
    const { container, getByTestId } = renderDashboard();
    expect(getByTestId("classification-graph")).toBeInTheDocument();
    expect(container.querySelector("table")).toBeInTheDocument();
  });

  it("hands the graph the same cadets the table shows", () => {
    const { container } = renderDashboard();
    const props = lastGraphProps();
    const plotted = (props.cadetData || props.data || []).map((c) => c.cadetName ?? c.Name);
    expect(plotted.sort()).toEqual(progression(container).map((r) => r.Name).sort());
  });

  it("records the plotted series", () => {
    renderDashboard();
    const props = lastGraphProps();
    expect(
      (props.cadetData || props.data || []).map(({ cadetName, serviceLengthInMonths, classification }) => ({
        cadetName,
        serviceLengthInMonths,
        classification,
      }))
    ).toMatchSnapshot();
  });
});

describe("Testwood (legacy flight shape)", () => {
  it("records its progression", () => {
    const { container } = renderDashboard(SQUADRONS.TESTWOOD);
    expect(progression(container)).toMatchSnapshot();
  });
});
