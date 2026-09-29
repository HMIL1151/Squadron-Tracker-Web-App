import { useContext, useMemo } from "react";
import { DataContext } from "../../../context/DataContext";
import { useSquadron } from "../../../context/SquadronContext";
import {
  DOCS,
  fetchDoc,
  removePrice,
  replaceDoc,
  setList,
  setPrice,
} from "../../../firebase/flightPoints";

/**
 * The squadron's scoring vocabulary: what an event can be, what a badge is
 * worth, and which special awards exist.
 *
 * Four lists living in four FlightPoints documents, in two different shapes --
 * two are maps of name to points, two are plain arrays of names. That split is
 * the reason this hook exists: the classic screen carries the same fork four
 * times over, inline in its render, and every one of them also has to patch
 * DataContext by hand afterwards.
 *
 * `kind` is one of the KINDS keys below and decides everything: which
 * document, which shape, and how DataContext is patched.
 *
 * Nothing here re-reads from Firestore after a write. The lite SDK has no
 * onSnapshot, so DataContext is the app's only copy and has to be corrected in
 * step -- which is exactly where the classic screen's copies drift apart.
 */

export const KINDS = {
  categories: {
    doc: DOCS.categoryPoints,
    field: "Event Category Points",
    shape: "priced",
    title: "Event Categories",
    itemLabel: "Category",
    note: "What an event is worth when it is logged against a cadet.",
  },
  badgePoints: {
    doc: DOCS.badgePoints,
    field: "Badge Points",
    shape: "priced",
    title: "Badge Points",
    itemLabel: "Badge level",
    note: "What each badge level, exam and special award scores.",
  },
  badges: {
    doc: DOCS.badges,
    field: "Badges",
    array: "Badge Types",
    shape: "list",
    title: "Badge Subjects",
    itemLabel: "Subject",
    note: "The syllabus areas the PTS tracker has a column for.",
  },
  specialAwards: {
    doc: DOCS.specialAwards,
    field: "Special Awards",
    array: "Special Awards",
    shape: "list",
    title: "Special Awards",
    itemLabel: "Award",
    note: "One-off awards, offered when a record is added.",
  },
  /*
   * Priced in months rather than points, but the same shape: a map of name to
   * number. `wholeDoc` because the Weapons document does not exist on any
   * squadron until its first weapon is added, and setPrice/removePrice go
   * through updateDoc, which rejects on a missing document.
   */
  weapons: {
    doc: DOCS.weapons,
    field: "Weapons",
    shape: "priced",
    wholeDoc: true,
    valueLabel: "Valid for (months)",
    valueShort: "Months",
    title: "Weapons",
    itemLabel: "Weapon",
    note: "Weapon handling tests the PTS tracker has a column for, and how long a pass lasts.",
  },
};

export const useRecordCategories = () => {
  const { squadronNumber } = useSquadron();
  const { data, setData } = useContext(DataContext);

  /** Each list, already in the shape a table wants. */
  const lists = useMemo(() => {
    const flightPoints = data.flightPoints || {};
    return Object.fromEntries(
      Object.entries(KINDS).map(([key, kind]) => {
        if (kind.shape === "priced") {
          return [
            key,
            Object.entries(flightPoints[kind.field] || {}).map(([name, points]) => ({
              id: `${key}:${name}`,
              name,
              points,
            })),
          ];
        }
        return [
          key,
          (flightPoints[kind.field]?.[kind.array] || []).map((name) => ({
            id: `${key}:${name}`,
            name,
            points: null,
          })),
        ];
      })
    );
  }, [data.flightPoints]);

  /** Patch a priced document in DataContext after a write. */
  const patchPriced = (kind, mutate) =>
    setData((prev) => ({
      ...prev,
      flightPoints: {
        ...prev.flightPoints,
        [kind.field]: mutate(prev.flightPoints?.[kind.field] || {}),
      },
    }));

  /** Patch a list document in DataContext after a write. */
  const patchList = (kind, values) =>
    setData((prev) => ({
      ...prev,
      flightPoints: {
        ...prev.flightPoints,
        [kind.field]: { ...prev.flightPoints?.[kind.field], [kind.array]: values },
      },
    }));

  /**
   * Add or rename an entry.
   *
   * A rename is a remove plus an add, because the NAME is the key -- there is
   * nothing else to update. Which means a rename loses any record that
   * referenced the old name, and this is the reason the classic screen's edit
   * popup removes before it sets rather than the other way round.
   */
  const save = async (kindKey, { previousName, name, points }) => {
    const kind = KINDS[kindKey];
    const trimmed = String(name).trim();
    if (!trimmed) return "Give it a name.";

    try {
      if (kind.wholeDoc) {
        const value = Number(points);
        if (!Number.isInteger(value) || value < 1) return "Months must be a whole number, 1 or more.";

        const stored = (await fetchDoc(squadronNumber, kind.doc)) || {};
        if (previousName !== trimmed && trimmed in stored) return "That already exists.";
        const next = { ...stored };
        if (previousName) delete next[previousName];
        next[trimmed] = value;

        await replaceDoc(squadronNumber, kind.doc, next);
        patchPriced(kind, () => next);
      } else if (kind.shape === "priced") {
        const value = Number(points);
        if (!Number.isFinite(value)) return "Points must be a number.";

        if (previousName && previousName !== trimmed) {
          await removePrice(squadronNumber, kind.doc, previousName);
        }
        await setPrice(squadronNumber, kind.doc, trimmed, value);

        patchPriced(kind, (current) => {
          const next = { ...current };
          if (previousName && previousName !== trimmed) delete next[previousName];
          next[trimmed] = value;
          return next;
        });
      } else {
        const stored = (await fetchDoc(squadronNumber, kind.doc)) || {};
        const currentList = stored[kind.array] || [];
        const next = previousName
          ? currentList.map((item) => (item === previousName ? trimmed : item))
          : [...currentList, trimmed];

        if (!previousName && currentList.includes(trimmed)) return "That already exists.";

        await setList(squadronNumber, kind.doc, kind.array, next);
        patchList(kind, next);
      }
      return null;
    } catch (error) {
      console.error("Error saving record category:", error);
      return "That could not be saved. Try again.";
    }
  };

  const remove = async (kindKey, name) => {
    const kind = KINDS[kindKey];
    try {
      if (kind.wholeDoc) {
        const next = { ...((await fetchDoc(squadronNumber, kind.doc)) || {}) };
        delete next[name];
        await replaceDoc(squadronNumber, kind.doc, next);
        patchPriced(kind, () => next);
      } else if (kind.shape === "priced") {
        await removePrice(squadronNumber, kind.doc, name);
        patchPriced(kind, (current) => {
          const next = { ...current };
          delete next[name];
          return next;
        });
      } else {
        const stored = (await fetchDoc(squadronNumber, kind.doc)) || {};
        const next = (stored[kind.array] || []).filter((item) => item !== name);
        await setList(squadronNumber, kind.doc, kind.array, next);
        patchList(kind, next);
      }
      return null;
    } catch (error) {
      console.error("Error deleting record category:", error);
      return "That could not be deleted. Try again.";
    }
  };

  return { lists, save, remove };
};

export default useRecordCategories;
