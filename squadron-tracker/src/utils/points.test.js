/**
 * src/utils/points.js -- the single points implementation.
 *
 * Aims at full branch coverage, since every dashboard's numbers now come
 * through here. The cross-check against the old inline implementations lives in
 * pointsDivergence.test.js.
 */

import {
  getCadetPoints,
  getEventDescription,
  getEventPoints,
  getEventYear,
  getFlightPointTotals,
} from "./points";
import { SQUADRONS, dataContextFor } from "../test/dummyData";

const data = dataContextFor(SQUADRONS.FAKETON);
const { flightPoints } = data;

/** A blank event, as the app writes them: every field present, unused ones "". */
const event = (over = {}) => ({
  cadetName: "Test Cadet",
  date: "2025-05-01",
  badgeCategory: "",
  badgeLevel: "",
  examName: "",
  eventName: "",
  eventCategory: "",
  specialAward: "",
  ...over,
});

describe("getEventYear", () => {
  it("takes the year from the stored string", () => {
    expect(getEventYear(event({ date: "2024-11-05" }))).toBe("2024");
  });

  it("is timezone-proof at the 1 January boundary", () => {
    // new Date("2025-01-01").getFullYear() is 2024 west of UTC; this is not.
    expect(getEventYear(event({ date: "2025-01-01" }))).toBe("2025");
  });

  it("tolerates a missing date or event", () => {
    expect(getEventYear(event({ date: undefined }))).toBeUndefined();
    expect(getEventYear(undefined)).toBeUndefined();
  });
});

describe("getEventPoints", () => {
  it("prices a badge by its level", () => {
    expect(getEventPoints(event({ badgeLevel: "Blue", badgeCategory: "Radio" }), flightPoints)).toBe(5);
    expect(getEventPoints(event({ badgeLevel: "Bronze", badgeCategory: "Radio" }), flightPoints)).toBe(10);
    expect(getEventPoints(event({ badgeLevel: "Silver", badgeCategory: "Radio" }), flightPoints)).toBe(15);
    expect(getEventPoints(event({ badgeLevel: "Gold", badgeCategory: "Radio" }), flightPoints)).toBe(20);
  });

  it("prices every exam the same", () => {
    expect(getEventPoints(event({ examName: "First Class Cadet" }), flightPoints)).toBe(8);
  });

  it("prices an event by its category", () => {
    expect(getEventPoints(event({ eventCategory: "Parade Night" }), flightPoints)).toBe(1);
    expect(getEventPoints(event({ eventCategory: "National Event" }), flightPoints)).toBe(12);
  });

  it("prices every special award the same", () => {
    expect(getEventPoints(event({ specialAward: "Cadet of the Year" }), flightPoints)).toBe(25);
  });

  it("scores a categorised event even without a description", () => {
    // The deliberate behaviour change: MassEventLog used to require eventName
    // before consulting the category, scoring this 0 while the other two
    // implementations scored 5.
    expect(getEventPoints(event({ eventCategory: "Wing Event" }), flightPoints)).toBe(5);
  });

  it("scores a described event with no category as nothing", () => {
    // There is no price to look up. All three old implementations agreed.
    expect(getEventPoints(event({ eventName: "Ad-hoc Range Day" }), flightPoints)).toBe(0);
  });

  it("scores an unpriced category as nothing rather than NaN", () => {
    // Happens after a category is deleted -- historic events still name it.
    expect(getEventPoints(event({ eventCategory: "Deleted Category" }), flightPoints)).toBe(0);
  });

  it("scores an unpriced badge level as nothing", () => {
    expect(getEventPoints(event({ badgeLevel: "Platinum", badgeCategory: "Radio" }), flightPoints)).toBe(0);
  });

  it("needs both badge fields to price a badge", () => {
    expect(getEventPoints(event({ badgeCategory: "Radio" }), flightPoints)).toBe(0);
    expect(getEventPoints(event({ badgeLevel: "Blue" }), flightPoints)).toBe(0);
  });

  it("scores an empty event as nothing", () => {
    expect(getEventPoints(event(), flightPoints)).toBe(0);
  });

  it("survives missing arguments", () => {
    expect(getEventPoints(undefined, flightPoints)).toBe(0);
    expect(getEventPoints(event({ examName: "x" }), undefined)).toBe(0);
    expect(getEventPoints(event({ examName: "x" }), {})).toBe(0);
  });

  it("prefers a badge over other fields when several are set", () => {
    // Should not occur, but the order must be defined rather than accidental.
    const messy = event({ badgeLevel: "Gold", badgeCategory: "Radio", examName: "x", specialAward: "y" });
    expect(getEventPoints(messy, flightPoints)).toBe(20);
  });
});

describe("getEventDescription", () => {
  it("names a badge by level and category", () => {
    expect(getEventDescription(event({ badgeLevel: "Blue", badgeCategory: "Radio" }))).toBe("Blue Radio");
  });

  it("names an exam, event, and award by their own field", () => {
    expect(getEventDescription(event({ examName: "First Class Cadet" }))).toBe("First Class Cadet");
    expect(getEventDescription(event({ eventName: "Wing Athletics" }))).toBe("Wing Athletics");
    expect(getEventDescription(event({ specialAward: "Cadet of the Year" }))).toBe("Cadet of the Year");
  });

  it("returns an empty string for an empty or missing event", () => {
    expect(getEventDescription(event())).toBe("");
    expect(getEventDescription(undefined)).toBe("");
  });
});

describe("getCadetPoints", () => {
  it("totals a cadet's events for one year", () => {
    // Amelia 2025: Silver badge 15 + exam 8 + Wing Event 5.
    expect(getCadetPoints("Amelia Hart", 2025, data.events, flightPoints)).toBe(28);
  });

  it("excludes other years", () => {
    // Amelia 2024: Blue 5 + Bronze 10 + exam 8 + special 25.
    expect(getCadetPoints("Amelia Hart", 2024, data.events, flightPoints)).toBe(48);
  });

  it("accepts the year as a string or a number", () => {
    expect(getCadetPoints("Amelia Hart", "2025", data.events, flightPoints)).toBe(28);
  });

  it("counts the 1 January event in the right year", () => {
    // Ben: Blue badge on 2025-01-01 (5) + parade night (1).
    expect(getCadetPoints("Ben Okafor", 2025, data.events, flightPoints)).toBe(6);
    expect(getCadetPoints("Ben Okafor", 2024, data.events, flightPoints)).toBe(0);
  });

  it("returns zero for a cadet with no events, and for an unknown name", () => {
    expect(getCadetPoints("Isla Muir", 2025, data.events, flightPoints)).toBe(0);
    expect(getCadetPoints("Nobody At All", 2025, data.events, flightPoints)).toBe(0);
  });

  it("survives missing arguments", () => {
    expect(getCadetPoints("Amelia Hart", 2025)).toBe(0);
  });
});

describe("getFlightPointTotals", () => {
  it("totals each flight from its cadets", () => {
    // Alpha(2): Amelia 28 + Ben 6 + Chloe 13 + Isla 0 = 47
    // Bravo(3): Daniel 6 + Eve 53 + Femi 5 + Jack 23 = 87
    // Staff(1): Harry 25.  Charlie(4): Grace 8.
    expect(getFlightPointTotals(2025, data.cadets, data.events, flightPoints)).toEqual({
      1: 25,
      2: 47,
      3: 87,
      4: 8,
    });
  });

  it("includes a flight whose cadets scored nothing", () => {
    const cadets = [{ forename: "Isla", surname: "Muir", flight: 2 }];
    expect(getFlightPointTotals(2025, cadets, data.events, flightPoints)).toEqual({ 2: 0 });
  });

  it("skips cadets with no flight assigned", () => {
    const cadets = [
      { forename: "Amelia", surname: "Hart", flight: 2 },
      { forename: "Ghost", surname: "Cadet", flight: "" },
      { forename: "Other", surname: "Ghost", flight: null },
    ];
    expect(getFlightPointTotals(2025, cadets, data.events, flightPoints)).toEqual({ 2: 28 });
  });

  it("returns an empty map for no cadets", () => {
    expect(getFlightPointTotals(2025, [], data.events, flightPoints)).toEqual({});
  });
});
