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
        <p className={styles.answer}>
          Awards at each level, and the highest anyone has ever reached. A subject that stops at
          Bronze usually means nobody can take it further, not that cadets stopped trying.
        </p>
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

  const never = reach.filter((row) => row.records === 0);

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <h2 className={styles.question}>Who is getting the opportunities?</h2>
        <p className={styles.answer}>
          How many cadets have <em>ever</em> had a record in each category, least first.
          {never.length > 0
            ? ` ${never.length} ${never.length === 1 ? "category has" : "categories have"} never been used at all.`
            : " Every category has been used at least once."}
        </p>
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
      <p className={styles.answer}>
        Months from joining to passing, for the cadets who have. The ones who have not are listed
        beside it, longest-serving first.
      </p>
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
/**
 * A negative lag is not a rounding error, so it does not get rendered as one.
 *
 * The lag is entry date minus event date, and it goes negative when something
 * is written up before it happens -- a camp entered when the place is booked,
 * a parade night logged in advance. "Typically -23 days" reads as a bug; the
 * squadron reading it needs to be told which way round the gap runs.
 */
const lagSentence = (median) => {
  if (median === null) {
    return "Nothing carries a creation time, so the lag cannot be worked out.";
  }
  if (median < 0) {
    return `Records are typically entered ${Math.abs(median)} ${
      median === -1 ? "day" : "days"
    } before the date they carry, so most are being logged ahead of the event.`;
  }
  if (median === 0) {
    return "Records are typically entered on the day the thing happened.";
  }
  return `Typically ${median} ${
    median === 1 ? "day" : "days"
  } between something happening and it being entered.`;
};

export const RecordingHealth = ({ health }) => (
  <section className={styles.section}>
    <header className={styles.head}>
      <h2 className={styles.question}>Is the log being kept up?</h2>
      <p className={styles.answer}>{lagSentence(health.median)}</p>
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
        <p className={styles.caption}>
          Not a data problem when it is concentrated &mdash; a succession one. If one person stops,
          the log stops.
        </p>
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
        <p className={styles.caption}>
          Days on which anything was entered at all.
          {health.busiestDay
            ? ` The busiest was ${health.busiestDay[0]}, with ${health.busiestDay[1]} records — usually a backfill rather than a parade night.`
            : ""}
        </p>
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
        <p className={styles.answer}>
          {former.count === 0
            ? "No former cadets are traceable in the log yet."
            : `${former.count} former cadets are still traceable from the ${former.records} records they left behind.`}
        </p>
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
          {/*
            * Stated plainly rather than footnoted. This is a floor, not a
            * measurement, and a number people quote needs its caveat attached
            * to it rather than at the bottom of the page.
            */}
          <p className={styles.caption}>
            Measured from their first record to their last, because there is no discharge date.
            It cannot see service before the first record or after the last, and it cannot see a
            cadet who left with nothing logged &mdash; so treat it as a floor.
          </p>
        </article>

        <article className={styles["card-wide"]}>
          <h3 className={styles["card-title"]}>When Cadets Join</h3>
          <p className={styles.caption}>
            Intake is usually seasonal, and a syllabus planned for a steady trickle does not fit a
            squadron that recruits in waves.
          </p>
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

/** Rank against exams passed, and who is qualified but not promoted. */
export const RankLadder = ({ ladder, flightMap }) => (
  <section className={styles.section}>
    <header className={styles.head}>
      <h2 className={styles.question}>Where is the next NCO coming from?</h2>
      <p className={styles.answer}>
        Promotion is a judgement, not an arithmetic result. This shows the shape, and names the
        cadets already at the level the rank above them typically holds.
      </p>
    </header>

    <div className={styles.grid}>
      <article className={styles["card-wide"]}>
        <h3 className={styles["card-title"]}>Exams Passed, by Rank</h3>
        <ul className={styles.rows}>
          {ladder.byRank.map((entry) => (
            <li key={entry.rank} className={styles.row}>
              <span className={styles["row-name"]}>{entry.rankName}</span>
              <span className={styles.track}>
                <span
                  className={styles["rung-5"]}
                  style={{
                    width: `${
                      (entry.median / Math.max(1, ...ladder.byRank.map((r) => r.median))) * 100
                    }%`,
                  }}
                />
              </span>
              <span className={styles["row-value"]}>{entry.median}</span>
            </li>
          ))}
        </ul>
        <p className={styles.caption}>
          Median exams passed at each rank. Counts: {ladder.byRank.map((r) => `${r.rankName} ${r.count}`).join(", ")}.
        </p>
      </article>

      <article className={styles["card-wide"]}>
        <h3 className={styles["card-title"]}>Qualified for the Next Rank</h3>
        {ladder.ready.length === 0 ? (
          <p className={styles.caption}>
            Nobody is currently at or above the typical level of the rank above them.
          </p>
        ) : (
          <ul className={styles.people}>
            {ladder.ready.slice(0, 8).map((cadet) => (
              <li key={cadet.id} className={styles.person}>
                <span
                  className={styles.mark}
                  style={{ backgroundColor: flightColour(cadet.flight) }}
                  aria-hidden="true"
                />
                <span className={styles["person-text"]}>
                  <span className={styles["person-name"]}>{cadet.name}</span>
                  <span className={styles["person-note"]}>
                    {cadet.rankName} &middot; {flightMap[cadet.flight] || "Unassigned"}
                  </span>
                </span>
                <span className={styles["person-value-muted"]}>{cadet.exams} exams</span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  </section>
);

/** Things in the data that are almost certainly mistakes. */
export const DataQuality = ({ issues }) => (
  <section className={styles.section}>
    <header className={styles.head}>
      <h2 className={styles.question}>Is anything wrong with the data?</h2>
      <p className={styles.answer}>
        {issues.length === 0
          ? "Nothing obviously wrong. Dates parse, names match, and every record scores something."
          : `${issues.length} ${issues.length === 1 ? "thing" : "things"} worth a look. None of these show up as an error anywhere else — they just quietly drop out of totals.`}
      </p>
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

/** Each flight's age, so a new flight is not read as a failing one. */
export const FlightAges = ({ ages }) => (
  <section className={styles.section}>
    <header className={styles.head}>
      <h2 className={styles.question}>How old is each flight?</h2>
      <p className={styles.answer}>
        A flight three months old will lose every comparison on this page, and that is not a fact
        about the flight.
      </p>
    </header>

    <div className={styles["table-card"]}>
      <table className={styles.matrix}>
        <caption className={styles["visually-hidden"]}>Flight size and age</caption>
        <thead>
          <tr>
            <th scope="col" className={styles["matrix-head"]}>Flight</th>
            <th scope="col" className={styles["matrix-head-num"]}>Cadets</th>
            <th scope="col" className={styles["matrix-head-num"]}>Age</th>
            <th scope="col" className={styles["matrix-head"]}>Longest-serving joined</th>
            <th scope="col" className={styles["matrix-head"]}>Competes</th>
          </tr>
        </thead>
        <tbody>
          {ages.map((flight) => (
            <tr key={flight.index}>
              <th scope="row" className={styles["matrix-row-head"]}>
                <span className={styles["flight-name"]}>
                  <span
                    className={styles.mark}
                    style={{ backgroundColor: flightColour(flight.index) }}
                    aria-hidden="true"
                  />
                  {flight.name}
                </span>
              </th>
              <td className={styles["matrix-cell"]}>{flight.size}</td>
              <td className={styles["matrix-cell"]}>
                {flight.months === null ? "—" : `${flight.months} mo`}
              </td>
              <td className={styles["matrix-cell-left"]}>
                <span className={styles.muted}>{flight.oldest || "no start dates"}</span>
              </td>
              <td className={styles["matrix-cell-left"]}>
                <span className={styles.muted}>{flight.competing ? "Yes" : "No"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);
