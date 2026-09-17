/**
 * SystemConfig -- the interface kill switch, at the Firestore layer.
 *
 * The behaviour worth pinning down is what happens when the read FAILS. This
 * setting decides what every user is shown, so an unreachable Firestore must
 * leave people on the interface that has been in production longest, not on
 * the new one and not on an error screen. A throw here would take the whole
 * app down over a setting.
 */

import {
  DEFAULT_UI_VERSION,
  UI_VERSIONS,
  fetchSystemUiVersion,
  isUiVersion,
  saveSystemUiVersion,
} from "./systemConfig";
import { __seed, __store, __writes } from "../test/fakeFirestore";
import * as db from "./db";

beforeEach(() => {
  __seed({});
});

describe("the vocabulary", () => {
  it("has exactly the two interfaces the rest of the app knows about", () => {
    expect(UI_VERSIONS).toEqual(["classic", "muster"]);
  });

  it("defaults to the one that has been in production longest", () => {
    expect(DEFAULT_UI_VERSION).toBe("classic");
  });

  it("rejects anything else, including near misses", () => {
    expect(isUiVersion("muster")).toBe(true);
    expect(isUiVersion("Muster")).toBe(false);
    expect(isUiVersion("")).toBe(false);
    expect(isUiVersion(null)).toBe(false);
    expect(isUiVersion(undefined)).toBe(false);
  });
});

describe("reading the default", () => {
  it("returns what a system admin set", async () => {
    __seed({ "SystemConfig/ui": { defaultVersion: "muster" } });
    await expect(fetchSystemUiVersion()).resolves.toBe("muster");
  });

  /*
   * null rather than "classic", and the distinction carries weight upstream:
   * only a value somebody actually set should override a user's own choice.
   */
  it("returns null when nobody has ever set it", async () => {
    await expect(fetchSystemUiVersion()).resolves.toBeNull();
  });

  it("returns null when the stored value is not an interface", async () => {
    __seed({ "SystemConfig/ui": { defaultVersion: "experimental" } });
    await expect(fetchSystemUiVersion()).resolves.toBeNull();
  });

  it("falls back rather than throwing when Firestore is unreachable", async () => {
    const spy = jest.spyOn(db, "getDoc").mockRejectedValue(new Error("offline"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(fetchSystemUiVersion()).resolves.toBeNull();
    } finally {
      spy.mockRestore();
      warn.mockRestore();
    }
  });
});

describe("changing the default", () => {
  it("writes the chosen interface and reports success", async () => {
    await expect(saveSystemUiVersion("muster")).resolves.toBe(true);
    expect(__store()["SystemConfig/ui"]).toMatchObject({ defaultVersion: "muster" });
  });

  /*
   * merge, so a later setting stored alongside this one is not wiped out by
   * somebody flipping the interface.
   */
  it("leaves other settings in the document alone", async () => {
    __seed({ "SystemConfig/ui": { defaultVersion: "classic", bannerMessage: "Parade cancelled" } });
    await saveSystemUiVersion("muster");
    expect(__store()["SystemConfig/ui"]).toEqual({
      defaultVersion: "muster",
      bannerMessage: "Parade cancelled",
    });
  });

  it("refuses a value that is not an interface, and writes nothing", async () => {
    await expect(saveSystemUiVersion("banana")).resolves.toBe(false);
    expect(__writes()).toHaveLength(0);
  });

  /*
   * The rules reject this write for anyone who is not a system admin. Getting
   * `false` back is what lets the dashboard say so, instead of showing a
   * success message for a change that never happened.
   */
  it("reports failure rather than throwing when the write is rejected", async () => {
    const spy = jest.spyOn(db, "setDoc").mockRejectedValue(new Error("permission-denied"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(saveSystemUiVersion("muster")).resolves.toBe(false);
    } finally {
      spy.mockRestore();
      warn.mockRestore();
    }
  });
});
