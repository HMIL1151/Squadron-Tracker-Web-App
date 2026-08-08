/**
 * Backing up a squadron, from the button to the zip.
 *
 * Runs against the fake Firestore end to end, so what is asserted is the real
 * fetch -> CSV -> zip path with only the download itself stubbed. JSZip is
 * replaced by a recorder rather than mocked away entirely, which is what makes
 * the file contents assertable; file-saver has to go regardless, since jsdom
 * has no URL.createObjectURL.
 *
 * The test that matters most is the exclusion one. Everything else here is a
 * feature working; that one is personal data not leaving the building.
 */

import React from "react";
import { screen, waitFor } from "@testing-library/react";

import AdminDashboard from "./AdminDashboard";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { SQUADRONS, dummyData } from "../../../test/dummyData";
import { __seed, __store } from "../../../test/fakeFirestore";

/*
 * `vi` rather than the suite's usual `jest` alias, because vi.hoisted has no
 * Jest equivalent and this file needs it: a mock factory is hoisted above the
 * imports, so it cannot close over an ordinary const. Hanging the recorder off
 * the mock function instead does not work here either -- jszip is CJS, and
 * what the default import resolves to after interop is not the factory's own
 * function object.
 */
const zip = vi.hoisted(() => ({ files: {}, failWith: null }));

vi.mock("jszip", () => ({
  default: vi.fn(() => ({
    file: (name, contents) => {
      zip.files[name] = contents;
    },
    generateAsync: () => (zip.failWith ? Promise.reject(zip.failWith) : Promise.resolve("zip-blob")),
  })),
}));

// Mocked whatever else happens: jsdom has no URL.createObjectURL, so the real
// saveAs throws.
vi.mock("file-saver", () => ({ saveAs: vi.fn() }));

import { saveAs } from "file-saver";

const zipped = () => zip.files;
const contents = () => Object.values(zip.files).join("\n");
const savedAs = () => saveAs.mock.calls.at(-1)?.[1];

/** Split a CSV into rows, dropping the trailing blank from the final CRLF. */
const rows = (csv) => csv.split("\r\n").slice(0, -1);

beforeEach(() => {
  Object.keys(zip.files).forEach((key) => delete zip.files[key]);
  zip.failWith = null;
  saveAs.mockClear();
});

const renderDashboard = async (options = {}) => {
  const result = renderWithProviders(<AdminDashboard />, {
    squadron: SQUADRONS.FAKETON,
    ...options,
  });
  await screen.findByText("Access Requests");
  return result;
};

const clickBackup = async (options) => {
  const result = await renderDashboard(options);
  await result.user.click(screen.getByRole("button", { name: "Backup Squadron Data" }));
  await waitFor(() => expect(saveAs).toHaveBeenCalled());
  return result;
};

describe("the backup control", () => {
  it("offers a backup button", async () => {
    await renderDashboard();
    expect(screen.getByRole("button", { name: "Backup Squadron Data" })).toBeInTheDocument();
  });

  it("says the export leaves out web app accounts", async () => {
    await renderDashboard();
    expect(screen.getByText(/web app accounts and access requests are not included/i))
      .toBeInTheDocument();
  });

  it("does not add a heading the request-card queries would pick up", async () => {
    // The card tests read every level-3 heading as a request name.
    await renderDashboard();
    expect(screen.queryAllByRole("heading", { level: 3 }).map((h) => h.textContent))
      .toEqual(["Pending Person"]);
  });
});

describe("producing the backup", () => {
  it("saves a zip named for the squadron and the day", async () => {
    await clickBackup();
    expect(savedAs()).toBe("Squadron_9999_Backup_2025-06-15.zip");
  });

  it("puts exactly the four CSV files in it", async () => {
    await clickBackup();
    expect(Object.keys(zipped())).toEqual([
      "cadets.csv",
      "event-log.csv",
      "flight-points.csv",
      "squadron-info.csv",
    ]);
  });

  it("exports every cadet", async () => {
    await clickBackup();
    // Ten cadets plus the header row.
    expect(rows(zipped()["cadets.csv"])).toHaveLength(11);
  });

  it("exports a cadet with their flight and rank resolved", async () => {
    await clickBackup();
    expect(zipped()["cadets.csv"]).toContain(
      "cadet-9999-01,Amelia,Hart,2021-09-06,2,Alpha,3,Sergeant,Admin User"
    );
  });

  it("exports every event log entry", async () => {
    await clickBackup();
    // Twenty-nine events plus the header row.
    expect(rows(zipped()["event-log.csv"])).toHaveLength(30);
  });

  it("exports an event with its blank fields intact", async () => {
    await clickBackup();
    expect(zipped()["event-log.csv"]).toContain(
      "event-9999-01,Amelia Hart,2024-03-12,Radio,Blue,,,,,Admin User"
    );
  });

  it("exports the flight points price list", async () => {
    await clickBackup();
    expect(zipped()["flight-points.csv"]).toContain("Badge Points,Blue Badge,5");
  });

  it("exports the directly-allocated team points", async () => {
    await clickBackup();
    expect(zipped()["flight-points.csv"]).toContain("TeamPoints,2,40");
  });

  it("exports the squadron's flights", async () => {
    await clickBackup();
    expect(zipped()["squadron-info.csv"]).toContain("Faketon,9999,2,Alpha,true,false");
  });

  it("never writes to Firestore", async () => {
    const { writes } = await clickBackup();
    expect(writes()).toEqual([]);
  });
});

describe("what the backup leaves out", () => {
  it("contains no authorised user or access request data", async () => {
    await clickBackup();
    const everything = contents();

    // Emails and uids from AuthorisedUsers and UserRequests in the dummy squadron.
    ["admin@faketon.test", "user@faketon.test", "pending@faketon.test", "denied@faketon.test"]
      .forEach((email) => expect(everything).not.toContain(email));
    ["uid-faketon-admin", "uid-faketon-user", "uid-pending"]
      .forEach((uid) => expect(everything).not.toContain(uid));
  });

  it("keeps another squadron's records out of this one's backup", async () => {
    await clickBackup();
    expect(contents()).not.toContain("Katie Lawson");
  });
});

describe("other squadrons and edge cases", () => {
  it("backs up a squadron whose flights are still the legacy shape", async () => {
    await clickBackup({ squadron: SQUADRONS.TESTWOOD });
    expect(savedAs()).toBe("Squadron_9998_Backup_2025-06-15.zip");
    expect(zipped()["squadron-info.csv"]).toContain("Testwood,9998,3,Tempest,true,false");
  });

  it("still backs up the records when the squadron has no directory entry", async () => {
    // A backup is worth more than the flight names it cannot resolve.
    __seed(dummyData);
    const docs = __store();
    delete docs["SquadronList/sqnlist-faketon"];
    __seed(docs);

    await clickBackup({ seedFirestore: false });

    expect(saveAs).toHaveBeenCalled();
    expect(zipped()["squadron-info.csv"]).toContain(",9999,,,,");
    expect(rows(zipped()["cadets.csv"])).toHaveLength(11);
  });
});

describe("when the backup fails", () => {
  it("says so and re-enables the button", async () => {
    zip.failWith = new Error("network down");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { user } = await renderDashboard();
    await user.click(screen.getByRole("button", { name: "Backup Squadron Data" }));

    expect(await screen.findByText("Backup failed. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Backup Squadron Data" })).toBeEnabled();
    expect(saveAs).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
