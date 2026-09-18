import { useMemo } from "react";
import { getEventDescription } from "../../../utils/points";
import { MusterButton } from "../../Muster/MusterControls";
import { flightColour } from "../../../utils/flights";
import styles from "./CadetPanel.module.css";

/**
 * One cadet, beside the list rather than on top of it.
 *
 * A docked panel instead of a modal, which is the whole argument for this
 * screen. Checking on a cadet is almost never a single lookup -- it is "how is
 * Bravo doing", which means opening four cadets in a row. A modal makes that
 * four open-read-close cycles over a list you cannot see; a panel leaves the
 * list on screen so the next name is one click away.
 *
 * Read-only. Editing still goes through the same popup the classic screen
 * uses, reached from the button at the foot, because a second editing surface
 * is a second place for the validation to be wrong.
 */

/** Badge levels carry meaning, so their colours are fixed rather than themed. */
const BADGE_COLOUR = {
  Blue: "var(--badge-blue)",
  Bronze: "var(--badge-bronze)",
  Silver: "var(--badge-silver)",
  Gold: "var(--badge-gold)",
};

const initialsOf = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** "3 yr 1 mo", or "4 mo" under a year. Rounded, because a list is not a record. */
const serviceLabel = (months) => {
  if (!months || months < 1) return "under a month";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} mo`;
  return rest === 0 ? `${years} yr` : `${years} yr ${rest} mo`;
};

const CadetPanel = ({ row, events, onClose, onEdit }) => {
  const own = useMemo(
    () => events.filter((event) => event.cadetName === row.name),
    [events, row.name]
  );

  const badges = useMemo(
    () =>
      own
        .filter((event) => event.badgeLevel && event.badgeCategory)
        .map((event) => ({
          id: event.id,
          level: event.badgeLevel,
          category: event.badgeCategory,
          colour: BADGE_COLOUR[event.badgeLevel] || "var(--color-border-strong)",
        })),
    [own]
  );

  const exams = useMemo(
    () => own.filter((event) => event.examName !== "").map((event) => event.examName),
    [own]
  );

  /*
   * Newest five. The full record lives in the event log, and a panel that
   * scrolls to fifty entries has stopped being a summary.
   */
  const recent = useMemo(
    () =>
      [...own]
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 5)
        .map((event) => ({
          id: event.id,
          description: getEventDescription(event),
          date: event.date,
        }))
        .filter((entry) => entry.description !== ""),
    [own]
  );

  return (
    <aside className={styles.panel} aria-label={`${row.name} details`}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <div
            className={styles.avatar}
            style={{ backgroundColor: flightColour(row.flight) }}
            aria-hidden="true"
          >
            {initialsOf(row.name)}
          </div>
          <div className={styles.names}>
            <h2 className={styles.name}>{row.name}</h2>
            <p className={styles.meta}>
              {row.rank} &middot; {row.flightName}
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close cadet details">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Points</dt>
            <dd>{row.points}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Records</dt>
            <dd>{row.records}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Service</dt>
            <dd className={styles["stat-small"]}>{serviceLabel(row.serviceMonths)}</dd>
          </div>
        </dl>

        <section className={styles.section}>
          <h3 className={styles["section-title"]}>Classification</h3>
          <div className={styles.card}>
            <div className={styles["card-head"]}>
              <strong>{row.classification}</strong>
              <span className={styles["card-note"]}>
                {exams.length} {exams.length === 1 ? "exam" : "exams"} passed
              </span>
            </div>
            <p className={styles["card-body"]}>
              {row.isBehind
                ? `Expected to be ${row.targetLabel} by now, on service length.`
                : `Keeping pace with the ${row.targetLabel} target.`}
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles["section-title"]}>Badges held</h3>
          {badges.length === 0 ? (
            <p className={styles.nothing}>None recorded yet.</p>
          ) : (
            <ul className={styles["badge-list"]}>
              {badges.map((badge) => (
                <li key={badge.id} className={styles["badge-item"]}>
                  <span className={styles.dot} style={{ backgroundColor: badge.colour }} aria-hidden="true" />
                  {badge.level} {badge.category}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.section}>
          <h3 className={styles["section-title"]}>Recent records</h3>
          {recent.length === 0 ? (
            <p className={styles.nothing}>Nothing logged yet.</p>
          ) : (
            <ul className={styles.recent}>
              {recent.map((entry) => (
                <li key={entry.id} className={styles["recent-row"]}>
                  <span className={styles["recent-name"]}>{entry.description}</span>
                  <span className={styles["recent-date"]}>{entry.date}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className={styles.footer}>
        <MusterButton onClick={onEdit}>Edit details</MusterButton>
      </footer>
    </aside>
  );
};

export default CadetPanel;
