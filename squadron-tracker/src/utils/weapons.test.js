/**
 * Weapon handling test validity.
 *
 * The date arithmetic is the part that goes wrong quietly: a pass on 31
 * August plus six months must not become 3 March, and "today" must be the
 * local calendar date rather than a UTC instant.
 */

import { getWeapons, isExpired, latestWeaponPasses, todayIso, weaponExpiry } from "./weapons";

describe("weaponExpiry", () => {
  it("adds whole months", () => {
    expect(weaponExpiry("2024-06-15", 12)).toBe("2025-06-15");
    expect(weaponExpiry("2024-11-02", 3)).toBe("2025-02-02");
  });

  it("clamps to the end of a shorter month rather than rolling over", () => {
    expect(weaponExpiry("2025-08-31", 6)).toBe("2026-02-28");
    expect(weaponExpiry("2023-08-31", 6)).toBe("2024-02-29");
  });

  it("returns nothing for a date it cannot read", () => {
    expect(weaponExpiry("", 12)).toBe("");
    expect(weaponExpiry(undefined, 12)).toBe("");
  });
});

describe("isExpired", () => {
  it("runs out ON the expiry date, not the day after", () => {
    expect(isExpired("2025-06-15", "2025-06-14")).toBe(false);
    expect(isExpired("2025-06-15", "2025-06-15")).toBe(true);
  });

  it("defaults to today, from the frozen test clock", () => {
    expect(todayIso()).toBe("2025-06-15");
    expect(isExpired("2025-06-16")).toBe(false);
  });
});

describe("latestWeaponPasses", () => {
  it("keeps only each cadet's most recent pass per weapon", () => {
    const passes = latestWeaponPasses([
      { cadetName: "Amelia Hart", weaponName: "Rifle", date: "2023-05-01" },
      { cadetName: "Amelia Hart", weaponName: "Rifle", date: "2024-05-01" },
      { cadetName: "Amelia Hart", weaponName: "Pistol", date: "2022-01-01" },
      { cadetName: "Isla Muir", badgeCategory: "Radio", badgeLevel: "Blue", date: "2024-01-01" },
    ]);
    expect(passes).toEqual({ "Amelia Hart": { Rifle: "2024-05-01", Pistol: "2022-01-01" } });
  });
});

describe("getWeapons", () => {
  it("reads the Weapons document as sorted { name, months }", () => {
    expect(getWeapons({ Weapons: { Rifle: 12, "Air Pistol": "6" } })).toEqual([
      { name: "Air Pistol", months: 6 },
      { name: "Rifle", months: 12 },
    ]);
  });

  it("is empty for a squadron that has never configured one", () => {
    expect(getWeapons({})).toEqual([]);
    expect(getWeapons(undefined)).toEqual([]);
  });
});
