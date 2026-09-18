import { useContext, useMemo, useState } from "react";
import { DataContext } from "../../../context/DataContext";
import { useSquadron } from "../../../context/SquadronContext";
import { badgeLevel } from "../../../utils/examList";
import { getAssignableFlights } from "../../../utils/flights";
import MusterPage from "../../Muster/MusterPage";
import MusterTable from "../../Muster/MusterTable";
import {
  FlightMark,
  MusterButton,
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
 * Blue, bronze, silver and gold keep their own colours in both themes. The
 * colour IS the level here, the same way a flight colour is the flight, and
 * recolouring a gold badge to suit a background would destroy the thing it is
 * communicating.
 *
 * The strip along the top counts awards by level, and names any syllabus area
 * nobody holds anything in. That second one is the useful part: an empty
 * column is a subject the squadron has never run, and it is invisible on a
 * screen that only shows what people have.
 */

const ALL = "all";

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

const MusterPTSTracker = () => {
  const { data } = useContext(DataContext);
  const { flightMap, flights } = useSquadron();

  const [search, setSearch] = useState("");
  const [flightFilter, setFlightFilter] = useState(ALL);

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

  const rows = useMemo(() => {
    const events = data.events || [];

    return (data.cadets || []).map((cadet) => {
      const name = `${cadet.forename} ${cadet.surname}`;
      const own = events.filter(
        (event) => event.cadetName === name && event.badgeLevel && event.badgeCategory
      );

      const highest = {};
      own.forEach((event) => {
        const current = highest[event.badgeCategory];
        if (!current || rankOf(event.badgeLevel) > rankOf(current)) {
          highest[event.badgeCategory] = event.badgeLevel;
        }
      });

      return {
        id: cadet.id,
        name,
        flight: cadet.flight,
        flightName: flightMap[cadet.flight] || "Unassigned",
        highest,
        held: Object.keys(highest).length,
      };
    });
  }, [data.cadets, data.events, flightMap]);

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

  /** Awards by level across the whole squadron, and the subjects nobody holds. */
  const summary = useMemo(() => {
    const events = (data.events || []).filter(
      (event) => event.badgeLevel && event.badgeCategory
    );
    const counts = badgeLevel.map((level) => ({
      level,
      count: events.filter((event) => event.badgeLevel === level).length,
    }));
    const untouched = categories.filter(
      (category) => !events.some((event) => event.badgeCategory === category)
    );
    return { counts, untouched };
  }, [data.events, categories]);

  const filtersActive = search !== "" || flightFilter !== ALL;

  const clearFilters = () => {
    setSearch("");
    setFlightFilter(ALL);
  };

  const columns = [
    {
      key: "cadet",
      header: "Cadet",
      width: "230px",
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
    ...categories.map((category) => ({
      key: category,
      header: category,
      align: "center",
      render: (row) => {
        const level = row.highest[category];
        if (!level) {
          return (
            <span className={styles.none}>
              <span className={styles["visually-hidden"]}>No badge</span>
              <span aria-hidden="true">—</span>
            </span>
          );
        }
        return <span className={LEVEL_CLASS[level] || styles["level-blue"]}>{level}</span>;
      },
    })),
    {
      key: "held",
      header: "Held",
      align: "right",
      width: "84px",
      render: (row) => <strong>{row.held}</strong>,
    },
  ];

  return (
    <MusterPage
      title="PTS tracker"
      description="The highest badge held in each syllabus area. A dash means nothing recorded yet."
    >
      <section className={styles.levels} aria-label="Badges awarded">
        {summary.counts.map((entry) => (
          <div key={entry.level} className={styles["level-tile"]}>
            <div className={styles["level-head"]}>
              <span className={LEVEL_DOT[entry.level]} aria-hidden="true" />
              <span className={styles["level-name"]}>{entry.level}</span>
            </div>
            <div className={styles["level-count"]}>{entry.count}</div>
          </div>
        ))}

        <div className={styles["gap-tile"]}>
          <div className={styles["gap-title"]}>
            {summary.untouched.length === 0 ? "Every area covered" : "Nobody holds a badge in"}
          </div>
          {summary.untouched.length === 0 ? (
            <p className={styles["gap-body"]}>
              At least one cadet holds a badge in every syllabus area the squadron runs.
            </p>
          ) : (
            <>
              <ul className={styles["gap-list"]}>
                {summary.untouched.map((category) => (
                  <li key={category} className={styles["gap-item"]}>
                    {category}
                  </li>
                ))}
              </ul>
              <p className={styles["gap-body"]}>
                {summary.untouched.length === 1 ? "A subject" : "Subjects"} the squadron has never
                run, or never recorded.
              </p>
            </>
          )}
        </div>
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
            <span className={styles.spacer} />
            <ul className={styles.legend}>
              {badgeLevel.map((level) => (
                <li key={level} className={styles["legend-item"]}>
                  <span className={LEVEL_DOT[level]} aria-hidden="true" />
                  {level}
                </li>
              ))}
            </ul>
          </>
        }
        empty={
          <MusterEmpty
            title="No cadets match"
            action={filtersActive ? <MusterButton onClick={clearFilters}>Show all cadets</MusterButton> : null}
          >
            Try another flight, or clear the filters.
          </MusterEmpty>
        }
      />
    </MusterPage>
  );
};

export default MusterPTSTracker;
