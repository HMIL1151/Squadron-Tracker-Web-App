import { useContext, useMemo, useState } from "react";
import { DataContext } from "../../../context/DataContext";
import { useSquadron } from "../../../context/SquadronContext";
import { deriveClassifications, examsPassedBy } from "../../../utils/classification";
import { examList } from "../../../utils/examList";
import { getAssignableFlights } from "../../../utils/flights";
import { useSaveEvent } from "../../../databaseTools/databaseTools";
import MusterPage from "../../Muster/MusterPage";
import MusterTable from "../../Muster/MusterTable";
import MusterDialog from "../../Muster/MusterDialog";
import MusterField from "../../Muster/MusterField";
import {
  FlightMark,
  MusterBar,
  MusterButton,
  MusterChip,
  MusterEmpty,
  MusterSearch,
  MusterSelect,
} from "../../Muster/MusterControls";
import Graph from "./Graph";
import styles from "./MusterClassification.module.css";

/**
 * The classification tracker, Muster.
 *
 * Two views of the same thing, side by side.
 *
 * The scatter plot is the classic screen's, reused unchanged: classification
 * against service length, with the target line through it. It answers "is the
 * squadron keeping up" at a glance and nothing else does, which is why it is
 * back after a version without it.
 *
 * The exam board answers the other question -- what has this cadet actually
 * passed -- with a column per exam up to Leading. The Senior and Master papers
 * are a count rather than eleven more columns, because a cadet needs SIX of
 * them, not all eleven; which six is up to the squadron and the cadet.
 *
 * Clicking an empty cell records that exam, the same way the PTS tracker
 * records a badge, and clicking the cadet opens the same dialog with nothing
 * chosen yet. The second one is not a convenience: the board only has columns
 * up to Leading, so the six Senior and Master papers -- which is most of the
 * work between Leading and Master -- had no cell to click and could not be
 * recorded from this screen at all. The classic tracker could record any of
 * them, several at a time, and this is that back.
 *
 * Both go through useSaveEvent, so an exam added here is
 * indistinguishable from one added on the event log.
 */

const ALL = "all";

/** The exams that sit before Senior, in the order they are taken. */
const EARLY_EXAMS = ["Second Class Cadet", "First Class Cadet"];
const LEADING_EXAMS = examList.filter((exam) => exam.startsWith("Leading:"));
const SENIOR_EXAMS = examList.filter((exam) => exam.startsWith("Senior/Master:"));

/**
 * How many Senior/Master papers a cadet actually needs.
 *
 * Eleven exist; six are required. Showing "2 of 11" tells a cadet they are
 * further off than they are, and tells a training officer to plan five exams
 * nobody has to sit.
 */
const SENIOR_TARGET = 6;

/** How the current classification reads as a chip. Darker means further on. */
const TONE = {
  Master: styles["tone-6"],
  Senior: styles["tone-5"],
  Leading: styles["tone-4"],
  "First Class": styles["tone-3"],
  "Second Class": styles["tone-2"],
  Junior: styles["tone-1"],
};

/** The six named rungs, for the distribution strip. */
const RUNGS = ["Junior", "Second Class", "First Class", "Leading", "Senior", "Master"];

/** Which rung a classification label belongs to, ignoring the +1/+2 steps. */
const rungOf = (label) => RUNGS.find((rung) => String(label).startsWith(rung)) || "Junior";

/**
 * What an exam is called in a column heading two words wide.
 *
 * The stored names are full syllabus titles -- "Leading: Basic Navigation
 * using a Map and Compass Exam" is 46 characters over a 78px column, and
 * stripping the prefix and suffix still leaves 39.
 */
const SHORT_NAME = {
  // "Flight" alone would sit two columns from the Alpha/Bravo flight and
  // mean something completely different. PoF is what people write on a
  // training programme anyway.
  "Leading: Principles of Flight Exam": "PoF",
  "Leading: Airmanship Knowledge Exam": "Airmanship",
  "Leading: Basic Navigation using a Map and Compass Exam": "Navigation",
};

const shortExamName = (exam) =>
  SHORT_NAME[exam] ||
  exam.replace(/^Leading:\s*/, "").replace(/\s*Exam$/, "").replace(/\s*Cadet$/, "");

/** "18 Apr 2025", which is what fits in a cell and how people say a date. */
const shortDate = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const BOARD_EXAMS = [...EARLY_EXAMS, ...LEADING_EXAMS];

const MusterClassification = ({ user }) => {
  const { data } = useContext(DataContext);
  const { flightMap, flights } = useSquadron();
  const saveEvent = useSaveEvent();

  const [search, setSearch] = useState("");
  const [flightFilter, setFlightFilter] = useState(ALL);
  const [nearlyOnly, setNearlyOnly] = useState(false);
  const [pending, setPending] = useState(null);
  /*
   * A list, because a cadet who has just done a weekend of papers has three
   * or four to enter and the classic dialog took them in one go. The last row
   * is always blank: filling it grows another, so there is no "add a row"
   * button to find.
   */
  const [entries, setEntries] = useState([{ exam: "", date: "" }]);
  /*
   * Which cadet the pointer is over on the plot. The classic screen highlights
   * that cadet's row in the table, which is most of what the plot is for --
   * a dot at 30 months and Second Class is only useful once you know who it
   * is. The plot here was wired to two empty functions.
   */
  const [hovered, setHovered] = useState(null);
  const [dialogError, setDialogError] = useState(null);

  const derived = useMemo(
    () => deriveClassifications(data.cadets || [], data.events || []),
    [data.cadets, data.events]
  );

  const rows = useMemo(() => {
    const events = data.events || [];
    return derived.map((entry) => {
      const passed = new Map(
        examsPassedBy(entry.cadetName, events).map((e) => [e.examName, e.date])
      );
      const seniorCount = SENIOR_EXAMS.filter((exam) => passed.has(exam)).length;

      return {
        id: entry.cadet.id,
        name: entry.cadetName,
        flight: entry.cadet.flight,
        flightName: flightMap[entry.cadet.flight] || "Unassigned",
        rung: rungOf(entry.classificationLabel),
        label: entry.classificationLabel,
        isBehind: entry.isBehind,
        targetLabel: entry.targetClassificationLabel,
        marks: BOARD_EXAMS.map((exam) => passed.get(exam) || null),
        /*
         * Every pass, not just the ones with a column. The dialog needs the
         * Senior and Master papers too: they are the ones the board cannot
         * show and the ones most likely to be entered here.
         */
        passed,
        seniorCount,
        /*
         * "One exam from the next classification" means the next pass
         * completes the rung they are working on. Only meaningful up to
         * Leading, where a rung is a fixed set; Senior and Master are a pick
         * of six from eleven.
         */
        nearlyThere:
          entry.classification < 6 &&
          BOARD_EXAMS.filter((exam) => !passed.has(exam)).length === 1,
      };
    });
  }, [derived, data.events, flightMap]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (flightFilter !== ALL && String(row.flight) !== flightFilter) return false;
      if (nearlyOnly && !row.nearlyThere) return false;
      if (!needle) return true;
      return row.name.toLowerCase().includes(needle);
    });
  }, [rows, search, flightFilter, nearlyOnly]);

  const distribution = useMemo(() => {
    const counts = RUNGS.map((rung) => ({
      rung,
      count: rows.filter((row) => row.rung === rung).length,
    }));
    const total = rows.length || 1;
    return counts.map((entry, index) => ({
      ...entry,
      width: `${(entry.count / total) * 100}%`,
      tone: styles[`band-${index + 1}`],
    }));
  }, [rows]);

  /** The plot's x axis, matching what the classic dashboard computes. */
  const longestService = useMemo(() => {
    const longest = Math.max(0, ...derived.map((entry) => entry.serviceLengthInMonths));
    return longest < 50 ? 50 : longest + 1;
  }, [derived]);

  const nearlyCount = rows.filter((row) => row.nearlyThere).length;

  /*
   * How many are keeping up with the classification their service length
   * expects. The classic screen prints this over the plot as "72.4% On
   * Track"; here it was computed into every row as `isBehind` and then thrown
   * away, so the screen showed the shape of the squadron without the one
   * number a training officer is asked for.
   */
  const onTrack = rows.filter((row) => !row.isBehind).length;
  const onTrackPercent = rows.length ? Math.round((onTrack / rows.length) * 100) : null;
  const filtersActive = search !== "" || flightFilter !== ALL || nearlyOnly;

  const clearFilters = () => {
    setSearch("");
    setFlightFilter(ALL);
    setNearlyOnly(false);
  };

  const openRecord = (row, exam = "") => {
    setPending({ cadetName: row.name, passed: row.passed });
    setEntries([{ exam, date: "" }]);
    setDialogError(null);
  };

  const closeRecord = () => {
    setPending(null);
    setEntries([{ exam: "", date: "" }]);
    setDialogError(null);
  };

  /** Editing the last row grows another, so the list never runs out. */
  const changeEntry = (index, field, value) => {
    setEntries((current) => {
      const next = current.map((entry, at) =>
        at === index ? { ...entry, [field]: value } : entry
      );
      const last = next[next.length - 1];
      if (index === next.length - 1 && last.exam && last.date) {
        next.push({ exam: "", date: "" });
      }
      return next;
    });
  };

  const removeEntry = (index) =>
    setEntries((current) =>
      current.length === 1 ? [{ exam: "", date: "" }] : current.filter((_, at) => at !== index)
    );

  const filledCount = entries.filter((entry) => entry.exam && entry.date).length;

  const confirmRecord = async () => {
    /*
     * Half-filled rows are the error, not empty ones. The last row is always
     * blank by design, so "you have not filled everything in" would fire on
     * every correct use of this dialog.
     */
    const filled = entries.filter((entry) => entry.exam || entry.date);
    if (filled.some((entry) => !entry.exam || !entry.date)) {
      setDialogError("Give every exam a date, or clear the row.");
      return;
    }
    if (filled.length === 0) {
      setDialogError("Choose an exam and the date it was passed.");
      return;
    }

    /* One createdAt for the lot: they were entered in one action. */
    const createdAt = new Date();

    try {
      for (const entry of filled) {
        const { error } = await saveEvent({
          createdAt,
          addedBy: user?.displayName || "Unknown",
          cadetName: [pending.cadetName],
          date: entry.date,
          badgeCategory: "",
          badgeLevel: "",
          examName: entry.exam,
          eventName: "",
          eventCategory: "",
          specialAward: "",
        });
        if (error) {
          setDialogError(error);
          return;
        }
      }
      closeRecord();
    } catch (err) {
      console.error("Error recording exam:", err);
      setDialogError("That could not be saved. Try again.");
    }
  };

  const examColumns = BOARD_EXAMS.map((exam, index) => ({
    key: exam,
    header: shortExamName(exam),
    align: "center",
    width: "108px",
    sortValue: (row) => row.marks[index] || "",
    render: (row) =>
      row.marks[index] ? (
        <span className={styles.passed} title={`${exam} passed`}>
          {shortDate(row.marks[index])}
        </span>
      ) : (
        <button
          type="button"
          className={styles.add}
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
            openRecord(row, exam);
          }}
        >
          <span aria-hidden="true">+</span>
          <span className={styles["visually-hidden"]}>
            Record {exam} for {row.name}
          </span>
        </button>
      ),
  }));

  const columns = [
    {
      key: "cadet",
      header: "Cadet",
      width: "226px",
      sortValue: (row) => row.name,
      filterValue: (row) => row.name + " " + row.flightName,
      /*
       * The cadet's name is the button, which is how every Senior and Master
       * paper gets recorded: those have no column of their own, so without
       * this there is nowhere on the screen to enter one.
       */
      render: (row) => (
        <button
          type="button"
          className={styles.cadet}
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
            openRecord(row);
          }}
          /*
           * Explicit, because the button's content is the cadet's name and
           * their flight -- which says who, not what pressing it does.
           */
          aria-label={`Add exams for ${row.name}`}
          title={`Add exams for ${row.name}`}
        >
          <FlightMark flight={row.flight} />
          <span className={styles["cadet-text"]}>
            <span className={styles["cadet-name"]}>{row.name}</span>
            <span className={styles["cadet-flight"]}>{row.flightName}</span>
          </span>
        </button>
      ),
    },
    {
      key: "now",
      header: "Now",
      width: "132px",
      // Position on the ladder, not the label alphabetically.
      sortValue: (row) => RUNGS.indexOf(row.rung),
      filterValue: (row) => row.label,
      render: (row) => <span className={TONE[row.rung] || TONE.Junior}>{row.label}</span>,
    },
    ...examColumns,
    {
      key: "senior",
      header: "Senior and Master",
      width: "172px",
      sortValue: (row) => row.seniorCount,
      render: (row) => (
        <span className={styles.senior}>
          <MusterBar value={Math.min(row.seniorCount, SENIOR_TARGET)} max={SENIOR_TARGET} width="72px" />
          <span className={styles["senior-count"]}>
            {row.seniorCount} of {SENIOR_TARGET}
          </span>
        </span>
      ),
    },
  ];

  return (
    <MusterPage
      title="Classification Tracker"
      description="Classification is counted from exams passed, so this is the exam board rather than a field to edit. Click an empty cell to record a pass."
    >
      <div className={styles.layout}>
        <div className={styles.side}>
        <section className={styles.plot} aria-label="Classification against service length">
          <h2 className={styles["plot-title"]}>Classification Against Service Length</h2>
          <div className={styles["plot-frame"]}>
            <Graph
              cadetData={derived}
              longestServiceInMonths={longestService}
              /*
               * Both handlers do what they do on the classic screen: hovering
               * a point highlights that cadet's row, clicking one opens the
               * dialog to add exams for them.
               */
              onPointHover={(names) => setHovered(names?.length ? names[0] : null)}
              hoveredCadet={hovered ? [hovered] : []}
              onPointClick={(cadetName) => {
                const row = rows.find((entry) => entry.name === cadetName);
                if (row) openRecord(row);
              }}
              palette="muster"
            />
          </div>
        </section>

        <section className={styles.distribution} aria-label="Where the Squadron Sits">
          <div className={styles["distribution-head"]}>
            <h2 className={styles["distribution-title"]}>Where the Squadron Sits</h2>
            {onTrackPercent !== null && (
              <p className={styles["on-track"]}>
                <strong className={styles["on-track-figure"]}>{onTrackPercent}%</strong>
                on track for their service length
                {rows.length - onTrack > 0 ? ` \u00b7 ${rows.length - onTrack} behind` : ""}
              </p>
            )}
            <p className={styles["distribution-note"]}>
              {rows.length} cadets.{" "}
              {nearlyCount > 0
                ? `${nearlyCount} ${nearlyCount === 1 ? "is" : "are"} one exam from the next classification.`
                : "Nobody is one exam away right now."}
            </p>
          </div>
          <div className={styles.bands}>
            {distribution.map((band) => (
              <div
                key={band.rung}
                className={band.tone}
                style={{ width: band.width }}
                title={`${band.rung}: ${band.count}`}
              >
                {band.count > 0 && <span className={styles["band-count"]}>{band.count}</span>}
              </div>
            ))}
          </div>
          <ul className={styles.legend}>
            {distribution.map((band) => (
              <li key={band.rung} className={styles["legend-item"]}>
                <span className={band.tone} aria-hidden="true" />
                {band.rung}
                <span className={styles["legend-count"]}>{band.count}</span>
              </li>
            ))}
          </ul>
        </section>
        </div>

        <div className={styles.board}>
      <MusterTable
        columns={columns}
        rows={visible}
        getRowKey={(row) => row.id}
        /* The row the pointer is over on the plot, so the two read together. */
        selectedKey={hovered ? rows.find((row) => row.name === hovered)?.id ?? null : null}
        defaultSort={{ key: "now", direction: "desc" }}
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
            <MusterChip active={nearlyOnly} onClick={() => setNearlyOnly((on) => !on)}>
              One Exam From Next Classification
            </MusterChip>
            <span className={styles.spacer} />
            <span className={styles.count}>
              {visible.length === rows.length
                ? `${rows.length} cadets`
                : `${visible.length} of ${rows.length} cadets`}
            </span>
          </>
        }
        empty={
          <MusterEmpty
            title={nearlyOnly ? "Nobody Is One Exam Away" : "No Cadets Match"}
            action={filtersActive ? <MusterButton onClick={clearFilters}>Show All Cadets</MusterButton> : null}
          >
            {nearlyOnly
              ? "Everyone is either further off than a single paper, or has finished the rung they were on."
              : "Try another flight, or clear the filters."}
          </MusterEmpty>
        }
      />
        </div>
      </div>

      <MusterDialog
        open={Boolean(pending)}
        title={pending ? `Add Exams \u2014 ${pending.cadetName}` : "Add Exams"}
        description="Every exam, including the Senior and Master papers the board has no column for."
        onClose={closeRecord}
        onConfirm={confirmRecord}
        confirmLabel={filledCount > 1 ? "Record Passes" : "Record Pass"}
        error={dialogError}
      >
        <div className={styles["entry-list"]}>
          {entries.map((entry, index) => (
            <div key={index} className={styles.entry}>
              <MusterField label={index === 0 ? "Exam" : `Exam ${index + 1}`}>
                {(id) => (
                  <select
                    id={id}
                    value={entry.exam}
                    onChange={(selectEvent) => changeEntry(index, "exam", selectEvent.target.value)}
                  >
                    <option value="">Choose an exam</option>
                    {examList
                      .filter((exam) => !pending?.passed?.has(exam) || exam === entry.exam)
                      .map((exam) => (
                        <option key={exam} value={exam}>
                          {exam}
                        </option>
                      ))}
                  </select>
                )}
              </MusterField>

              <MusterField label="Date passed">
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    value={entry.date}
                    onChange={(inputEvent) => changeEntry(index, "date", inputEvent.target.value)}
                  />
                )}
              </MusterField>

              <button
                type="button"
                className={styles["entry-remove"]}
                onClick={() => removeEntry(index)}
                disabled={!entry.exam && !entry.date}
                title="Clear this row"
              >
                <span aria-hidden="true">&times;</span>
                <span className={styles["visually-hidden"]}>Clear row {index + 1}</span>
              </button>
            </div>
          ))}
        </div>

        <p className={styles["entry-hint"]}>
          The date on the certificate, not today. Fill the last row and another appears.
        </p>

        {pending?.passed?.size > 0 && (
          <div className={styles.held}>
            <h3 className={styles["held-title"]}>Already recorded</h3>
            <ul className={styles["held-list"]}>
              {[...pending.passed.entries()]
                .sort((a, b) => examList.indexOf(a[0]) - examList.indexOf(b[0]))
                .map(([exam, date]) => (
                  <li key={exam} className={styles["held-item"]}>
                    <span>{exam}</span>
                    <span className={styles["held-date"]}>{shortDate(date)}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </MusterDialog>
    </MusterPage>
  );
};

export default MusterClassification;
