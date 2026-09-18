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
 * records a badge. Both go through useSaveEvent, so an exam added here is
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
  const [pendingDate, setPendingDate] = useState("");
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
  const filtersActive = search !== "" || flightFilter !== ALL || nearlyOnly;

  const clearFilters = () => {
    setSearch("");
    setFlightFilter(ALL);
    setNearlyOnly(false);
  };

  const openRecord = (row, exam) => {
    setPending({ cadetName: row.name, exam });
    setPendingDate("");
    setDialogError(null);
  };

  const closeRecord = () => {
    setPending(null);
    setDialogError(null);
  };

  const confirmRecord = async () => {
    if (!pendingDate) {
      setDialogError("Pick the date the exam was passed.");
      return;
    }

    try {
      const { error } = await saveEvent({
        createdAt: new Date(),
        addedBy: user?.displayName || "Unknown",
        cadetName: [pending.cadetName],
        date: pendingDate,
        badgeCategory: "",
        badgeLevel: "",
        examName: pending.exam,
        eventName: "",
        eventCategory: "",
        specialAward: "",
      });
      if (error) {
        setDialogError(error);
        return;
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
      render: (row) => (
        <span className={styles.cadet}>
          <FlightMark flight={row.flight} />
          <span className={styles["cadet-text"]}>
            <span className={styles["cadet-name"]}>{row.name}</span>
            <span className={styles["cadet-flight"]}>{row.flightName}</span>
          </span>
        </span>
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
              onPointHover={() => {}}
              hoveredCadet={[]}
              onPointClick={() => {}}
              palette="muster"
            />
          </div>
        </section>

        <section className={styles.distribution} aria-label="Where the Squadron Sits">
          <div className={styles["distribution-head"]}>
            <h2 className={styles["distribution-title"]}>Where the Squadron Sits</h2>
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
        title="Record an Exam Pass"
        description={pending ? `${pending.exam} for ${pending.cadetName}.` : ""}
        onClose={closeRecord}
        onConfirm={confirmRecord}
        confirmLabel="Record Pass"
        error={dialogError}
      >
        <MusterField label="Date passed" hint="The date on the certificate, not today.">
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

export default MusterClassification;
