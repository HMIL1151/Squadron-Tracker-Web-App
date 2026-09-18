import { flightColour } from "../../../utils/flights";
import { BADGE_ORDER, percent } from "../../../utils/squadronStats";
import MusterTable from "../../Muster/MusterTable";
import { MusterBar } from "../../Muster/MusterControls";
import styles from "./MusterStatistics.module.css";

/**
 * The individual panels the statistics screen is built from.
 *
 * Split out because the screen now has five tabs of them and a single file was
 * becoming impossible to find anything in. Each of these takes already-derived
 * data -- the arithmetic lives in utils/squadronStats.js -- and does nothing
 * but lay it out.
 */

/* Explicit maps: scoped class names do not survive string concatenation. */
const SEVERITY = {
  high: styles["issue-high"],
  medium: styles["issue-medium"],
  low: styles["issue-low"],
};

const LEVEL_DOT = {
  Blue: styles["dot-blue"],
  Bronze: styles["dot-bronze"],
  Silver: styles["dot-silver"],
  Gold: styles["dot-gold"],
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * How far up each badge ladder the squadron gets.
 *
 * The ceiling column is the point: a subject with sixty Blues and no Silvers
 * has a ceiling of Bronze, and that is almost always a staffing fact rather
 * than a cadet one -- nobody on the squadron can take it further.
 */
export const BadgeLadder = ({ ladder }) => {
  const busiest = Math.max(1, ...ladder.map((row) => row.total));

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <h2 className={styles.question}>How far up each badge ladder do cadets get?</h2>
      </header>

      {ladder.length === 0 ? (
        <p className={styles.caption}>No badges recorded yet.</p>
      ) : (
        <div className={styles["table-card"]}>
          <table className={styles.matrix}>
            <caption className={styles["visually-hidden"]}>Badge awards by subject and level</caption>
            <thead>
              <tr>
                <th scope="col" className={styles["matrix-head"]}>Subject</th>
                {BADGE_ORDER.map((level) => (
                  <th key={level} scope="col" className={styles["matrix-head-num"]}>{level}</th>
                ))}
                <th scope="col" className={styles["matrix-head-num"]}>Cadets</th>
                <th scope="col" className={styles["matrix-head"]}>Ceiling</th>
                <th scope="col" className={styles["matrix-head"]}>Awards</th>
              </tr>
            </thead>
            <tbody>
              {ladder.map((row) => (
                <tr key={row.subject}>
                  <th scope="row" className={styles["matrix-row-head"]}>{row.subject}</th>
                  {row.counts.map((count, index) => (
                    <td
                      key={BADGE_ORDER[index]}
                      className={count === 0 ? styles["matrix-cell-zero"] : styles["matrix-cell"]}
                    >
                      {count}
                    </td>
                  ))}
                  <td className={styles["matrix-cell"]}>{row.holders}</td>
                  <td className={styles["matrix-cell-left"]}>
                    <span className={styles.ceiling}>
                      <span className={LEVEL_DOT[row.ceiling] || styles["dot-none"]} aria-hidden="true" />
                      {row.ceiling || "—"}
                    </span>
                  </td>
                  <td className={styles["matrix-bar"]}>
                    <MusterBar value={row.total} max={busiest} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

/**
 * How many cadets have ever done each thing.
 *
 * Reach rather than volume: twenty-eight flying records can be four cadets
 * going seven times. Sorted with the least-reached first, because the useful
 * end of this list is the top.
 */
export const CategoryReach = ({ reach, cadetCount }) => {
  const columns = [
    {
      key: "category",
      header: "Category",
      sortValue: (row) => row.category,
      filterValue: (row) => row.category,
      render: (row) => (
        <span className={styles["reach-name"]}>
          {row.category}
          {!row.configured && <span className={styles.retired}>not in the list</span>}
        </span>
      ),
    },
    {
      key: "share",
      header: "Reach",
      width: "170px",
      sortValue: (row) => row.share,
      render: (row) => <MusterBar value={row.share} max={1} width="150px" />,
    },
    {
      key: "cadets",
      header: "Cadets",
      align: "right",
      width: "120px",
      sortValue: (row) => row.cadets,
      render: (row) => (
        <span className={row.cadets === 0 ? styles.zero : undefined}>
          {row.cadets} of {cadetCount}
        </span>
      ),
    },
    {
      key: "records",
      header: "Records",
      align: "right",
      width: "100px",
      sortValue: (row) => row.records,
      render: (row) => row.records,
    },
    {
      key: "last",
      header: "Last Used",
      width: "130px",
      sortValue: (row) => row.last || "",
      render: (row) => <span className={styles.muted}>{row.last || "never"}</span>,
    },
  ];

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <h2 className={styles.question}>Who is getting the opportunities?</h2>
      </header>

      <MusterTable
        columns={columns}
        rows={reach}
        getRowKey={(row) => row.category}
        defaultSort={{ key: "cadets", direction: "asc" }}
      />
    </section>
  );
};

/** How long cadets here take to reach each classification. */
export const TimeToClassification = ({ timings, flightMap }) => (
  <section className={styles.section}>
    <header className={styles.head}>
      <h2 className={styles.question}>How long does a classification take here?</h2>
    </header>

    <div className={styles.grid}>
      {timings.map((timing) => (
        <article key={timing.examName} className={styles["card-wide"]}>
          <h3 className={styles["card-title"]}>{timing.examName}</h3>

          {timing.passed === 0 ? (
            <p className={styles.caption}>Nobody on strength has passed this yet.</p>
          ) : (
            <>
              <p className={styles.figure}>
                {timing.median}
                <span className={styles["figure-unit"]}> months, typically</span>
              </p>
              <p className={styles.caption}>
                {timing.passed} {timing.passed === 1 ? "cadet" : "cadets"} passed it, the quickest in{" "}
                {timing.fastest} {timing.fastest === 1 ? "month" : "months"} and the slowest in{" "}
                {timing.slowest}.
              </p>
            </>
          )}

          {timing.outstanding.length > 0 && (
            <>
              <h4 className={styles["sub-title"]}>
                {timing.outstanding.length} still to pass it
              </h4>
              <ul className={styles.people}>
                {timing.outstanding.slice(0, 6).map((cadet) => (
                  <li key={cadet.id} className={styles.person}>
                    <span
                      className={styles.mark}
                      style={{ backgroundColor: flightColour(cadet.flight) }}
                      aria-hidden="true"
                    />
                    <span className={styles["person-text"]}>
                      <span className={styles["person-name"]}>{cadet.name}</span>
                      <span className={styles["person-note"]}>
                        {flightMap[cadet.flight] || "Unassigned"}
                      </span>
                    </span>
                    <span className={styles["person-value-muted"]}>
                      {cadet.months === null ? "no start date" : `${cadet.months} mo served`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </article>
      ))}
    </div>
  </section>
);

/**
 * Whether the log is being kept up.
 *
 * The lag between a thing happening and somebody typing it in is the best
 * predictor of whether a record exists at all, and no other screen can show it
 * because every other screen only shows what IS recorded.
 */
export const RecordingHealth = ({ health }) => (
  <section className={styles.section}>
    <header className={styles.head}>
      <h2 className={styles.question}>Is the log being kept up?</h2>
    </header>

    <div className={styles.grid}>
      <article className={styles.card}>
        <h3 className={styles["card-title"]}>Typical Lag</h3>
        <p className={styles.figure}>
          {health.median === null ? "—" : Math.abs(health.median)}
          <span className={styles["figure-unit"]}>
            {health.median !== null && health.median < 0 ? " days early" : " days"}
          </span>
        </p>
        <dl className={styles.pairs}>
          <div>
            <dt>Entered within a week</dt>
            <dd>{health.sameWeek}</dd>
          </div>
          {health.enteredEarly > 0 && (
            <div>
              <dt>Logged before the date</dt>
              <dd>{health.enteredEarly}</dd>
            </div>
          )}
          <div>
            <dt>Took over 90 days</dt>
            <dd>{health.overNinety}</dd>
          </div>
          <div>
            <dt>Took over a year</dt>
            <dd>{health.overAYear}</dd>
          </div>
        </dl>
      </article>

      <article className={styles["card-wide"]}>
        <h3 className={styles["card-title"]}>Who Enters Records</h3>
        <ul className={styles.rows}>
          {health.contributors.slice(0, 6).map((person) => (
            <li key={person.name} className={styles.row}>
              <span className={styles["row-name"]}>{person.name}</span>
              <span className={styles.track}>
                <span className={styles["rung-5"]} style={{ width: `${person.share * 100}%` }} />
              </span>
              <span className={styles["row-value"]}>{percent(person.share)}</span>
            </li>
          ))}
        </ul>
      </article>

      <article className={styles.card}>
        <h3 className={styles["card-title"]}>Entry Sessions</h3>
        <p className={styles.figure}>{health.entryDays}</p>
        {health.busiestDay && (
          <p className={styles.caption}>
            Busiest: {health.busiestDay[0]}, {health.busiestDay[1]} records
          </p>
        )}
      </article>
    </div>
  </section>
);

/** Cadets who have left, reconstructed from the records they left behind. */
export const Retention = ({ former, intakeData }) => {
  const busiestMonth = Math.max(1, ...intakeData.byMonth);
  const busiestYear = Math.max(1, ...intakeData.byYear.map((entry) => entry.count));

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <h2 className={styles.question}>Who joins, and who stays?</h2>
      </header>

      <div className={styles.grid}>
        <article className={styles.card}>
          <h3 className={styles["card-title"]}>Traceable Leavers</h3>
          <p className={styles.figure}>{former.count}</p>
          <dl className={styles.pairs}>
            <div>
              <dt>Typical span of activity</dt>
              <dd>{former.medianMonths === null ? "—" : `${former.medianMonths} mo`}</dd>
            </div>
            <div>
              <dt>Active under a year</dt>
              <dd>{former.underAYear}</dd>
            </div>
          </dl>
        </article>

        <article className={styles["card-wide"]}>
          <h3 className={styles["card-title"]}>When Cadets Join</h3>
          <div className={styles.months}>
            {intakeData.byMonth.map((count, index) => (
              <div key={MONTH_NAMES[index]} className={styles.month}>
                <div className={styles["month-track"]}>
                  <div
                    className={styles["month-bar"]}
                    style={{ height: `${(count / busiestMonth) * 100}%` }}
                    title={`${MONTH_NAMES[index]}: ${count}`}
                  />
                </div>
                <span className={styles["month-label"]}>{MONTH_NAMES[index]}</span>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.card}>
          <h3 className={styles["card-title"]}>Joined Each Year</h3>
          <ul className={styles.rows}>
            {intakeData.byYear.map((entry) => (
              <li key={entry.year} className={styles.row}>
                <span className={styles["row-name"]}>{entry.year}</span>
                <span className={styles.track}>
                  <span
                    className={styles["rung-4"]}
                    style={{ width: `${(entry.count / busiestYear) * 100}%` }}
                  />
                </span>
                <span className={styles["row-value"]}>{entry.count}</span>
              </li>
            ))}
          </ul>
          {intakeData.withoutStartDate > 0 && (
            <p className={styles.caption}>
              {intakeData.withoutStartDate} cadets have no usable start date and are missing from
              this.
            </p>
          )}
        </article>
      </div>
    </section>
  );
};

/**
 * The cadets who keep turning up, and who do the widest range of things.
 *
 * Two lists rather than one ranking, because they are two different kinds of
 * good and blending them into a score would hide which one a cadet has. The
 * table underneath carries everyone, sortable on any column.
 *
 * There is no "ready for promotion" column here on purpose; see the note on
 * standoutCadets in utils/squadronStats.js.
 */
export const Standouts = ({ standouts, flightMap, windowMonths = 24 }) => {
  const consistent = standouts.filter((row) => row.activeMonths > 0).slice(0, 6);
  const varied = [...standouts]
    .sort((a, b) => b.breadth - a.breadth || a.name.localeCompare(b.name))
    .filter((row) => row.breadth > 0)
    .slice(0, 6);

  const columns = [
    {
      key: "name",
      header: "Cadet",
      width: "230px",
      sortValue: (row) => row.name,
      filterValue: (row) => row.name,
      render: (row) => (
        <span className={styles["reach-name"]}>
          <span
            className={styles.mark}
            style={{ backgroundColor: flightColour(row.flight) }}
            aria-hidden="true"
          />
          {row.name}
        </span>
      ),
    },
    {
      key: "flight",
      header: "Flight",
      width: "120px",
      sortValue: (row) => flightMap[row.flight] || "",
      filterValue: (row) => flightMap[row.flight] || "Unassigned",
      render: (row) => <span className={styles.muted}>{flightMap[row.flight] || "Unassigned"}</span>,
    },
    {
      key: "activeMonths",
      header: "Active Months",
      align: "right",
      width: "140px",
      sortValue: (row) => row.activeMonths,
      render: (row) => (
        <span className={row.activeMonths === 0 ? styles.zero : undefined}>
          {row.activeMonths} / {windowMonths}
        </span>
      ),
    },
    {
      key: "categories",
      header: "Categories",
      align: "right",
      width: "90px",
      sortValue: (row) => row.categories,
      render: (row) => row.categories,
    },
    {
      key: "badges",
      header: "Badges",
      align: "right",
      width: "90px",
      sortValue: (row) => row.badges,
      render: (row) => row.badges,
    },
    {
      key: "exams",
      header: "Exams",
      align: "right",
      width: "90px",
      sortValue: (row) => row.exams,
      render: (row) => row.exams,
    },
    {
      key: "awards",
      header: "Awards",
      align: "right",
      width: "90px",
      sortValue: (row) => row.awards,
      render: (row) => row.awards,
    },
    {
      key: "last",
      header: "Last Record",
      width: "140px",
      sortValue: (row) => row.last || "",
      render: (row) => <span className={styles.muted}>{row.last || "—"}</span>,
    },
  ];

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <h2 className={styles.question}>Who has been consistently impressive?</h2>
      </header>

      <div className={styles.pair}>
        <article className={styles["card-wide"]}>
          <h3 className={styles["card-title"]}>
            Most Consistent &middot; months with a record, of the last {windowMonths}
          </h3>
          {consistent.length === 0 ? (
            <p className={styles.caption}>Nothing recorded in the last two years.</p>
          ) : (
            <ul className={styles.rows}>
              {consistent.map((row) => (
                <li key={row.id} className={styles.row}>
                  <span className={styles["row-name"]}>{row.name}</span>
                  <span className={styles.track}>
                    <span
                      className={styles["rung-5"]}
                      style={{ width: `${(row.activeMonths / windowMonths) * 100}%` }}
                    />
                  </span>
                  <span className={styles["row-value"]}>{row.activeMonths}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className={styles["card-wide"]}>
          <h3 className={styles["card-title"]}>
            Widest Range &middot; categories, badge subjects, exams and awards
          </h3>
          {varied.length === 0 ? (
            <p className={styles.caption}>Nothing recorded yet.</p>
          ) : (
            <ul className={styles.people}>
              {varied.map((row) => (
                <li key={row.id} className={styles.person}>
                  <span
                    className={styles.mark}
                    style={{ backgroundColor: flightColour(row.flight) }}
                    aria-hidden="true"
                  />
                  <span className={styles["person-text"]}>
                    <span className={styles["person-name"]}>{row.name}</span>
                    <span className={styles["person-note"]}>
                      {row.categories} categories &middot; {row.badges} badges &middot; {row.exams} exams
                      {row.awards > 0 ? ` · ${row.awards} awards` : ""}
                    </span>
                  </span>
                  <span className={styles["person-value-muted"]}>{row.breadth}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <MusterTable
        columns={columns}
        rows={standouts}
        getRowKey={(row) => row.id}
        defaultSort={{ key: "activeMonths", direction: "desc" }}
      />
    </section>
  );
};

/** Things in the data that are almost certainly mistakes. */
export const DataQuality = ({ issues }) => (
  <section className={styles.section}>
    <header className={styles.head}>
      <h2 className={styles.question}>Is anything wrong with the data?</h2>
    </header>

    {issues.length === 0 ? (
      <article className={styles.card}>
        <h3 className={styles["card-title"]}>All Clear</h3>
        <p className={styles.caption}>
          Every date parses, no cadet name has stray spaces, and every record has something to
          score.
        </p>
      </article>
    ) : (
      <div className={styles.issues}>
        {issues.map((issue) => (
          <article key={issue.key} className={SEVERITY[issue.severity] || SEVERITY.low}>
            <h3 className={styles["issue-title"]}>{issue.title}</h3>
            <p className={styles["issue-detail"]}>{issue.detail}</p>
            {issue.examples?.length > 0 && (
              <ul className={styles.names}>
                {issue.examples.map((example) => (
                  <li key={example} className={styles.name}>
                    {example}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    )}
  </section>
);
