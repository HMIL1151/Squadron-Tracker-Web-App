/**
 * Squadron backup CSV formatting.
 *
 * Pure functions, so these run against the dummy squadrons directly with no
 * providers, no Firestore and no DOM.
 *
 * The cases that matter most are the ones a backup gets exactly one chance at:
 * a name containing a comma, a date that must not shift, and a squadron whose
 * flights are still in the legacy shape.
 */

import {
  backupFileName,
  buildBackupFiles,
  cadetsCsv,
  escapeCsv,
  eventLogCsv,
  flightPointsCsv,
  squadronInfoCsv,
  timestampToIso,
  toCsv,
} from "./backupCsv";
import { FAKETON_FLIGHTS, TESTWOOD_FLIGHTS, timestamp } from "../test/dummyData";

/** Split a CSV back into rows, dropping the trailing blank from the final CRLF. */
const rows = (csv) => csv.split("\r\n").slice(0, -1);
const dataRows = (csv) => rows(csv).slice(1);
const rowStartingWith = (csv, prefix) => dataRows(csv).find((row) => row.startsWith(prefix));

describe("escapeCsv", () => {
  it("leaves an ordinary value alone", () => {
    expect(escapeCsv("Amelia")).toBe("Amelia");
  });

  it("quotes a value containing the separator", () => {
    expect(escapeCsv("Hart, Amelia")).toBe('"Hart, Amelia"');
  });

  it("quotes and doubles embedded quotes", () => {
    expect(escapeCsv('Cadet "Ace" Hart')).toBe('"Cadet ""Ace"" Hart"');
  });

  it("quotes a value containing a newline", () => {
    expect(escapeCsv("line one\nline two")).toBe('"line one\nline two"');
  });

  it("quotes a value containing a carriage return", () => {
    expect(escapeCsv("line one\rline two")).toBe('"line one\rline two"');
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("writes %s as an empty cell, not the word", (_label, value) => {
    expect(escapeCsv(value)).toBe("");
  });

  it("keeps a zero rather than treating it as empty", () => {
    // TeamPoints legitimately holds 0. A falsy check here would blank it.
    expect(escapeCsv(0)).toBe("0");
  });

  it("stringifies booleans", () => {
    expect(escapeCsv(false)).toBe("false");
  });
});

describe("toCsv", () => {
  it("writes a header row then the data, CRLF separated and newline terminated", () => {
    expect(toCsv(["A", "B"], [[1, 2], [3, 4]])).toBe("A,B\r\n1,2\r\n3,4\r\n");
  });

  it("writes just the header when there are no rows", () => {
    expect(toCsv(["A", "B"], [])).toBe("A,B\r\n");
  });
});

describe("timestampToIso", () => {
  it("converts a Firestore Timestamp", () => {
    expect(timestampToIso(timestamp("2025-01-05T10:00:00Z"))).toBe("2025-01-05T10:00:00.000Z");
  });

  it("converts a plain Date", () => {
    // EventLog event-9999-17 stores one of these rather than a Timestamp.
    expect(timestampToIso(new Date("2025-01-30T18:30:00Z"))).toBe("2025-01-30T18:30:00.000Z");
  });

  it("passes a string through untouched", () => {
    // Never reparsed: `new Date("2025-01-01")` is the previous day west of UTC.
    expect(timestampToIso("2025-01-01")).toBe("2025-01-01");
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a number", 1749988800],
  ])("gives an empty cell for %s", (_label, value) => {
    expect(timestampToIso(value)).toBe("");
  });
});

describe("cadetsCsv", () => {
  const cadets = [
    {
      id: "cadet-9999-01",
      forename: "Amelia",
      surname: "Hart",
      startDate: "2021-09-06",
      flight: 2,
      rank: 3,
      addedBy: "Admin User",
      createdAt: timestamp("2025-01-05T10:00:00Z"),
    },
    {
      id: "cadet-9999-08",
      forename: "Harry",
      surname: "Blythe-Jones",
      startDate: "2019-04-08",
      flight: 1,
      rank: 5,
      addedBy: "Admin User",
      createdAt: timestamp("2025-01-05T10:00:00Z"),
    },
  ];

  it("names the columns", () => {
    expect(rows(cadetsCsv(cadets, FAKETON_FLIGHTS))[0]).toBe(
      "Doc ID,Forename,Surname,Start Date,Flight Index,Flight Name,Rank,Rank Name,Added By,Created At"
    );
  });

  it("writes a cadet with both the raw flight index and its name", () => {
    expect(rowStartingWith(cadetsCsv(cadets, FAKETON_FLIGHTS), "cadet-9999-01")).toBe(
      "cadet-9999-01,Amelia,Hart,2021-09-06,2,Alpha,3,Sergeant,Admin User,2025-01-05T10:00:00.000Z"
    );
  });

  it("resolves flight names from the legacy string shape too", () => {
    const csv = cadetsCsv([{ ...cadets[0], flight: 3 }], TESTWOOD_FLIGHTS);
    expect(dataRows(csv)[0]).toContain(",3,Tempest,");
  });

  it("keeps the start date as stored", () => {
    // The boundary date from pointsDivergence: reparsing moves it a day.
    const csv = cadetsCsv([{ ...cadets[0], startDate: "2025-01-01" }], FAKETON_FLIGHTS);
    expect(dataRows(csv)[0]).toContain(",2025-01-01,");
  });

  it("leaves the flight name blank when the index is out of range", () => {
    const csv = cadetsCsv([{ ...cadets[0], flight: 99 }], FAKETON_FLIGHTS);
    expect(dataRows(csv)[0]).toContain(",99,,");
  });

  it("leaves the rank name blank for an unknown rank", () => {
    const csv = cadetsCsv([{ ...cadets[0], rank: 42 }], FAKETON_FLIGHTS);
    expect(dataRows(csv)[0]).toContain(",42,,");
  });

  it("survives a squadron with no flights recorded", () => {
    expect(dataRows(cadetsCsv(cadets, undefined))).toHaveLength(2);
  });

  it("sorts by document id so repeat backups match byte for byte", () => {
    const reversed = [cadets[1], cadets[0]];
    expect(cadetsCsv(reversed, FAKETON_FLIGHTS)).toBe(cadetsCsv(cadets, FAKETON_FLIGHTS));
  });

  it("writes a header-only file for a squadron with no cadets", () => {
    expect(rows(cadetsCsv([], FAKETON_FLIGHTS))).toHaveLength(1);
  });

  it("treats a missing collection as empty", () => {
    expect(rows(cadetsCsv(undefined, FAKETON_FLIGHTS))).toHaveLength(1);
  });
});

describe("eventLogCsv", () => {
  const event = {
    id: "event-9999-01",
    cadetName: "Amelia Hart",
    date: "2024-03-12",
    badgeCategory: "Radio",
    badgeLevel: "Blue",
    examName: "",
    eventName: "",
    eventCategory: "",
    specialAward: "",
    addedBy: "Admin User",
    createdAt: timestamp("2025-06-01T09:00:00Z"),
  };

  it("writes every stored field, blanks included", () => {
    expect(dataRows(eventLogCsv([event]))[0]).toBe(
      "event-9999-01,Amelia Hart,2024-03-12,Radio,Blue,,,,,Admin User,2025-06-01T09:00:00.000Z"
    );
  });

  it("quotes an award name containing a comma", () => {
    // Free-text fields are admin-entered, so a comma is a matter of time.
    const csv = eventLogCsv([{ ...event, specialAward: "Best Cadet, Senior" }]);
    expect(dataRows(csv)[0]).toContain('"Best Cadet, Senior"');
  });

  it("handles an event whose createdAt is a plain Date", () => {
    const csv = eventLogCsv([{ ...event, createdAt: new Date("2025-01-30T18:30:00Z") }]);
    expect(dataRows(csv)[0]).toContain("2025-01-30T18:30:00.000Z");
  });

  it("writes a header-only file for an empty log", () => {
    expect(rows(eventLogCsv([]))).toHaveLength(1);
  });
});

describe("flightPointsCsv", () => {
  const docs = [
    { id: "Badge Points", "Blue Badge": 5, Exam: 8 },
    { id: "Badges", "Badge Types": ["Radio", "First Aid"] },
    { id: "TeamPoints", 1: 0, 2: 40, LastLoginDate: timestamp("2025-06-14T19:45:00Z") },
  ];

  it("names the columns", () => {
    expect(rows(flightPointsCsv(docs))[0]).toBe("Document,Field,Value");
  });

  it("flattens a price map to one row per price", () => {
    expect(dataRows(flightPointsCsv(docs))).toEqual(
      expect.arrayContaining(["Badge Points,Blue Badge,5", "Badge Points,Exam,8"])
    );
  });

  it("writes one row per array element, in stored order", () => {
    const badgeRows = dataRows(flightPointsCsv(docs)).filter((r) => r.startsWith("Badges,"));
    expect(badgeRows).toEqual(["Badges,Badge Types,Radio", "Badges,Badge Types,First Aid"]);
  });

  it("converts a timestamp field", () => {
    expect(dataRows(flightPointsCsv(docs))).toContain(
      "TeamPoints,LastLoginDate,2025-06-14T19:45:00.000Z"
    );
  });

  it("keeps a zero allocation rather than blanking it", () => {
    expect(dataRows(flightPointsCsv(docs))).toContain("TeamPoints,1,0");
  });

  it("writes a nested object as JSON rather than [object Object]", () => {
    const csv = flightPointsCsv([{ id: "Odd", nested: { a: 1 } }]);
    expect(dataRows(csv)[0]).toBe('Odd,nested,"{""a"":1}"');
  });

  it("writes a header-only file when there are no documents", () => {
    expect(rows(flightPointsCsv([]))).toHaveLength(1);
  });
});

describe("squadronInfoCsv", () => {
  const faketon = { Name: "Faketon", Number: 9999, flights: FAKETON_FLIGHTS };

  it("names the columns", () => {
    expect(rows(squadronInfoCsv(faketon, 9999))[0]).toBe(
      "Squadron Name,Squadron Number,Flight Index,Flight Name,Competing,Archived"
    );
  });

  it("writes a row per flight, carrying the name and number onto each", () => {
    expect(dataRows(squadronInfoCsv(faketon, 9999))).toEqual([
      "Faketon,9999,1,Staff Team,false,false",
      "Faketon,9999,2,Alpha,true,false",
      "Faketon,9999,3,Bravo,true,false",
      "Faketon,9999,4,Charlie,true,true",
    ]);
  });

  it("reads legacy string flights the way the app does", () => {
    // normaliseFlights gives index 0 competing: false -- the old hardcoded
    // staff-flight rule -- so the backup matches what the dashboards show.
    const testwood = { Name: "Testwood", Number: 9998, flights: TESTWOOD_FLIGHTS };
    expect(dataRows(squadronInfoCsv(testwood, 9998))).toEqual([
      "Testwood,9998,1,Staff Team,false,false",
      "Testwood,9998,2,Atlas,true,false",
      "Testwood,9998,3,Tempest,true,false",
    ]);
  });

  it("still records the number when the directory entry is missing", () => {
    // A backup must not fail over a missing SquadronList row.
    expect(dataRows(squadronInfoCsv(null, 9999))).toEqual([",9999,,,,"]);
  });

  it("writes one row when the squadron has no flights", () => {
    expect(dataRows(squadronInfoCsv({ Name: "Faketon", Number: 9999 }, 9999))).toEqual([
      "Faketon,9999,,,,",
    ]);
  });

  it("quotes a squadron name containing a comma", () => {
    const csv = squadronInfoCsv({ Name: "Newtown, East", Number: 9997, flights: ["A"] }, 9997);
    expect(dataRows(csv)[0]).toContain('"Newtown, East"');
  });
});

describe("backupFileName", () => {
  it("carries the squadron number and the date", () => {
    expect(backupFileName(9999)).toBe("Squadron_9999_Backup_2025-06-15.zip");
  });

  it("uses the date given", () => {
    expect(backupFileName(9998, new Date("2024-12-25T09:00:00Z"))).toBe(
      "Squadron_9998_Backup_2024-12-25.zip"
    );
  });
});

describe("buildBackupFiles", () => {
  const data = {
    cadets: [{ id: "c1", forename: "Amelia", surname: "Hart", flight: 2, rank: 3 }],
    events: [{ id: "e1", cadetName: "Amelia Hart", date: "2024-03-12" }],
    flightPoints: [{ id: "Badge Points", "Blue Badge": 5 }],
    squadron: { Name: "Faketon", Number: 9999, flights: FAKETON_FLIGHTS },
  };

  it("produces exactly the four backup files", () => {
    expect(Object.keys(buildBackupFiles(data, 9999))).toEqual([
      "cadets.csv",
      "event-log.csv",
      "flight-points.csv",
      "squadron-info.csv",
    ]);
  });

  it("still produces all four when the squadron is empty", () => {
    const empty = { cadets: [], events: [], flightPoints: [], squadron: null };
    const files = buildBackupFiles(empty, 9999);
    expect(Object.keys(files)).toHaveLength(4);
    // Header-only, so the file says "empty" rather than looking truncated.
    expect(rows(files["cadets.csv"])).toHaveLength(1);
  });
});
