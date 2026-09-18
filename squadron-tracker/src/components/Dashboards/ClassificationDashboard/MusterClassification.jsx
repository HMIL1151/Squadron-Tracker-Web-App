import { useContext, useMemo, useState } from "react";
import { DataContext } from "../../../context/DataContext";
import { useSquadron } from "../../../context/SquadronContext";
import { deriveClassifications, examsPassedBy, nextExamFor } from "../../../utils/classification";
import { examList } from "../../../utils/examList";
import { getAssignableFlights } from "../../../utils/flights";
import MusterPage from "../../Muster/MusterPage";
import MusterTable from "../../Muster/MusterTable";
import {
  FlightMark,
  MusterBar,
  MusterButton,
  MusterChip,
  MusterEmpty,
  MusterSearch,
  MusterSelect,
} from "../../Muster/MusterControls";
import styles from "./MusterClassification.module.css";

/**
 * The classification tracker, Muster.
 *
 * The classic screen is a scatter plot of classification against service
 * length, plus a table of four columns. The plot answers "is the squadron
 * keeping up" well and "what does Ben need to do next" not at all -- which is
 * the question staff are actually holding when they open this screen on a
 * parade night.
 *
 * So this is an exam board. One row per cadet, one column per exam up to
 * Leading, and the eleven Senior/Master papers collapsed into a count, because
 * eleven ticks across a screen is a wall rather than a reading. The last
 * column is the next exam each cadet needs, which is the thing you write on
 * the training programme.
 *
 * The distribution strip above is what survives of the scatter plot: it still
 * answers the squadron-level question, in a shape that fits above a table.
 */

const ALL = "all";

/** The exams that sit before Senior, in the order they are taken. */
const EARLY_EXAMS = ["Second Class Cadet", "First Class Cadet"];
const LEADING_EXAMS = examList.filter((exam) => exam.startsWith("Leading:"));
const SENIOR_EXAMS = examList.filter((exam) => exam.startsWith("Senior/Master:"));

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
 * stripping the prefix and suffix still leaves 39. So the three Leading papers
 * get explicit short names; everything else falls back to trimming, which is
 * enough for the two early exams and for the Senior papers that only ever
 * appear in the "next exam due" cell where there is room.
 */
const SHORT_NAME = {
  "Leading: Principles of Flight Exam": "Flight",
  "Leading: Airmanship Knowledge Exam": "Airmanship",
  "Leading: Basic Navigation using a Map and Compass Exam": "Navigation",
};

const shortExamName = (exam) =>
  SHORT_NAME[exam] ||
  exam.replace(/^Leading:\s*/, "").replace(/\s*Exam$/, "").replace(/\s*Cadet$/, "");

const MusterClassification = () => {
  const { data } = useContext(DataContext);
  const { flightMap, flights } = useSquadron();

  const [search, setSearch] = useState("");
  const [flightFilter, setFlightFilter] = useState(ALL);
  const [nearlyOnly, setNearlyOnly] = useState(false);

  const rows = useMemo(() => {
    const events = data.events || [];
    return deriveClassifications(data.cadets || [], events).map((entry) => {
      const passed = new Set(examsPassedBy(entry.cadetName, events).map((e) => e.examName));
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
        marks: [...EARLY_EXAMS, ...LEADING_EXAMS].map((exam) => passed.has(exam)),
        seniorCount,
        next: nextExamFor(entry.cadetName, events, examList),
        /*
         * "One exam from promotion" means the next exam completes the rung
         * they are working on. Only meaningful up to Leading, where a rung is
         * a fixed set; Senior and Master are eleven papers taken in any order.
         */
        nearlyThere:
          entry.classification < 6 &&
          [...EARLY_EXAMS, ...LEADING_EXAMS].filter((exam) => !passed.has(exam)).length === 1,
      };
    });
  }, [data.cadets, data.events, flightMap]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (flightFilter !== ALL && String(row.flight) !== flightFilter) return false;
        if (nearlyOnly && !row.nearlyThere) return false;
        if (!needle) return true;
        return row.name.toLowerCase().includes(needle);
      })
      /*
       * Furthest on first. The classic table sorts by name, which scatters the
       * cadets who are close to something across the page.
       */
      .sort((a, b) => RUNGS.indexOf(b.rung) - RUNGS.indexOf(a.rung) || a.name.localeCompare(b.name));
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

  const nearlyCount = rows.filter((row) => row.nearlyThere).length;
  const filtersActive = search !== "" || flightFilter !== ALL || nearlyOnly;

  const clearFilters = () => {
    setSearch("");
    setFlightFilter(ALL);
    setNearlyOnly(false);
  };

  const examColumns = [...EARLY_EXAMS, ...LEADING_EXAMS].map((exam, index) => ({
    key: exam,
    header: shortExamName(exam),
    align: "center",
    width: "78px",
    render: (row) =>
      row.marks[index] ? (
        <span className={styles.passed} title={`${exam} passed`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.6 6.2 4.8 8.4 9.4 3.8" />
          </svg>
          <span className={styles["visually-hidden"]}>Passed</span>
        </span>
      ) : (
        <span className={styles.pending}>
          <span className={styles["visually-hidden"]}>Not yet</span>
        </span>
      ),
  }));

  const columns = [
    {
      key: "cadet",
      header: "Cadet",
      width: "226px",
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
      render: (row) => <span className={TONE[row.rung] || TONE.Junior}>{row.label}</span>,
    },
    ...examColumns,
    {
      key: "senior",
      header: "Senior and Master",
      width: "172px",
      render: (row) => (
        <span className={styles.senior}>
          <MusterBar value={row.seniorCount} max={SENIOR_EXAMS.length} width="72px" />
          <span className={styles["senior-count"]}>
            {row.seniorCount} of {SENIOR_EXAMS.length}
          </span>
        </span>
      ),
    },
    {
      key: "next",
      header: "Next exam due",
      render: (row) =>
        row.next ? (
          <span className={styles.next}>
            {shortExamName(row.next)}
            {row.nearlyThere && <span className={styles.nearly}>one to go</span>}
          </span>
        ) : (
          <span className={styles.done}>Syllabus complete</span>
        ),
    },
  ];

  return (
    <MusterPage
      title="Classification tracker"
      description="Classification is counted from exams passed, so this is the exam board rather than a field to edit."
    >
      <section className={styles.distribution} aria-label="Where the squadron sits">
        <div className={styles["distribution-head"]}>
          <h2 className={styles["distribution-title"]}>Where the squadron sits</h2>
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

      <MusterTable
        columns={columns}
        rows={visible}
        getRowKey={(row) => row.id}
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
              One exam from promotion
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
            title={nearlyOnly ? "Nobody is one exam away" : "No cadets match"}
            action={filtersActive ? <MusterButton onClick={clearFilters}>Show all cadets</MusterButton> : null}
          >
            {nearlyOnly
              ? "Everyone is either further off than a single paper, or has finished the rung they were on."
              : "Try another flight, or clear the filters."}
          </MusterEmpty>
        }
      />
    </MusterPage>
  );
};

export default MusterClassification;
