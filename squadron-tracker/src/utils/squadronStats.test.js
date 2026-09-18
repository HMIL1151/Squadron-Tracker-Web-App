/**
 * The statistics screen is unusual in this app: almost every number on it is
 * derived rather than stored, and several are derived from ABSENCE -- cadets
 * who are not on strength, categories nobody has used, records with no usable
 * date. Those are exactly the cases a fixture built from happy data never
 * produces, so they are hand-built here.
 *
 * Every case below marked "real backup" actually occurred in a squadron's
 * five-year export, and is the reason the function behaves the way it does.
 *
 * The clock is frozen to 2025-06-15 by setupTests.js, so the functions that
 * measure against "now" are deterministic.
 */

import { describe, expect, it } from "vitest";
import {
  BADGE_ORDER,
  badgeLadder,
  categoryReach,
  classificationSpread,
  dataQuality,
  examsUsed,
  formerCadets,
  intake,
  labelForClassification,
  parseDate,
  percent,
  recordingHealth,
  standoutCadets,
  timeToClassification,
} from "./squadronStats";

const cadet = (over) => ({
  id: "c1",
  forename: "Alex",
  surname: "Doe",
  flight: 2,
  rank: 1,
  startDate: "2024-01-10",
  ...over,
});

const record = (over) => ({
  cadetName: "Alex Doe",
  date: "2024-06-01",
  badgeCategory: "",
  badgeLevel: "",
  examName: "",
  eventCategory: "",
  specialAward: "",
  addedBy: "Admin User",
  createdAt: "2024-06-08T10:00:00Z",
  ...over,
});

describe("parseDate", () => {
  it("reads the app's stored format", () => {
    expect(parseDate("2024-06-01").toISOString()).toBe("2024-06-01T00:00:00.000Z");
  });

  it("rejects the five-digit year found in a real backup", () => {
    // new Date("20222-11-22") is not an error in JS; it is the year 20222.
    expect(parseDate("20222-11-22")).toBeNull();
  });

  it("rejects anything that is not a stored date", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate(20240601)).toBeNull();
    expect(parseDate("01/06/2024")).toBeNull();
  });

  it("guards the shape, not the calendar", () => {
    /*
     * Documented rather than fixed: "2025-02-30" rolls into March the way the
     * Date constructor does. The regex exists to stop a wrong YEAR reaching an
     * axis, which is the failure that actually happened; a day that overflows
     * by one lands in the right region of a chart and is not worth a calendar
     * check.
     */
    expect(parseDate("2025-02-30").toISOString()).toBe("2025-03-02T00:00:00.000Z");
  });
});

describe("badgeLadder", () => {
  const events = [
    record({ badgeCategory: "Radio", badgeLevel: "Blue" }),
    record({ cadetName: "Sam Reed", badgeCategory: "Radio", badgeLevel: "Blue" }),
    record({ cadetName: "Sam Reed", badgeCategory: "Radio", badgeLevel: "Blue" }),
    record({ cadetName: "Sam Reed", badgeCategory: "Radio", badgeLevel: "Bronze" }),
    record({ badgeCategory: "Music", badgeLevel: "Bronze" }),
    record({ badgeCategory: "Music", badgeLevel: "Silver" }),
    record({ eventCategory: "Parade Night" }),
  ];

  it("counts awards per rung and ignores non-badges", () => {
    const [radio] = badgeLadder(events);
    expect(radio.subject).toBe("Radio");
    expect(radio.counts).toEqual([3, 1, 0, 0]);
    expect(radio.total).toBe(4);
  });

  it("counts holders as distinct cadets, not awards", () => {
    expect(badgeLadder(events)[0].holders).toBe(2);
  });

  it("reports the highest rung anyone reached", () => {
    const ladder = badgeLadder(events);
    expect(ladder.find((s) => s.subject === "Radio").ceiling).toBe("Bronze");
    expect(ladder.find((s) => s.subject === "Music").ceiling).toBe("Silver");
  });

  it("returns a null conversion where the lower rung is empty", () => {
    // A subject that starts at Bronze must not report "0% Blue to Bronze".
    const music = badgeLadder(events).find((s) => s.subject === "Music");
    expect(music.conversion[0]).toBeNull();
    expect(music.conversion[1]).toBe(1);
  });

  it("orders by volume", () => {
    expect(badgeLadder(events).map((s) => s.subject)).toEqual(["Radio", "Music"]);
  });

  it("survives an empty log", () => {
    expect(badgeLadder()).toEqual([]);
  });
});

describe("categoryReach", () => {
  const cadets = [cadet(), cadet({ id: "c2", forename: "Sam", surname: "Reed" })];
  const events = [
    record({ eventCategory: "Parade Night", date: "2024-05-01" }),
    record({ eventCategory: "Parade Night", date: "2024-09-01" }),
    record({ cadetName: "Gone Away", eventCategory: "Shooting" }),
    record({ eventCategory: "Wing Event" }),
  ];
  const configured = ["Parade Night", "Shooting", "Flying/Gliding"];

  it("counts cadets reached, not records", () => {
    const parade = categoryReach(cadets, events, configured).find((r) => r.category === "Parade Night");
    expect(parade.records).toBe(2);
    expect(parade.cadets).toBe(1);
    expect(parade.share).toBe(0.5);
  });

  it("keeps a former cadet's records but does not count them as reach", () => {
    // 738 of 1,522 records in a real backup belonged to cadets who had left.
    const shooting = categoryReach(cadets, events, configured).find((r) => r.category === "Shooting");
    expect(shooting.records).toBe(1);
    expect(shooting.cadets).toBe(0);
  });

  it("includes configured categories nobody has ever used", () => {
    const flying = categoryReach(cadets, events, configured).find((r) => r.category === "Flying/Gliding");
    expect(flying).toMatchObject({ records: 0, cadets: 0, configured: true, last: null });
  });

  it("includes used categories that are no longer configured", () => {
    const wing = categoryReach(cadets, events, configured).find((r) => r.category === "Wing Event");
    expect(wing.configured).toBe(false);
  });

  it("tracks the most recent date", () => {
    const parade = categoryReach(cadets, events, configured).find((r) => r.category === "Parade Night");
    expect(parade.last).toBe("2024-09-01");
  });

  it("sorts least-reached first, because that is the question", () => {
    expect(categoryReach(cadets, events, configured)[0].cadets).toBe(0);
  });
});

describe("timeToClassification", () => {
  const cadets = [
    cadet({ id: "c1", startDate: "2024-01-10" }),
    cadet({ id: "c2", forename: "Sam", surname: "Reed", startDate: "2023-01-10" }),
    cadet({ id: "c3", forename: "Nia", surname: "Bell", startDate: "" }),
  ];
  const events = [
    record({ cadetName: "Alex Doe", examName: "Second Class Cadet", date: "2024-07-15" }),
    record({ cadetName: "Alex Doe", examName: "Second Class Cadet", date: "2024-09-15" }),
    record({ cadetName: "Nia Bell", examName: "Second Class Cadet", date: "2024-07-15" }),
  ];

  const [second] = timeToClassification(cadets, events, ["Second Class Cadet"]);

  it("measures from the start date to the FIRST pass", () => {
    expect(second.passed).toBe(1);
    expect(second.median).toBe(6);
  });

  it("lists cadets who have not passed, longest-serving first", () => {
    expect(second.outstanding.map((o) => o.name)).toEqual(["Sam Reed"]);
    expect(second.outstanding[0].months).toBe(29); // to the frozen 2025-06-15
  });

  it("drops a cadet with a pass but no start date rather than guessing", () => {
    expect(second.months).toEqual([6]);
    expect(second.outstanding.some((o) => o.name === "Nia Bell")).toBe(false);
  });

  it("reports nulls rather than zero when nobody has passed", () => {
    const [none] = timeToClassification(cadets, [], ["Second Class Cadet"]);
    expect(none).toMatchObject({ passed: 0, median: null, fastest: null, slowest: null });
  });
});

describe("recordingHealth", () => {
  const today = new Date("2025-06-15T12:00:00Z");
  const events = [
    record({ date: "2024-06-01", createdAt: "2024-06-03T10:00:00Z", addedBy: "Admin User" }),
    record({ date: "2024-06-01", createdAt: "2024-10-01T10:00:00Z", addedBy: "Admin User" }),
    record({ date: "2023-01-01", createdAt: "2024-10-01T10:00:00Z", addedBy: "Admin User" }),
    record({ date: "2024-06-01", createdAt: "2024-05-01T10:00:00Z", addedBy: "Sgt Okafor" }),
    record({ date: "2026-01-01", createdAt: "2024-10-01T10:00:00Z", addedBy: "Sgt Okafor" }),
  ];

  const health = recordingHealth(events, today);

  it("measures the gap from the event to it being entered", () => {
    expect(health.measured).toBe(5);
    expect(health.median).toBe(2);
  });

  it("separates the tail, because the tail is the finding", () => {
    expect(health.sameWeek).toBe(1);
    expect(health.overNinety).toBe(2);
    expect(health.overAYear).toBe(1);
  });

  it("counts records logged before the date they carry", () => {
    // A negative lag is a real thing -- a camp entered when it is booked.
    expect(health.enteredEarly).toBe(2);
  });

  it("counts records dated after today", () => {
    expect(health.future).toBe(1);
  });

  it("groups entry into sessions, because backfills come in bursts", () => {
    expect(health.entryDays).toBe(3);
    expect(health.busiestDay).toEqual(["2024-10-01", 3]);
  });

  it("ranks contributors by share, which is a succession risk", () => {
    expect(health.contributors[0]).toMatchObject({ name: "Admin User", count: 3, share: 0.6 });
  });

  it("reads a Firestore timestamp as readily as a string", () => {
    const stamped = recordingHealth(
      [record({ date: "2024-06-01", createdAt: { toDate: () => new Date("2024-06-11T00:00:00Z") } })],
      today
    );
    expect(stamped.median).toBe(10);
  });

  it("reports no median rather than zero when nothing carries a time", () => {
    expect(recordingHealth([record({ createdAt: null })], today).median).toBeNull();
  });
});

describe("formerCadets", () => {
  const cadets = [cadet()];
  const events = [
    record({ cadetName: "Alex Doe", date: "2024-06-01" }),
    record({ cadetName: "Jo Vance", date: "2021-09-01" }),
    record({ cadetName: "Jo Vance", date: "2024-03-01" }),
    record({ cadetName: "Pat Lowe", date: "2023-01-01" }),
    record({ cadetName: "Pat Lowe", date: "2023-06-01" }),
    record({ cadetName: "No Dates", date: "" }),
  ];

  const gone = formerCadets(cadets, events);

  it("reconstructs leavers from names no longer on strength", () => {
    // There is no discharge date: discharging deletes the cadet, not the log.
    expect(gone.count).toBe(2);
    expect(gone.leavers.map((l) => l.name)).toEqual(["Jo Vance", "Pat Lowe"]);
  });

  it("uses the span of their records as a floor for service length", () => {
    expect(gone.medianMonths).toBe(30);
    expect(gone.underAYear).toBe(1);
  });

  it("skips a leaver whose records carry no usable date", () => {
    expect(gone.leavers.some((l) => l.name === "No Dates")).toBe(false);
  });

  it("counts how many records belong to people who have gone", () => {
    expect(gone.records).toBe(4);
  });

  it("groups them by the year they were last seen", () => {
    expect(gone.byYear).toEqual([
      { year: 2023, count: 1 },
      { year: 2024, count: 1 },
    ]);
  });
});

describe("intake", () => {
  const cadets = [
    cadet({ startDate: "2024-08-01" }),
    cadet({ id: "c2", startDate: "2024-08-20" }),
    cadet({ id: "c3", startDate: "2023-01-05" }),
    cadet({ id: "c4", startDate: "" }),
  ];

  it("counts joiners by month, because intake comes in waves", () => {
    expect(intake(cadets).byMonth[7]).toBe(2);
    expect(intake(cadets).byMonth[0]).toBe(1);
  });

  it("counts joiners by year", () => {
    expect(intake(cadets).byYear).toEqual([
      { year: 2023, count: 1 },
      { year: 2024, count: 2 },
    ]);
  });

  it("surfaces the cadets it cannot place", () => {
    expect(intake(cadets).withoutStartDate).toBe(1);
  });
});

describe("standoutCadets", () => {
  const today = new Date("2025-06-15T12:00:00Z");
  const cadets = [
    cadet({ id: "c1" }),
    cadet({ id: "c2", forename: "Sam", surname: "Reed" }),
    cadet({ id: "c3", forename: "Nia", surname: "Bell" }),
  ];
  const events = [
    // Alex: four records in four different months, two categories.
    record({ cadetName: "Alex Doe", date: "2025-01-06", eventCategory: "Parade Night" }),
    record({ cadetName: "Alex Doe", date: "2025-02-06", eventCategory: "Parade Night" }),
    record({ cadetName: "Alex Doe", date: "2025-03-06", eventCategory: "Shooting" }),
    record({ cadetName: "Alex Doe", date: "2025-04-06", eventCategory: "Parade Night" }),
    // Sam: four records in ONE month, but across four different kinds of thing.
    record({ cadetName: "Sam Reed", date: "2025-05-01", eventCategory: "Flying/Gliding" }),
    record({ cadetName: "Sam Reed", date: "2025-05-02", badgeCategory: "Radio", badgeLevel: "Blue" }),
    record({ cadetName: "Sam Reed", date: "2025-05-03", examName: "Second Class Cadet" }),
    record({ cadetName: "Sam Reed", date: "2025-05-04", specialAward: "Cadet of the Year" }),
  ];

  const rows = standoutCadets(cadets, events, today);
  const of = (name) => rows.find((row) => row.name === name);

  it("counts months with a record, not records", () => {
    /*
     * The whole point. Four records in four months and four records in one
     * week are not the same cadet, and a count of records cannot tell them
     * apart.
     */
    expect(of("Alex Doe").activeMonths).toBe(4);
    expect(of("Sam Reed").activeMonths).toBe(1);
    expect(of("Alex Doe").records).toBe(4);
    expect(of("Sam Reed").records).toBe(4);
  });

  it("counts breadth across categories, badge subjects, exams and awards", () => {
    expect(of("Sam Reed")).toMatchObject({
      categories: 1,
      subjects: 1,
      badges: 1,
      exams: 1,
      awards: 1,
      breadth: 4,
    });
    expect(of("Alex Doe").breadth).toBe(2);
  });

  it("orders by consistency first, then by breadth", () => {
    expect(rows.map((row) => row.name)).toEqual(["Alex Doe", "Sam Reed", "Nia Bell"]);
  });

  it("includes a cadet with nothing recorded rather than dropping them", () => {
    expect(of("Nia Bell")).toMatchObject({ activeMonths: 0, breadth: 0, last: null });
  });

  it("only counts the last two years towards consistency", () => {
    const old = standoutCadets(
      [cadet()],
      [
        record({ cadetName: "Alex Doe", date: "2022-01-06", eventCategory: "Parade Night" }),
        record({ cadetName: "Alex Doe", date: "2025-01-06", eventCategory: "Parade Night" }),
      ],
      today
    );
    expect(old[0].activeMonths).toBe(1);
    // The older record still counts as history: it is the last-seen date that moves.
    expect(old[0].records).toBe(2);
  });

  it("reports when each cadet was last seen", () => {
    expect(of("Alex Doe").last).toBe("2025-04-06");
  });

  it("says nothing about promotion", () => {
    // Rank is a judgement made on things this database does not hold.
    expect(Object.keys(rows[0])).not.toContain("rank");
    expect(Object.keys(rows[0])).not.toContain("ready");
  });
});

describe("dataQuality", () => {
  const today = new Date("2025-06-15T12:00:00Z");

  it("finds nothing wrong with clean data", () => {
    const clean = dataQuality([cadet()], [record({ eventCategory: "Parade Night" })], ["Parade Night"], today);
    expect(clean).toEqual([]);
  });

  it("flags every defect found in a real backup", () => {
    const issues = dataQuality(
      [
        cadet({ forename: "Alex ", surname: "Doe" }),
        cadet({ id: "c2", forename: "Nia", surname: "Bell", startDate: "" }),
      ],
      [
        record({ date: "20222-11-22", eventCategory: "Parade Night" }),
        record({ date: "2027-01-01", eventCategory: "Parade Night" }),
        record({ date: "2024-01-01" }),
      ],
      ["Parade Night", "Flying/Gliding"],
      today
    );
    expect(issues.map((i) => i.key).sort()).toEqual([
      "bad-dates",
      "future",
      "no-start",
      "uncategorised",
      "unused-categories",
      "whitespace",
    ]);
  });

  it("carries examples, so the issue can be acted on", () => {
    const [issue] = dataQuality([cadet()], [record({ date: "20222-11-22" })], [], today);
    expect(issue.examples[0]).toContain("20222-11-22");
  });
});

describe("the small shared helpers", () => {
  it("spreads classifications onto named rungs, folding the +1s in", () => {
    const spread = classificationSpread([
      { classificationLabel: "Junior" },
      { classificationLabel: "Leading +2" },
      { classificationLabel: "Leading" },
    ]);
    expect(spread.find((r) => r.rung === "Leading").count).toBe(2);
    expect(spread.find((r) => r.rung === "Master").count).toBe(0);
  });

  it("lists exams in syllabus order, with unknown ones last", () => {
    const used = examsUsed(
      [
        record({ examName: "Second Class Cadet" }),
        record({ examName: "Retired Exam" }),
        record({ examName: "Second Class Cadet" }),
      ],
      ["Second Class Cadet", "First Class Cadet"]
    );
    expect(used).toEqual([
      { exam: "Second Class Cadet", count: 2 },
      { exam: "Retired Exam", count: 1 },
    ]);
  });

  it("renders a percentage, or a dash when there is nothing to divide", () => {
    expect(percent(0.456)).toBe("46%");
    expect(percent(null)).toBe("—");
    expect(percent(undefined)).toBe("—");
  });

  it("labels a classification, falling back to the first rung", () => {
    expect(labelForClassification(3)).toBe("First Class");
    expect(labelForClassification(99)).toBe("Junior");
  });

  it("keeps the badge ladder in ascending order", () => {
    expect(BADGE_ORDER).toEqual(["Blue", "Bronze", "Silver", "Gold"]);
  });
});
