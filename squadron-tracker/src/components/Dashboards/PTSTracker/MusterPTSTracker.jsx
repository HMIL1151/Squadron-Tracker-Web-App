import { useContext, useMemo, useState } from "react";
import { DataContext } from "../../../context/DataContext";
import { useSquadron } from "../../../context/SquadronContext";
import { badgeLevel } from "../../../utils/examList";
import { getAssignableFlights } from "../../../utils/flights";
import { useSaveEvent } from "../../../databaseTools/databaseTools";
import {
  getWeapons,
  isExpired,
  latestWeaponPasses,
  todayIso,
  weaponExpiry,
} from "../../../utils/weapons";
import {
  AVIATION,
  AVIATION_KINDS,
  aviationRecords,
  buildOverride,
  summariseAviation,
  validateOverride,
} from "../../../utils/aviation";
import { setAviationOverride } from "../../../firebase/cadets";
import MusterPage from "../../Muster/MusterPage";
import MusterTable from "../../Muster/MusterTable";
import MusterDialog from "../../Muster/MusterDialog";
import MusterField from "../../Muster/MusterField";
import {
  FlightMark,
  MusterButton,
  MusterChip,
  MusterEmpty,
  MusterSearch,
  MusterSelect,
} from "../../Muster/MusterControls";
import styles from "./MusterPTSTracker.module.css";

/**
 * The PTS tracker, Muster.
 *
 * One row per cadet, one column per syllabus area, and each cell showing the
 * HIGHEST badge held rather than every badge held. A cadet with Blue, Bronze
 * and Silver Radio has Silver Radio; listing all three is three times the ink
 * for one fact, and it is the fact -- how far up each ladder someone is --
 * that the tracker exists to answer.
 *
 * The cell shows the DATE the badge was awarded, tinted by its level. A chip
 * reading "Silver" only repeats what its colour already says; the date is the
 * thing staff are after -- whether a pass is recent, and what goes on a
 * certificate.
 *
 * Clicking an empty cell awards that badge, the same way the classic tracker
 * does and through the same useSaveEvent hook.
 *
 * Blue, bronze, silver and gold keep their own colours in both themes. The
 * colour IS the level here, the same way a flight colour is the flight, and
 * recolouring a gold badge to suit a background would destroy the thing it is
 * communicating.
 *
 * The board is the screen, so it gets the room.
 *
 * An earlier version led with five tall tiles counting awards by level, and
 * on a 900px-high window that left eleven of forty cadets visible. The counts
 * now ride on the level filters themselves -- "Blue 54" is a chip you can
 * click -- which costs nothing and buys back a third of the rows. What is
 * left above the table is the one fact the board genuinely cannot show: the
 * syllabus areas nobody holds anything in, which are invisible on a screen
 * that only displays what people have.
 *
 * All three of the classic tracker's filters are here -- level, syllabus area
 * and date range -- because they are why the screen gets opened. "Who has
 * their DofE" and "who got a Bronze this year" are questions about a slice of
 * the log, not about all of it, and the first version of this screen shipped
 * with none of them.
 *
 * Every count obeys every filter. A total that ignores the control sitting
 * above it is a total nobody can use.
 *
 * Weapon handling tests ride along at the right-hand end, one column per
 * weapon configured under Record Categories. They are the exception to the
 * rule above, deliberately: a WHT is a currency, not an achievement, and the
 * only question about it is "is this cadet in date TODAY" -- so the level and
 * date-range filters, which are about what was awarded when, leave these
 * columns alone. They do have a Subjects chip of their own, which shows or
 * hides the columns and nothing else. The cell shows the latest pass and goes red on
 * the day it runs out; clicking any weapon cell records a pass, because a
 * re-test is the normal thing to do to one that has expired.
 *
 * Flying and gliding come last, two columns each: how many, and when the most
 * recent was. They are counted from the event log -- any Event/Other record
 * tagged, or guessed, as a flight or glide (utils/aviation.js) -- and they
 * share the weapons' exemption from the level and date filters for a related
 * reason: "how many times has this cadet flown" is a running total, and a
 * total that drops when someone narrows the badge date range has stopped
 * being one. All four columns sit behind one "Flying" Subjects chip.
 *
 * Any of the four cells can be clicked to set the figure by hand, because the
 * log only knows what was typed into it: a cadet with ten flights from before
 * the squadron used this app shows zero until someone says otherwise. The
 * hand-set figure is stored on the cadet and the log keeps adding to it --
 * set 10, log a flight, read 11 -- rather than replacing the log, which would
 * freeze the column at whatever was typed. A total that includes a hand-set
 * figure is marked, so nobody mistakes it for one the log can back up.
 */

const ALL = "all";

/*
 * The Subjects chips that are not badge subjects, keyed so that no subject a
 * staff member types can collide with them. FLYING_SUBJECT is only used when
 * the squadron has no Flying badge subject; see `flyingKey`.
 */
const WEAPONS_SUBJECT = "@@weapons";
const FLYING_SUBJECT = "@@flying";

const MONTHS = [
  { value: "01", label: "Jan" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Apr" },
  { value: "05", label: "May" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Aug" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];

/*
 * Explicit map rather than `styles["level-" + level]`. Scoped class names do
 * not survive string concatenation, and a missed lookup renders
 * class="undefined" rather than failing.
 */
const LEVEL_CLASS = {
  Blue: styles["level-blue"],
  Bronze: styles["level-bronze"],
  Silver: styles["level-silver"],
  Gold: styles["level-gold"],
};

const LEVEL_DOT = {
  Blue: styles["dot-blue"],
  Bronze: styles["dot-bronze"],
  Silver: styles["dot-silver"],
  Gold: styles["dot-gold"],
};

/** Where a level sits on the ladder; higher wins when a cadet holds several. */
const rankOf = (level) => badgeLevel.indexOf(level);

/** "18 Apr 2025", which fits a cell and is how people say a date. */
const shortDate = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

/**
 * The two ways to read the board.
 *
 * "Highest Held" is one cell per syllabus area showing the top badge and
 * when it was awarded -- the summary a training officer wants most of the
 * time. "Every Level" is the classic layout: four columns per area, one per
 * level, which is what you need when checking a specific badge or awarding
 * one that sits below a level already held.
 *
 * The summary cannot express that second case at all: a cadet holding Silver
 * Radio has one cell, so there is nowhere to click to record the Bronze they
 * were awarded late.
 */
/*
 * Every Level opens by default.
 *
 * "Highest held" is the tidier board and was the original default, but the
 * question people bring to this screen is which badges a cadet has, not how
 * far up one ladder they got -- and the full board is what the classic
 * tracker showed. Highest Held stays one click away.
 */
const VIEWS = {
  levels: "Every Level",
  summary: "Highest Held",
};

/**
 * What the log says, and -- when a hand-set total is in play -- who set it and
 * what has been added since. The person about to change a figure needs both
 * halves: changing a total without seeing what the log already backs up is
 * how a cadet's flights get counted twice.
 */
const aviationDescription = ({ row, kind }) => {
  const { noun, nouns } = AVIATION[kind];
  const summary = row.aviation[kind];
  const plural = (count) => `${count} ${count === 1 ? noun : nouns}`;
  const logged =
    summary.logged === 0
      ? `The event log has no ${nouns} for ${row.name}.`
      : `The event log has ${plural(summary.logged)} for ${row.name}, the last on ${shortDate(
          summary.loggedLast
        )}.`;
  if (!summary.manual) return logged;
  const setOn = summary.setAt ? ` on ${shortDate(summary.setAt.slice(0, 10))}` : "";
  const since = summary.added
    ? `, and ${plural(summary.added)} logged since ${summary.added === 1 ? "has" : "have"} been added to it.`
    : ".";
  return `${logged} The total was set by hand by ${summary.setBy}${setOn}${since}`;
};

const MusterPTSTracker = ({ user }) => {
  const { data, setData } = useContext(DataContext);
  const { flightMap, flights, squadronNumber } = useSquadron();
  const saveEvent = useSaveEvent();

  const [search, setSearch] = useState("");
  const [flightFilter, setFlightFilter] = useState(ALL);
  const [view, setView] = useState("levels");
  const [levels, setLevels] = useState(badgeLevel);
  /*
   * null means "all of them", rather than a copy of the list.
   *
   * The syllabus areas are derived from the squadron's data, so seeding state
   * with them means a subject configured later is silently filtered OUT by a
   * selection made before it existed. null cannot go stale.
   */
  const [subjects, setSubjects] = useState(null);
  const [period, setPeriod] = useState(ALL);
  const [startMonth, setStartMonth] = useState("01");
  const [endMonth, setEndMonth] = useState("12");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [pending, setPending] = useState(null);
  const [pendingLevel, setPendingLevel] = useState(badgeLevel[0]);
  const [pendingDate, setPendingDate] = useState("");
  const [dialogError, setDialogError] = useState(null);
  const [pendingWeapon, setPendingWeapon] = useState(null);
  const [weaponDate, setWeaponDate] = useState("");
  const [pendingAviation, setPendingAviation] = useState(null);
  const [aviationCount, setAviationCount] = useState("");
  const [aviationDate, setAviationDate] = useState("");

  /*
   * The syllabus areas, from the squadron's own badge list rather than a
   * constant -- squadrons run different subjects. Anything appearing in the
   * event log but missing from the list is added, so a badge awarded before a
   * subject was configured still shows up somewhere.
   */
  const categories = useMemo(() => {
    const configured = data.flightPoints?.Badges?.["Badge Types"] || [];
    const seen = new Set(configured);
    (data.events || []).forEach((event) => {
      if (event.badgeCategory) seen.add(event.badgeCategory);
    });
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [data.flightPoints, data.events]);

  const weapons = useMemo(() => getWeapons(data.flightPoints), [data.flightPoints]);
  const weaponPasses = useMemo(() => latestWeaponPasses(data.events), [data.events]);
  const flyingRecords = useMemo(() => aviationRecords(data.events), [data.events]);
  const today = todayIso();

  /** Every year a badge was awarded in, newest first, for the range selects. */
  const badgeYears = useMemo(() => {
    const seen = new Set();
    (data.events || []).forEach((event) => {
      if (event.badgeLevel && event.badgeCategory && event.date) {
        seen.add(event.date.slice(0, 4));
      }
    });
    return [...seen].sort((a, b) => b.localeCompare(a));
  }, [data.events]);

  /*
   * The range defaults to everything, and is derived rather than seeded into
   * state by an effect: a cadet awarded a badge in a new year would otherwise
   * be outside a range that was fixed when the screen first rendered.
   */
  const fromYear = startYear || badgeYears.at(-1) || "";
  const toYear = endYear || badgeYears[0] || "";

  /**
   * Whether an award falls inside the chosen window.
   *
   * String comparison on YYYYMMDD, and the end bound is day 31 so that
   * choosing a month means the whole of it. Same rule as the classic tracker,
   * deliberately -- the two screens must not disagree about what "March to
   * June" contains.
   */
  const inPeriod = (date) => {
    if (period === ALL) return true;
    if (!date || !fromYear || !toYear) return false;
    const value = date.replace(/-/g, "");
    return value >= fromYear + startMonth + "01" && value <= toYear + endMonth + "31";
  };

  const counts = (event) =>
    levels.includes(event.badgeLevel) &&
    (subjects === null || subjects.includes(event.badgeCategory)) &&
    inPeriod(event.date);

  const showSubject = (category) => subjects === null || subjects.includes(category);
  const visibleCategories = categories.filter(showSubject);

  /*
   * Weapon handling and flying ride on the Subjects chips too, after the
   * badge subjects. Only the chips: the level and date filters still leave
   * those columns alone, for the reasons at the top of this file -- but
   * "which columns am I looking at" is exactly what Subjects is for, and a
   * board you could not narrow to just the WHTs was a board with no way to
   * answer "who is out of date on the rifle" without scrolling sideways.
   *
   * One chip for flying AND gliding: they are one area of the syllabus, and
   * two chips for four narrow columns is more control than anyone asked for.
   * The weapons chip only exists once a weapon is configured, like the
   * columns it controls.
   *
   * A squadron with a Flying BADGE subject gets one Flying chip, not two.
   * The first version kept them apart, on the theory that two things with
   * the same name should not switch each other -- and so the Flying chip
   * people clicked hid the flight counts and left the Flying badges on the
   * board, which is the opposite of what "show me flying" means. Badges,
   * flights and glides are all the one syllabus area. The flying columns
   * therefore follow the badge subject's own chip when there is one, and
   * get the sentinel chip only when there is not.
   */
  const flyingKey =
    categories.find((category) => category.trim().toLowerCase() === "flying") || FLYING_SUBJECT;
  const subjectChips = [
    ...categories.map((category) => ({ key: category, label: category })),
    ...(weapons.length ? [{ key: WEAPONS_SUBJECT, label: "Weapon Handling" }] : []),
    ...(flyingKey === FLYING_SUBJECT ? [{ key: FLYING_SUBJECT, label: "Flying" }] : []),
  ];
  const subjectKeys = subjectChips.map((chip) => chip.key);

  const rows = useMemo(() => {
    const events = data.events || [];

    return (data.cadets || []).map((cadet) => {
      const name = `${cadet.forename} ${cadet.surname}`;
      const own = events.filter(
        (event) => event.cadetName === name && event.badgeLevel && event.badgeCategory
      );
      const counted = own.filter(counts);

      /*
       * Areas the cadet holds SOMETHING in, whatever the filters say.
       *
       * The summary cell is a button that awards a badge when it is empty, so
       * "holds nothing here" and "holds something the filter is hiding" cannot
       * render the same way: offering to award a Radio badge to a cadet who
       * already has a Gold one, because Gold is switched off, is how you get
       * a duplicate award. The first shows a +, the second a dash.
       */
      const everHeld = new Set(own.map((event) => event.badgeCategory));

      /*
       * The highest level held in each area, and the date it was awarded.
       * A cadet with Blue, Bronze and Silver Radio holds Silver Radio; the
       * other two are history the event log already has.
       */
      const highest = {};
      /*
       * Every level held, keyed "Radio:Silver", for the expanded view. The
       * summary only needs the top one, but deriving both here means the
       * two views cannot disagree about what a cadet holds.
       */
      const byLevel = {};
      counted.forEach((event) => {
        const current = highest[event.badgeCategory];
        if (!current || rankOf(event.badgeLevel) > rankOf(current.level)) {
          highest[event.badgeCategory] = { level: event.badgeLevel, date: event.date };
        }
        byLevel[event.badgeCategory + ":" + event.badgeLevel] = event.date;
      });

      return {
        id: cadet.id,
        name,
        flight: cadet.flight,
        flightName: flightMap[cadet.flight] || "Unassigned",
        highest,
        byLevel,
        everHeld,
        held: Object.keys(highest).length,
        weaponPasses: weaponPasses[name] || {},
        /*
         * The records stay on the row beside the summary: setting a total by
         * hand has to know exactly which records it is taking account of.
         */
        aviationRecords: flyingRecords[name] || { flying: [], gliding: [] },
        aviation: Object.fromEntries(
          AVIATION_KINDS.map((kind) => [
            kind,
            summariseAviation(flyingRecords[name]?.[kind], cadet[AVIATION[kind].field]),
          ])
        ),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data.cadets,
    data.events,
    weaponPasses,
    flyingRecords,
    flightMap,
    levels,
    subjects,
    period,
    startMonth,
    endMonth,
    fromYear,
    toYear,
  ]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (flightFilter !== ALL && String(row.flight) !== flightFilter) return false;
        if (!needle) return true;
        return row.name.toLowerCase().includes(needle);
      })
      // Most badges first: the tracker is read to see who is furthest on.
      .sort((a, b) => b.held - a.held || a.name.localeCompare(b.name));
  }, [rows, search, flightFilter]);

  /**
   * The number beside each level, and the areas nobody holds anything in.
   *
   * Counted within the date range and the chosen subjects, but NOT within the
   * level selection: a chip reading "Blue 0" because Blue is switched off
   * would be a lie about the squadron. The chip goes pale instead, which says
   * "excluded" rather than "none".
   */
  const summary = useMemo(() => {
    const events = (data.events || []).filter(
      (event) =>
        event.badgeLevel &&
        event.badgeCategory &&
        showSubject(event.badgeCategory) &&
        inPeriod(event.date)
    );
    const byLevel = {};
    badgeLevel.forEach((level) => {
      byLevel[level] = events.filter((event) => event.badgeLevel === level).length;
    });
    const untouched = visibleCategories.filter(
      (category) => !events.some((event) => event.badgeCategory === category)
    );
    return { byLevel, untouched, total: events.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.events, categories, subjects, period, startMonth, endMonth, fromYear, toYear]);

  const filtersActive =
    search !== "" ||
    flightFilter !== ALL ||
    period !== ALL ||
    levels.length !== badgeLevel.length ||
    subjects !== null;

  const clearFilters = () => {
    setSearch("");
    setFlightFilter(ALL);
    setPeriod(ALL);
    setLevels(badgeLevel);
    setSubjects(null);
  };

  const toggleLevel = (level) =>
    setLevels((current) =>
      current.includes(level) ? current.filter((entry) => entry !== level) : [...current, level]
    );

  /*
   * A plain toggle, and deliberately so.
   *
   * The first version made a click from the everything state mean "just this
   * one", to get "show me DofE" down to a single click. It made the opposite
   * job -- hide the one subject you do not care about -- both impossible and
   * surprising: you clicked Sports to lose it and lost the other fourteen
   * instead. "Only DofE" is None then DofE, two clicks, exactly as it is in
   * the classic tracker, and every click now does the one thing it looks
   * like it does.
   */
  const toggleSubject = (category) => {
    const current = subjects === null ? subjectKeys : subjects;
    const next = current.includes(category)
      ? current.filter((entry) => entry !== category)
      : [...current, category];
    setSubjects(next.length === subjectKeys.length ? null : next);
  };

  const openAward = (row, category, level = null) => {
    setPending({ cadetName: row.name, category, level });
    setPendingLevel(level || badgeLevel[0]);
    setPendingDate("");
    setDialogError(null);
  };

  const closeAward = () => {
    setPending(null);
    setDialogError(null);
  };

  const confirmAward = async () => {
    if (!pendingDate) {
      setDialogError("Pick the date the badge was awarded.");
      return;
    }

    try {
      const { error } = await saveEvent({
        createdAt: new Date(),
        addedBy: user?.displayName || "Unknown",
        cadetName: [pending.cadetName],
        date: pendingDate,
        badgeCategory: pending.category,
        badgeLevel: pendingLevel,
        examName: "",
        eventName: "",
        eventCategory: "",
        specialAward: "",
      });
      if (error) {
        setDialogError(error);
        return;
      }
      closeAward();
    } catch (err) {
      console.error("Error awarding badge:", err);
      setDialogError("That could not be saved. Try again.");
    }
  };

  const openWeapon = (row, weapon) => {
    setPendingWeapon({ cadetName: row.name, weapon, lastPass: row.weaponPasses[weapon.name] });
    setWeaponDate("");
    setDialogError(null);
  };

  const closeWeapon = () => {
    setPendingWeapon(null);
    setDialogError(null);
  };

  const confirmWeapon = async () => {
    if (!weaponDate) {
      setDialogError("Pick the date the test was passed.");
      return;
    }

    try {
      const { error, skippedDuplicates } = await saveEvent({
        createdAt: new Date(),
        addedBy: user?.displayName || "Unknown",
        cadetName: [pendingWeapon.cadetName],
        date: weaponDate,
        badgeCategory: "",
        badgeLevel: "",
        examName: "",
        eventName: "",
        eventCategory: "",
        specialAward: "",
        weaponName: pendingWeapon.weapon.name,
      });
      if (error) {
        setDialogError(error);
        return;
      }
      if (skippedDuplicates?.length) {
        setDialogError("That pass is already recorded.");
        return;
      }
      closeWeapon();
    } catch (err) {
      console.error("Error recording weapon handling test:", err);
      setDialogError("That could not be saved. Try again.");
    }
  };

  const openAviation = (row, kind) => {
    const current = row.aviation[kind];
    setPendingAviation({ row, kind });
    // Starts from what the board shows, so changing one field keeps the other.
    setAviationCount(String(current.count));
    setAviationDate(current.last || "");
    setDialogError(null);
  };

  const closeAviation = () => {
    setPendingAviation(null);
    setDialogError(null);
  };

  /** Write (or with null, clear) an override, then patch DataContext to match. */
  const storeOverride = async (row, kind, override) => {
    const { field } = AVIATION[kind];
    await setAviationOverride(squadronNumber, row.id, field, override);
    setData((prev) => ({
      ...prev,
      cadets: (prev.cadets || []).map((cadet) => {
        if (cadet.id !== row.id) return cadet;
        const next = { ...cadet };
        if (override) next[field] = override;
        else delete next[field];
        return next;
      }),
    }));
  };

  const confirmAviation = async () => {
    const { row, kind } = pendingAviation;
    const current = row.aviation[kind];
    const error = validateOverride({ count: aviationCount, lastDate: aviationDate, today, kind });
    if (error) {
      setDialogError(error);
      return;
    }

    const count = Number(aviationCount);
    /*
     * Saving what the log already says, on a cadet with no override, is a
     * no-op rather than a new override. Otherwise opening a cell and pressing
     * Save would quietly pin the cadet to a hand-set figure nobody chose.
     */
    if (!current.manual && count === current.count && aviationDate === (current.last || "")) {
      closeAviation();
      return;
    }

    try {
      await storeOverride(
        row,
        kind,
        buildOverride({
          count,
          lastDate: aviationDate,
          records: row.aviationRecords[kind],
          setBy: user?.displayName,
        })
      );
      closeAviation();
    } catch (err) {
      console.error("Error saving flying total:", err);
      setDialogError("That could not be saved. Try again.");
    }
  };

  const clearAviation = async () => {
    const { row, kind } = pendingAviation;
    try {
      await storeOverride(row, kind, null);
      closeAviation();
    } catch (err) {
      console.error("Error clearing flying total:", err);
      setDialogError("That could not be cleared. Try again.");
    }
  };

  /** Whether a cadet is in date on a weapon; undefined when never passed. */
  const weaponStatus = (row, weapon) => {
    const passed = row.weaponPasses[weapon.name];
    if (!passed) return undefined;
    const expiry = weaponExpiry(passed, weapon.months);
    return { passed, expiry, expired: isExpired(expiry, today) };
  };

  /*
   * Grouped under one heading in the Every Level view, where every other
   * column already sits under its syllabus area; ungrouped in Highest Held,
   * which has no group row to put it in.
   */
  const weaponColumns = weapons.map((weapon) => ({
    key: "weapon:" + weapon.name,
    header: weapon.name,
    group: view === "levels" ? "Weapon Handling" : undefined,
    align: "center",
    width: "120px",
    sortValue: (row) => weaponStatus(row, weapon)?.expiry || "",
    /* How many cadets are IN DATE -- an expired pass is not a qualification. */
    total: (rows) => rows.filter((row) => weaponStatus(row, weapon)?.expired === false).length,
    render: (row) => {
      const status = weaponStatus(row, weapon);
      if (!status) {
        return (
          <button
            type="button"
            className={styles.add}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              openWeapon(row, weapon);
            }}
          >
            <span aria-hidden="true">+</span>
            <span className={styles["visually-hidden"]}>
              Record a {weapon.name} handling test for {row.name}
            </span>
          </button>
        );
      }
      const label = status.expired
        ? `Expired ${shortDate(status.expiry)}`
        : `In date until ${shortDate(status.expiry)}`;
      return (
        <button
          type="button"
          className={status.expired ? styles["weapon-expired"] : styles["weapon-valid"]}
          title={`${weapon.name}: passed ${shortDate(status.passed)}. ${label}.`}
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
            openWeapon(row, weapon);
          }}
        >
          {shortDate(status.passed)}
          <span className={styles["visually-hidden"]}>
            {` (${label}. Record a new ${weapon.name} pass for ${row.name})`}
          </span>
        </button>
      );
    },
  }));

  /*
   * Two columns per kind, grouped in the Every Level view like the weapons.
   * Both cells open the same dialog -- the total and the date are one fact
   * about the cadet, and which half was clicked is not worth a second dialog.
   */
  const aviationColumns = AVIATION_KINDS.flatMap((kind) => {
    const { group, countHeader, lastHeader, noun, nouns } = AVIATION[kind];
    const describe = (row) => {
      const { count, last, manual } = row.aviation[kind];
      return (
        `${count} ${count === 1 ? noun : nouns}` +
        (last ? `, last on ${shortDate(last)}` : "") +
        (manual ? ", including a total set by hand" : "")
      );
    };
    const cell = (row, content, className) => (
      <button
        type="button"
        className={className}
        title={row.aviation[kind].manual ? "Includes a total set by hand" : undefined}
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          openAviation(row, kind);
        }}
      >
        {content}
        <span className={styles["visually-hidden"]}>
          {` (${row.name}: ${describe(row)}. Edit ${group.toLowerCase()} record)`}
        </span>
      </button>
    );
    const grouped = view === "levels" ? group : undefined;

    return [
      {
        key: kind + ":count",
        header: countHeader,
        group: grouped,
        align: "center",
        width: "84px",
        sortValue: (row) => row.aviation[kind].count,
        total: (rows) => rows.reduce((sum, row) => sum + row.aviation[kind].count, 0),
        render: (row) => {
          const { count, manual } = row.aviation[kind];
          return cell(
            row,
            <>
              {count}
              {manual && (
                <span className={styles["aviation-manual"]} aria-hidden="true">
                  *
                </span>
              )}
            </>,
            count ? styles["aviation-count"] : styles["aviation-empty"]
          );
        },
      },
      {
        key: kind + ":last",
        header: lastHeader,
        group: grouped,
        align: "center",
        width: "120px",
        sortValue: (row) => row.aviation[kind].last || "",
        render: (row) => {
          const { last } = row.aviation[kind];
          return last
            ? cell(row, shortDate(last), styles["aviation-date"])
            : cell(row, <span aria-hidden="true">&mdash;</span>, styles["aviation-empty"]);
        },
      },
    ];
  });

  /*
   * Four columns per area in the expanded view, grouped under the area name
   * so it is written once rather than prefixed onto all four headings.
   */
  const levelColumns = visibleCategories.flatMap((category) =>
    badgeLevel.filter((level) => levels.includes(level)).map((level) => ({
      key: category + ":" + level,
      header: level,
      group: category,
      align: "center",
      width: "104px",
      sortValue: (row) => row.byLevel[category + ":" + level] || "",
      /* How many cadets hold this one, the way the classic tracker counts. */
      total: (rows) => rows.filter((row) => row.byLevel[category + ":" + level]).length,
      render: (row) => {
        const date = row.byLevel[category + ":" + level];
        if (!date) {
          return (
            <button
              type="button"
              className={styles.add}
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                openAward(row, category, level);
              }}
            >
              <span aria-hidden="true">+</span>
              <span className={styles["visually-hidden"]}>
                Award {level} {category} to {row.name}
              </span>
            </button>
          );
        }
        return (
          <span className={LEVEL_CLASS[level] || styles["level-blue"]}>{shortDate(date)}</span>
        );
      },
    }))
  );

  const columns = [
    {
      key: "cadet",
      header: "Cadet",
      width: "260px",
      sortValue: (row) => row.name,
      /*
       * No filterValue, and so no column-filter row at all on this board.
       * The toolbar already has a cadet search next to the flight filter, and
       * two boxes that filter cadets by name -- one of them costing a whole
       * row of header -- is one box too many.
       */
      /*
       * Just the name, with the flight as a colour mark beside it.
       *
       * The flight was written out here and is now only the mark, which buys
       * the name the whole column. It is NOT colour-only: the flight is in
       * the mark's title and in text only a screen reader reads, because a
       * flight identified by hue alone is a flight some of your staff cannot
       * read. The Flight filter above the board is the way to work by flight.
       */
      render: (row) => (
        <span className={styles.cadet} title={`${row.name} — ${row.flightName}`}>
          <FlightMark flight={row.flight} />
          <span className={styles["cadet-name"]}>{row.name}</span>
          <span className={styles["visually-hidden"]}>{row.flightName}</span>
        </span>
      ),
    },
    ...(view === "levels" ? levelColumns : visibleCategories.map((category) => ({
      key: category,
      header: category,
      align: "center",
      sortValue: (row) => row.highest[category]?.date || "",
      total: (rows) => rows.filter((row) => row.highest[category]).length,
      render: (row) => {
        const held = row.highest[category];
        if (!held) {
          /* Held, but outside the filter: a dash, never an offer to award it again. */
          if (row.everHeld.has(category)) {
            return (
              <span className={styles.filtered} title="Held, but outside the current filter">
                &mdash;
              </span>
            );
          }
          return (
            <button
              type="button"
              className={styles.add}
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                openAward(row, category);
              }}
            >
              <span aria-hidden="true">+</span>
              <span className={styles["visually-hidden"]}>
                Award a {category} badge to {row.name}
              </span>
            </button>
          );
        }
        return (
          <span
            className={LEVEL_CLASS[held.level] || styles["level-blue"]}
            title={held.level + " " + category}
          >
            {shortDate(held.date)}
            <span className={styles["visually-hidden"]}> ({held.level})</span>
          </span>
        );
      },
    }))),
    ...(showSubject(WEAPONS_SUBJECT) ? weaponColumns : []),
    ...(showSubject(flyingKey) ? aviationColumns : []),
    {
      key: "held",
      header: "Held",
      align: "right",
      width: "84px",
      sortValue: (row) => row.held,
      total: (rows) => rows.reduce((sum, row) => sum + row.held, 0),
      render: (row) => <strong>{row.held}</strong>,
    },
  ];

  return (
    <MusterPage
      title="PTS Tracker"
      description="The highest badge held in each syllabus area. A dash means nothing recorded yet."
    >
      {summary.untouched.length > 0 && (
        <section className={styles.gaps} aria-label="Syllabus Gaps">
          <span className={styles["gaps-label"]}>Nobody holds a badge in</span>
          <ul className={styles["gaps-list"]}>
            {summary.untouched.map((category) => (
              <li key={category} className={styles["gaps-item"]}>
                {category}
              </li>
            ))}
          </ul>
        </section>
      )}

      <MusterTable
        columns={columns}
        rows={visible}
        getRowKey={(row) => row.id}
        defaultSort={{ key: "held", direction: "desc" }}
        stickyFirstColumn
        dense
        showTotals
        toolbar={
          <>
            <MusterSearch
              label="Search cadets"
              value={search}
              onChange={setSearch}
              placeholder="Search cadets"
              width="220px"
            />
            <MusterSelect
              label="Flight"
              value={flightFilter}
              onChange={setFlightFilter}
              options={[
                { value: ALL, label: "All flights" },
                ...getAssignableFlights(flights).map((flight) => ({
                  value: String(flight.index),
                  label: flight.name,
                })),
              ]}
            />
            <MusterSelect
              label="Awarded"
              value={period}
              onChange={setPeriod}
              options={[
                { value: ALL, label: "All time" },
                { value: "range", label: "Date range" },
              ]}
            />

            {period === "range" && (
              <span className={styles.range}>
                <MusterSelect
                  label="From"
                  value={startMonth}
                  onChange={setStartMonth}
                  options={MONTHS}
                />
                <MusterSelect
                  label="Year"
                  value={fromYear}
                  onChange={setStartYear}
                  options={[...badgeYears].reverse().map((year) => ({ value: year, label: year }))}
                />
                <MusterSelect
                  label="To"
                  value={endMonth}
                  onChange={setEndMonth}
                  options={MONTHS}
                />
                <MusterSelect
                  label="Year"
                  value={toYear}
                  onChange={setEndYear}
                  options={badgeYears.map((year) => ({ value: year, label: year }))}
                />
              </span>
            )}

            <span className={styles.spacer} />

            {Object.entries(VIEWS).map(([key, label]) => (
              <MusterChip key={key} active={view === key} onClick={() => setView(key)}>
                {label}
              </MusterChip>
            ))}

            {/*
              * The legend IS the filter, and it carries the count.
              *
              * It was a static key. A row of four coloured labels that cannot
              * be clicked, sitting beside a row of chips that can, is a worse
              * lie than no key at all -- and the counts it now holds used to
              * be five tiles deep enough to cost a third of the visible rows.
              */}
            <fieldset className={styles.filters}>
              <legend className={styles["visually-hidden"]}>Badge levels to show</legend>
              <span className={styles["filters-label"]}>Levels</span>
              {badgeLevel.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={levels.includes(level) ? styles["chip-on"] : styles["chip-off"]}
                  aria-pressed={levels.includes(level)}
                  onClick={() => toggleLevel(level)}
                >
                  <span className={LEVEL_DOT[level]} aria-hidden="true" />
                  {level}
                  <span className={styles["chip-count"]}>{summary.byLevel[level]}</span>
                </button>
              ))}
              <button
                type="button"
                className={styles["chip-all"]}
                onClick={() => setLevels(levels.length === badgeLevel.length ? [] : badgeLevel)}
              >
                {levels.length === badgeLevel.length ? "None" : "All"}
              </button>
            </fieldset>

            <fieldset className={styles.filters}>
              <legend className={styles["visually-hidden"]}>Syllabus areas to show</legend>
              <span className={styles["filters-label"]}>Subjects</span>
              {subjectChips.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={showSubject(key) ? styles["chip-on"] : styles["chip-off"]}
                  aria-pressed={showSubject(key)}
                  onClick={() => toggleSubject(key)}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                className={styles["chip-all"]}
                onClick={() => setSubjects(subjects === null ? [] : null)}
              >
                {subjects === null ? "None" : "All"}
              </button>
            </fieldset>
          </>
        }
        empty={
          <MusterEmpty
            title="No Cadets Match"
            action={
              filtersActive ? <MusterButton onClick={clearFilters}>Clear Filters</MusterButton> : null
            }
          >
            Try another flight, a wider date range, or another badge level.
          </MusterEmpty>
        }
      />

      <MusterDialog
        open={Boolean(pending)}
        title="Award a Badge"
        description={pending ? pending.category + " for " + pending.cadetName + "." : ""}
        onClose={closeAward}
        onConfirm={confirmAward}
        confirmLabel="Award Badge"
        error={dialogError}
      >
        <MusterField
          label="Level"
          hint={pending?.level ? "Taken from the column you clicked." : undefined}
        >
          {(id) => (
            <select
              id={id}
              value={pendingLevel}
              onChange={(inputEvent) => setPendingLevel(inputEvent.target.value)}
            >
              {badgeLevel.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          )}
        </MusterField>
        <MusterField label="Date awarded" hint="The date on the certificate, not today.">
          {(id) => (
            <input
              id={id}
              type="date"
              value={pendingDate}
              onChange={(inputEvent) => setPendingDate(inputEvent.target.value)}
            />
          )}
        </MusterField>
      </MusterDialog>

      <MusterDialog
        open={Boolean(pendingWeapon)}
        title="Record a Weapon Handling Test"
        description={
          pendingWeapon
            ? `${pendingWeapon.weapon.name} for ${pendingWeapon.cadetName}. A pass lasts ${
                pendingWeapon.weapon.months
              } month${pendingWeapon.weapon.months === 1 ? "" : "s"}.`
            : ""
        }
        onClose={closeWeapon}
        onConfirm={confirmWeapon}
        confirmLabel="Record Pass"
        error={dialogError}
      >
        <MusterField
          label="Date passed"
          hint={
            pendingWeapon?.lastPass
              ? `Last passed ${shortDate(pendingWeapon.lastPass)}. A new pass replaces it on the board; the old one stays in the event log.`
              : undefined
          }
        >
          {(id) => (
            <input
              id={id}
              type="date"
              value={weaponDate}
              onChange={(inputEvent) => setWeaponDate(inputEvent.target.value)}
            />
          )}
        </MusterField>
      </MusterDialog>

      <MusterDialog
        open={Boolean(pendingAviation)}
        title={pendingAviation ? `${AVIATION[pendingAviation.kind].group} Record` : ""}
        description={pendingAviation ? aviationDescription(pendingAviation) : ""}
        onClose={closeAviation}
        onConfirm={confirmAviation}
        confirmLabel="Save"
        error={dialogError}
      >
        {pendingAviation && (
          <>
            <MusterField
              label={`Total ${AVIATION[pendingAviation.kind].nouns}`}
              hint={`Every ${AVIATION[pendingAviation.kind].noun} logged after you save is added on top of this.`}
            >
              {(id) => (
                <input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={aviationCount}
                  onChange={(inputEvent) => setAviationCount(inputEvent.target.value)}
                />
              )}
            </MusterField>
            <MusterField
              label={AVIATION[pendingAviation.kind].lastHeader}
              hint="Leave blank if nobody knows. A later one logged afterwards takes over."
            >
              {(id) => (
                <input
                  id={id}
                  type="date"
                  max={today}
                  value={aviationDate}
                  onChange={(inputEvent) => setAviationDate(inputEvent.target.value)}
                />
              )}
            </MusterField>
            {pendingAviation.row.aviation[pendingAviation.kind].manual && (
              <div className={styles["aviation-reset"]}>
                <MusterButton onClick={clearAviation}>Use the Event Log Only</MusterButton>
              </div>
            )}
          </>
        )}
      </MusterDialog>
    </MusterPage>
  );
};

export default MusterPTSTracker;
