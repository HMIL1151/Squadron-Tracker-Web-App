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

/** "18 Apr 2025", which fits a cell and is how people say a date. */
const shortDate = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const MusterPTSTracker = ({ user }) => {
  const { data } = useContext(DataContext);
  const { flightMap, flights } = useSquadron();
  const saveEvent = useSaveEvent();

  const [search, setSearch] = useState("");
  const [flightFilter, setFlightFilter] = useState(ALL);
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

  const rows = useMemo(() => {
    const events = data.events || [];

    return (data.cadets || []).map((cadet) => {
      const name = `${cadet.forename} ${cadet.surname}`;
      const own = events.filter(
        (event) => event.cadetName === name && event.badgeLevel && event.badgeCategory
      );

      /*
       * The highest level held in each area, and the date it was awarded.
       * A cadet with Blue, Bronze and Silver Radio holds Silver Radio; the
       * other two are history the event log already has.
       */
      const highest = {};
      own.forEach((event) => {
        const current = highest[event.badgeCategory];
        if (!current || rankOf(event.badgeLevel) > rankOf(current.level)) {
          highest[event.badgeCategory] = { level: event.badgeLevel, date: event.date };
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

  const openAward = (row, category) => {
    setPending({ cadetName: row.name, category });
    setPendingLevel(badgeLevel[0]);
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

  const columns = [
    {
      key: "cadet",
      header: "Cadet",
      width: "230px",
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
    ...categories.map((category) => ({
      key: category,
      header: category,
      align: "center",
      sortValue: (row) => row.highest[category]?.date || "",
      render: (row) => {
        const held = row.highest[category];
        if (!held) {
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
    })),
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
      <section className={styles.levels} aria-label="Badges Awarded">
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
            {summary.untouched.length === 0 ? "Every Area Covered" : "Nobody Holds a Badge In"}
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
        defaultSort={{ key: "held", direction: "desc" }}
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
            title="No Cadets Match"
            action={filtersActive ? <MusterButton onClick={clearFilters}>Show All Cadets</MusterButton> : null}
          >
            Try another flight, or clear the filters.
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
        <MusterField label="Level">
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
