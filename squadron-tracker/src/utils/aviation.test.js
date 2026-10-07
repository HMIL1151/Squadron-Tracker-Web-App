/**
 * Flights and glides: what counts as one, and how a hand-set total combines
 * with the log.
 *
 * The combination is the part with consequences. "Set 10, log a flight, read
 * 11" is the requirement; the tests below pin down the cases around it that a
 * simpler rule gets wrong -- a record typed in late, a record deleted from
 * before the total was set, and two records written in the same instant.
 */

import {
  aviationOf,
  aviationRecords,
  aviationToStore,
  buildOverride,
  guessAviation,
  isActivity,
  summariseAviation,
  validateOverride,
} from "./aviation";

const record = (over) => ({
  id: "e",
  cadetName: "Amelia Hart",
  date: "2025-01-01",
  badgeCategory: "",
  badgeLevel: "",
  examName: "",
  eventName: "",
  eventCategory: "",
  specialAward: "",
  ...over,
});

describe("guessing from what a record is called", () => {
  it.each([
    ["AEF", "Squadron Event", "flying"],
    ["Air Experience Flight at RAF Benson", "Wing Event", "flying"],
    ["Flying at Boscombe Down", "", "flying"],
    ["Gliding Induction Course", "Wing Event", "gliding"],
    ["GIF 1", "Squadron Event", "gliding"],
    ["Viking sortie", "", "gliding"],
  ])("reads %s (%s) as %s", (eventName, eventCategory, expected) => {
    expect(guessAviation({ eventName, eventCategory })).toBe(expected);
  });

  /*
   * Every cadet is in a flight. "Flight" counting as flying would turn every
   * inter-flight quiz into a sortie on the first day.
   */
  it("does not take 'flight' alone to mean flying", () => {
    expect(guessAviation({ eventName: "Alpha Flight Quiz Night", eventCategory: "Parade Night" })).toBeNull();
  });

  it("falls back to the category when the name says nothing", () => {
    expect(guessAviation({ eventName: "Day at RAF Syerston", eventCategory: "Gliding" })).toBe("gliding");
  });

  /* A squadron with one "Flying/Gliding" category is told apart by name. */
  it("lets the name decide inside a combined category", () => {
    expect(guessAviation({ eventName: "Gliding", eventCategory: "Flying/Gliding" })).toBe("gliding");
    expect(guessAviation({ eventName: "AEF", eventCategory: "Flying/Gliding" })).toBe("flying");
  });

  it("leaves a record alone when it could be either", () => {
    expect(guessAviation({ eventName: "Flying and gliding day", eventCategory: "" })).toBeNull();
    expect(guessAviation({ eventName: "Trip out", eventCategory: "Flying/Gliding" })).toBeNull();
  });
});

describe("which records can be a flight at all", () => {
  it("is only Event/Other records", () => {
    expect(isActivity(record({ eventName: "AEF" }))).toBe(true);
    expect(isActivity(record({ badgeCategory: "Flying", badgeLevel: "Blue" }))).toBe(false);
    expect(
      isActivity(record({ examName: "Senior/Master: Aircraft Handling and Flying Techniques Exam" }))
    ).toBe(false);
    expect(isActivity(record({ weaponName: "L98A2" }))).toBe(false);
    expect(isActivity(record({ specialAward: "Flying Scholarship" }))).toBe(false);
  });
});

describe("one record's kind", () => {
  it("prefers the tag to the guess", () => {
    expect(aviationOf(record({ eventName: "Trip out", aviation: "gliding" }))).toBe("gliding");
    expect(aviationOf(record({ eventName: "AEF", aviation: "gliding" }))).toBe("gliding");
  });

  /* How "RAF Museum Flying Display" is told it was not a sortie. */
  it("lets 'none' overrule a guess", () => {
    expect(aviationOf(record({ eventName: "RAF Museum Flying Display", aviation: "none" }))).toBeNull();
  });

  it("guesses untagged records", () => {
    expect(aviationOf(record({ eventName: "AEF" }))).toBe("flying");
    expect(aviationOf(record({ eventName: "Parade" }))).toBeNull();
  });
});

describe("what to store", () => {
  it("stores a flight or glide whether or not it was guessed", () => {
    expect(aviationToStore("flying", { eventName: "AEF" })).toBe("flying");
    expect(aviationToStore("gliding", { eventName: "Trip out" })).toBe("gliding");
  });

  it("stores 'none' only where it overrules a guess", () => {
    expect(aviationToStore("none", { eventName: "Flying Display" })).toBe("none");
    expect(aviationToStore("none", { eventName: "Parade Night" })).toBeUndefined();
  });
});

describe("collecting a squadron's flights", () => {
  it("groups by cadet and kind", () => {
    const byCadet = aviationRecords([
      record({ id: "a", eventName: "AEF", date: "2025-01-01" }),
      record({ id: "b", eventName: "GIF", date: "2025-02-01" }),
      record({ id: "c", eventName: "AEF", date: "2025-03-01", cadetName: "Ben Okafor" }),
      record({ id: "d", eventName: "Parade" }),
    ]);
    expect(byCadet["Amelia Hart"]).toEqual({
      flying: [{ id: "a", date: "2025-01-01" }],
      gliding: [{ id: "b", date: "2025-02-01" }],
    });
    expect(byCadet["Ben Okafor"].flying).toHaveLength(1);
  });
});

describe("a cadet's total", () => {
  const logged = [
    { id: "a", date: "2025-01-10" },
    { id: "b", date: "2025-03-02" },
  ];

  it("is the log when nothing is set by hand", () => {
    expect(summariseAviation(logged)).toMatchObject({ count: 2, last: "2025-03-02", manual: false });
  });

  it("is zero with no date for a cadet who has never flown", () => {
    expect(summariseAviation(undefined)).toMatchObject({ count: 0, last: "", manual: false });
  });

  it("takes a hand-set figure as the truth at the moment it was set", () => {
    const override = { count: 10, lastDate: "2024-11-01", counted: ["a", "b"] };
    expect(summariseAviation(logged, override)).toMatchObject({ count: 10, manual: true, added: 0 });
  });

  it("adds what is logged afterwards: set 10, log a flight, read 11", () => {
    const override = { count: 10, lastDate: "2025-03-02", counted: ["a", "b"] };
    const later = [...logged, { id: "c", date: "2025-06-01" }];
    expect(summariseAviation(later, override)).toMatchObject({ count: 11, last: "2025-06-01", added: 1 });
  });

  /*
   * Typed in today, flown last year. New to the total, old by date -- which
   * is why "afterwards" is decided by record, not by date.
   */
  it("adds a backdated record logged afterwards, without moving the date back", () => {
    const override = { count: 10, lastDate: "2025-03-02", counted: ["a", "b"] };
    const later = [...logged, { id: "c", date: "2023-05-01" }];
    expect(summariseAviation(later, override)).toMatchObject({ count: 11, last: "2025-03-02" });
  });

  /* The hand-set figure never depended on a mistaken record. */
  it("is unmoved by deleting a record from before the figure was set", () => {
    const override = { count: 10, lastDate: "2025-03-02", counted: ["a", "b"] };
    expect(summariseAviation([logged[1]], override).count).toBe(10);
  });

  it("drops back when a record logged afterwards is deleted", () => {
    const override = { count: 10, lastDate: "2025-03-02", counted: ["a", "b"] };
    expect(summariseAviation(logged, override).count).toBe(10);
  });

  it("ignores an override it cannot read", () => {
    expect(summariseAviation(logged, { count: "lots" })).toMatchObject({ count: 2, manual: false });
    expect(summariseAviation(logged, { count: -1 })).toMatchObject({ count: 2, manual: false });
  });
});

describe("setting a total by hand", () => {
  it("remembers every record the figure already includes", () => {
    const override = buildOverride({
      count: 10,
      lastDate: "2025-03-02",
      records: [{ id: "a" }, { id: "b" }],
      setBy: "Admin User",
      now: new Date("2025-06-15T12:00:00Z"),
    });
    expect(override).toEqual({
      count: 10,
      lastDate: "2025-03-02",
      counted: ["a", "b"],
      setAt: "2025-06-15T12:00:00.000Z",
      setBy: "Admin User",
    });
  });

  const check = (count, lastDate = "") =>
    validateOverride({ count, lastDate, today: "2025-06-15", kind: "flying" });

  it("takes a whole number, zero included", () => {
    expect(check("0")).toBeNull();
    expect(check("12", "2025-06-15")).toBeNull();
  });

  it.each(["", "-1", "2.5", "ten"])("refuses %j", (value) => {
    expect(check(value)).toMatch(/whole number/);
  });

  it("refuses a date in the future", () => {
    expect(check("3", "2025-06-16")).toMatch(/not happened yet/);
  });

  it("refuses a last date on a total of zero", () => {
    expect(check("0", "2025-01-01")).toMatch(/does not add up/);
  });
});
