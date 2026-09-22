import { useContext, useMemo, useState } from "react";
import { DataContext } from "../../../context/DataContext";
import { useSquadron } from "../../../context/SquadronContext";
import { badgeLevel } from "../../../utils/examList";
import { getAssignableFlights } from "../../../utils/flights";
import { useSaveEvent } from "../../../databaseTools/databaseTools";
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
 */

const ALL = "all";

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

const MusterPTSTracker = ({ user }) => {
  const { data } = useContext(DataContext);
  const { flightMap, flights } = useSquadron();
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
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data.cadets,
    data.events,
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
    const current = subjects === null ? categories : subjects;
    const next = current.includes(category)
      ? current.filter((entry) => entry !== category)
      : [...current, category];
    setSubjects(next.length === categories.length ? null : next);
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
    {
      key: "held",
      header: "Held",
      align: "right",
      width: "84px",
      sortValue: (row) => row.held,
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
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={showSubject(category) ? styles["chip-on"] : styles["chip-off"]}
                  aria-pressed={showSubject(category)}
                  onClick={() => toggleSubject(category)}
                >
                  {category}
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
    </MusterPage>
  );
};

export default MusterPTSTracker;
