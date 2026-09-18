/**
 * Muster certificates.
 *
 * The PDF itself is untouched -- CertificatePDF.js is shared and covered by
 * CertificateDashboard.test.jsx -- so nothing here generates one. What is new
 * is that the lines appear without pressing anything, which is the difference
 * between a review step and a review step you have to know to ask for.
 *
 * The other thing worth holding still: struck-out lines apply to the SINGLE
 * download only. The zip gives every cadet their own lines, and quietly
 * applying one cadet's edits to thirty certificates would be hard to notice
 * and impossible to undo.
 */

import React from "react";
import { screen, within } from "@testing-library/react";

import MusterCertificates from "./MusterCertificates";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { SQUADRONS, userFor } from "../../../test/dummyData";

const renderView = (squadron = SQUADRONS.FAKETON) =>
  renderWithProviders(<MusterCertificates user={userFor(squadron)} />, {
    squadron,
    uiVersion: "muster",
  });

const sheet = () => screen.getByLabelText("What the Certificate Will Say");

describe("choosing what to print", () => {
  it("offers both certificate types and explains the difference", () => {
    renderView();
    expect(screen.getByText("End of Year")).toBeInTheDocument();
    expect(screen.getByText("End of Career")).toBeInTheDocument();
    expect(screen.getByText(/whole service/i)).toBeInTheDocument();
  });

  /*
   * The classic screen offers the last ten calendar years whether or not the
   * squadron existed for them, so most of that dropdown produces an empty
   * certificate.
   */
  it("offers only years that have records", () => {
    const { data } = renderView();
    const logged = new Set(data.events.map((event) => event.date.slice(0, 4)));
    const options = [...screen.getByLabelText("Training Year").options].map((o) => o.value);
    expect(new Set(options)).toEqual(logged);
  });

  it("hides the year for an End of Career certificate, which does not need one", async () => {
    const { user } = renderView();
    await user.click(screen.getByText("End of Career"));
    expect(screen.queryByLabelText("Training Year")).not.toBeInTheDocument();
  });
});

describe("the review step", () => {
  it("shows the lines without anything being pressed first", () => {
    renderView();
    expect(within(sheet()).getByText(/Lines Included/)).toBeInTheDocument();
  });

  it("takes a line off the certificate when it is unticked", async () => {
    const { user } = renderView();
    const before = within(sheet()).getByText(/(\d+) of (\d+) Lines Included/).textContent;

    const boxes = within(sheet()).getAllByRole("checkbox");
    await user.click(boxes[0]);

    const after = within(sheet()).getByText(/(\d+) of (\d+) Lines Included/).textContent;
    expect(after).not.toBe(before);
  });

  /*
   * Struck through and still listed, so the decision can be reversed. Removing
   * it from the list would make it hard to put back.
   */
  it("keeps a removed line visible so it can be put back", async () => {
    const { user } = renderView();
    const boxes = within(sheet()).getAllByRole("checkbox");
    const count = boxes.length;

    await user.click(boxes[0]);

    expect(within(sheet()).getAllByRole("checkbox")).toHaveLength(count);
    expect(within(sheet()).getAllByRole("checkbox")[0]).not.toBeChecked();
  });

  it("starts again when a different cadet is chosen", async () => {
    const { user } = renderView();
    await user.click(within(sheet()).getAllByRole("checkbox")[0]);

    await user.click(screen.getByRole("button", { name: "Ben Okafor" }));

    const boxes = within(sheet()).queryAllByRole("checkbox");
    expect(boxes.every((box) => box.checked)).toBe(true);
  });
});

describe("a cadet with nothing to print", () => {
  it("says so, and suggests the other certificate type", async () => {
    const { user } = renderView();
    // Isla has no records at all in the fixture.
    await user.click(screen.getByRole("button", { name: "Isla Muir" }));
    expect(screen.getByText("Nothing to Print")).toBeInTheDocument();
  });
});
