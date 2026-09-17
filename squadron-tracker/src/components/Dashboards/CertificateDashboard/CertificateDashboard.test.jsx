/**
 * CHARACTERIZATION -- Certificates.
 *
 * A form that picks a certificate type, a cadet and (for End of Year) a year,
 * then lists the lines that will appear on the certificate. PDF generation
 * itself is not exercised: jspdf writing a real document in jsdom asserts
 * nothing useful, and the interesting behaviour is which lines get selected.
 */

import React from "react";
import { screen } from "@testing-library/react";

import CertificateDashboard from "./CertificateDashboard";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { SQUADRONS, userFor } from "../../../test/dummyData";

const renderDashboard = (squadron = SQUADRONS.FAKETON) =>
  renderWithProviders(<CertificateDashboard user={userFor(squadron)} />, { squadron });

const cadetSelect = () => screen.getByLabelText(/select cadet/i);
const yearSelect = () => screen.getByLabelText(/select year/i);
const typeSelect = () => screen.getByLabelText(/certificate type/i);

/**
 * The certificate lines currently offered for review.
 *
 * The empty-state message is also a <p> in this section, so it is excluded by
 * class rather than by matching its text.
 */
const reviewLines = (container) =>
  [...(container.querySelector(".events-section")?.querySelectorAll("p:not(.no-events)") || [])]
    .map((p) => p.textContent.trim())
    .filter(Boolean);

describe("the form", () => {
  it("offers every cadet", () => {
    const { data } = renderDashboard();
    const options = [...cadetSelect().querySelectorAll("option")].map((o) => o.textContent);
    data.cadets.forEach((c) => {
      expect(options).toContain(`${c.forename} ${c.surname}`);
    });
  });

  it("offers generating for all cadets at once", () => {
    renderDashboard();
    const values = [...cadetSelect().querySelectorAll("option")].map((o) => o.value);
    expect(values).toContain("all");
  });

  it("offers a range of years", () => {
    renderDashboard();
    const years = [...yearSelect().querySelectorAll("option")].map((o) => o.value).filter(Boolean);
    expect(years).toContain("2025");
    expect(years).toContain("2024");
  });

  it("offers both kinds of certificate, defaulting to End of Year", () => {
    renderDashboard();
    const options = [...typeSelect().querySelectorAll("option")].map((o) => o.textContent);
    expect(options).toEqual(["End of Year", "End of Career"]);
    expect(typeSelect()).toHaveValue("year");
  });

  it("drops the year picker for an End of Career certificate", async () => {
    const { user } = renderDashboard();
    await user.selectOptions(typeSelect(), "career");
    expect(screen.queryByLabelText(/select year/i)).toBeNull();
  });

  it("hides Generate until a cadet and a year are chosen", () => {
    renderDashboard();
    expect(screen.queryByRole("button", { name: "Generate" })).toBeNull();
  });

  it("shows Generate once both are chosen", async () => {
    const { user } = renderDashboard();
    await user.selectOptions(cadetSelect(), "Amelia Hart");
    await user.selectOptions(yearSelect(), "2025");
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
  });

  it("needs only a cadet for an End of Career certificate", async () => {
    const { user } = renderDashboard();
    await user.selectOptions(typeSelect(), "career");
    await user.selectOptions(cadetSelect(), "Amelia Hart");
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
  });

  it("states the span an End of Career certificate covers", async () => {
    // Amelia joined in 2021; the clock is frozen at 2025. Service, not logs --
    // the span runs to today even if the last logged event was earlier.
    const { user } = renderDashboard();
    await user.selectOptions(typeSelect(), "career");
    await user.selectOptions(cadetSelect(), "Amelia Hart");
    expect(screen.getByText(/Covering 2021 - 2025/)).toBeInTheDocument();
  });

  it("offers a zip download when all cadets are selected", async () => {
    const { user } = renderDashboard();
    await user.selectOptions(cadetSelect(), "all");
    await user.selectOptions(yearSelect(), "2025");
    expect(
      screen.getByRole("button", { name: /Download All Certificates/ })
    ).toBeInTheDocument();
  });
});

describe("certificate lines", () => {
  const generateFor = async (name, year) => {
    const result = renderDashboard();
    await result.user.selectOptions(cadetSelect(), name);
    await result.user.selectOptions(yearSelect(), year);
    await result.user.click(screen.getByRole("button", { name: "Generate" }));
    return result;
  };

  it("lists a cadet's achievements", async () => {
    const { container } = await generateFor("Amelia Hart", "2025");
    expect(reviewLines(container)).toMatchSnapshot();
  });

  it("describes badges, exams, events and awards", async () => {
    const { container } = await generateFor("Amelia Hart", "2025");
    const lines = reviewLines(container).join(" | ");
    expect(lines).toContain("Silver Radio");
    expect(lines).toContain("Leading: Airmanship Knowledge Exam");
    expect(lines).toContain("Wing Athletics");
  });

  it("says so when a cadet has nothing that year", async () => {
    const { container } = await generateFor("Isla Muir", "2025");
    expect(reviewLines(container)).toEqual([]);
    expect(screen.getByText(/No events found/)).toBeInTheDocument();
  });

  it("drops a line when it is clicked", async () => {
    // Clicking a line removes it from the certificate -- the only way to edit it.
    const { container, user } = await generateFor("Amelia Hart", "2025");
    const before = reviewLines(container);
    await user.click(screen.getByText(before[0]));
    expect(reviewLines(container)).toHaveLength(before.length - 1);
  });
});

describe("End of Career certificate lines", () => {
  const generateCareerFor = async (name) => {
    const result = renderDashboard();
    await result.user.selectOptions(typeSelect(), "career");
    await result.user.selectOptions(cadetSelect(), name);
    await result.user.click(screen.getByRole("button", { name: "Generate" }));
    return result;
  };

  it("lists everything on a cadet's record, oldest first", async () => {
    const { container } = await generateCareerFor("Amelia Hart");
    expect(reviewLines(container)).toMatchSnapshot();
  });

  it("is a superset of the cadet's yearly certificate", async () => {
    // The career certificate is the same list without the year filter, so every
    // line of the 2025 certificate has to appear on it.
    const career = await generateCareerFor("Amelia Hart");
    const careerLines = reviewLines(career.container);
    career.unmount();

    const yearly = renderDashboard();
    await yearly.user.selectOptions(cadetSelect(), "Amelia Hart");
    await yearly.user.selectOptions(yearSelect(), "2025");
    await yearly.user.click(screen.getByRole("button", { name: "Generate" }));

    const yearlyLines = reviewLines(yearly.container);
    expect(yearlyLines.length).toBeGreaterThan(0);
    yearlyLines.forEach((line) => expect(careerLines).toContain(line));
    expect(careerLines.length).toBeGreaterThan(yearlyLines.length);
  });

  it("spans more than one year", async () => {
    const { container } = await generateCareerFor("Amelia Hart");
    const lines = reviewLines(container).join(" | ");
    expect(lines).toContain("2024");
    expect(lines).toContain("2025");
  });

  it("says so when a cadet has nothing at all", async () => {
    const { container } = await generateCareerFor("Isla Muir");
    expect(reviewLines(container)).toEqual([]);
    expect(screen.getByText("No events found for the selected cadet.")).toBeInTheDocument();
  });
});

describe("preview", () => {
  it("shows nothing until a certificate is generated", () => {
    renderDashboard();
    expect(screen.getByText("No preview available")).toBeInTheDocument();
  });
});
