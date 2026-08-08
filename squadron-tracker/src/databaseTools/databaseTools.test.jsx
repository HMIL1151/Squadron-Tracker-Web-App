/**
 * CHARACTERIZATION -- useSaveEvent.
 *
 * The single write path for every event the app records, and the only place
 * duplicate detection lives. Its rules are subtle and differ per event kind, so
 * they are pinned here before Phase 8 moves this into the data layer.
 */

import React from "react";
import { renderHook, act } from "@testing-library/react";

import { useSaveEvent } from "./databaseTools";
import { DataProvider } from "../context/DataContext";
import { SquadronProvider } from "../context/SquadronContext";
import { SQUADRONS, dataContextFor, dummyData } from "../test/dummyData";
import { __seed, __store, __writes } from "../test/fakeFirestore";

const setup = (squadron = SQUADRONS.FAKETON) => {
  __seed(dummyData);
  const data = dataContextFor(squadron);
  const wrapper = ({ children }) => (
    <DataProvider initialData={data}>
      <SquadronProvider initialSquadronNumber={squadron}>{children}</SquadronProvider>
    </DataProvider>
  );
  return { ...renderHook(() => useSaveEvent(), { wrapper }), data };
};

/** A well-formed event, overridable per test. cadetName is always an array. */
const newEvent = (over = {}) => ({
  addedBy: "Admin User",
  createdAt: new Date("2025-06-15T12:00:00Z"),
  cadetName: ["Isla Muir"],
  date: "2025-06-10",
  eventName: "Test Event",
  eventCategory: "Parade Night",
  ...over,
});

const eventWrites = () => __writes().filter((w) => w.path.includes("/EventLog/"));

describe("saving", () => {
  it("writes one document per cadet named", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current(newEvent({ cadetName: ["Isla Muir", "Femi Adeyemi"] }));
    });

    expect(eventWrites()).toHaveLength(2);
    expect(eventWrites().map((w) => w.data.cadetName)).toEqual(["Isla Muir", "Femi Adeyemi"]);
  });

  it("stores the cadet name as a string, not the array it was given", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current(newEvent());
    });
    expect(eventWrites()[0].data.cadetName).toBe("Isla Muir");
  });

  it("writes into the current squadron's EventLog", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current(newEvent());
    });
    expect(eventWrites()[0].path).toMatch(/^SquadronDatabases\/9999\/EventLog\//);
  });

  it("fills every unused field with an empty string", async () => {
    // Every consumer branches on truthiness, so absent fields would change
    // behaviour. The defaults matter.
    const { result } = setup();
    await act(async () => {
      await result.current(newEvent());
    });
    expect(eventWrites()[0].data).toEqual({
      addedBy: "Admin User",
      createdAt: expect.anything(),
      cadetName: "Isla Muir",
      date: "2025-06-10",
      badgeCategory: "",
      badgeLevel: "",
      examName: "",
      eventName: "Test Event",
      eventCategory: "Parade Night",
      specialAward: "",
    });
  });
});

describe("validation", () => {
  it("rejects an event with no cadets", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current(newEvent({ cadetName: [] }));
    });
    expect(eventWrites()).toEqual([]);
  });

  it("rejects a cadetName that is not an array", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current(newEvent({ cadetName: "Isla Muir" }));
    });
    expect(eventWrites()).toEqual([]);
  });

  it("rejects an event with no date", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current(newEvent({ date: undefined }));
    });
    expect(eventWrites()).toEqual([]);
  });

  it("rejects a date more than eight years in the past", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current(newEvent({ date: "2016-01-01" }));
    });
    expect(eventWrites()).toEqual([]);
  });

  it("rejects a date more than seven days ahead", async () => {
    // Frozen clock is 2025-06-15, so the cutoff is 2025-06-22.
    const { result } = setup();
    await act(async () => {
      await result.current(newEvent({ date: "2025-06-30" }));
    });
    expect(eventWrites()).toEqual([]);
  });

  it("accepts a date just inside the future window", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current(newEvent({ date: "2025-06-20" }));
    });
    expect(eventWrites()).toHaveLength(1);
  });
});

describe("duplicate detection", () => {
  it("rejects a badge the cadet already holds, whatever the date", async () => {
    // Badges are once-only, so the date is deliberately not part of the check.
    const { result } = setup();
    await act(async () => {
      await result.current(
        newEvent({
          cadetName: ["Amelia Hart"],
          eventName: "",
          eventCategory: "",
          badgeCategory: "Radio",
          badgeLevel: "Blue",
          date: "2025-06-10", // original was 2024-03-12
        })
      );
    });
    expect(eventWrites()).toEqual([]);
  });

  it("allows a different level of a badge the cadet already holds", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current(
        newEvent({
          cadetName: ["Amelia Hart"],
          eventName: "",
          eventCategory: "",
          badgeCategory: "Radio",
          badgeLevel: "Gold",
        })
      );
    });
    expect(eventWrites()).toHaveLength(1);
  });

  it("rejects an exam the cadet has already passed", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current(
        newEvent({
          cadetName: ["Amelia Hart"],
          eventName: "",
          eventCategory: "",
          examName: "First Class Cadet",
        })
      );
    });
    expect(eventWrites()).toEqual([]);
  });

  it("allows the same event name on a different date", async () => {
    // Events, unlike badges, include the date in the duplicate check -- a cadet
    // can attend a parade night every week.
    const { result } = setup();
    await act(async () => {
      await result.current(
        newEvent({ cadetName: ["Ben Okafor"], eventName: "Weekly Parade", date: "2025-06-12" })
      );
    });
    expect(eventWrites()).toHaveLength(1);
  });

  it("rejects the same event name on the same date", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current(
        newEvent({ cadetName: ["Ben Okafor"], eventName: "Weekly Parade", date: "2025-03-06" })
      );
    });
    expect(eventWrites()).toEqual([]);
  });

  it("skips only the duplicated cadet, saving the rest", async () => {
    // Amelia already holds Blue Radio; Isla does not.
    const { result } = setup();
    await act(async () => {
      await result.current(
        newEvent({
          cadetName: ["Amelia Hart", "Isla Muir"],
          eventName: "",
          eventCategory: "",
          badgeCategory: "Radio",
          badgeLevel: "Blue",
        })
      );
    });
    expect(eventWrites().map((w) => w.data.cadetName)).toEqual(["Isla Muir"]);
  });
});

describe("keeping DataContext in step", () => {
  it("appends the saved event to context, with its new document id", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current(newEvent());
    });

    const written = eventWrites()[0];
    expect(__store()[written.path]).toMatchObject({ cadetName: "Isla Muir" });
    expect(written.path.split("/").pop()).toMatch(/^auto-/);
  });
});
