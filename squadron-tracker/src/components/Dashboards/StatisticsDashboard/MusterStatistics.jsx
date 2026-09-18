import { useContext, useMemo, useState } from "react";
import { DataContext } from "../../../context/DataContext";
import { useSquadron } from "../../../context/SquadronContext";
import { deriveClassifications, examsPassedBy } from "../../../utils/classification";
import { getEventPoints, getEventYear } from "../../../utils/points";
import { flightColour, getCompetingFlights } from "../../../utils/flights";
import { rankMap } from "../../../utils/mappings";
import { examList } from "../../../utils/examList";
import {
  badgeLadder,
  categoryReach,
  dataQuality,
  flightAges,
  formerCadets,
  intake,
  rankLadder,
  recordingHealth,
  timeToClassification,
} from "../../../utils/squadronStats";
import MusterPage from "../../Muster/MusterPage";
import { MusterBar, MusterChip, MusterSelect } from "../../Muster/MusterControls";
import {
  BadgeLadder,
  CategoryReach,
  DataQuality,
  FlightAges,
  RankLadder,
  RecordingHealth,
  Retention,
  TimeToClassification,
} from "./StatSections";
import styles from "./MusterStatistics.module.css";

/**
 * Squadron statistics.
 *
 * A screen the classic interface never had, built around questions a squadron
 * actually gets asked rather than a wall of tiles. Each section leads with the
 * answer in a sentence; the numbers underneath are the working.
 *
 * Most of the page is year-on-year. "284 records" means nothing on its own --
 * the useful version is "284, against 210 last year", and that is the shape
 * every figure here takes. It is also what a squadron is asked for when Wing
 * comes calling.
 *
 * There is too much of it for one scroll, so it is grouped into five tabs.
 * That is the opposite of the call made on Record Categories, and for the
 * opposite reason: those were four short lists read AGAINST each other, and
 * these are five separate enquiries. Nobody asks "how far up the badge
 * ladders do we get" and "is the log being kept up" in the same breath.
 *
 * Two things are deliberately NOT here, and it is worth writing down why,
 * because they are the first things anyone will ask for:
 *
 *   Attendance. The app has no attendance model -- it can only count
 *   parade-night RECORDS, which are written when someone remembers to write
 *   them. That made a squadron look like it had 10% attendance when what it
 *   actually had was a thin log. A measure that is wrong in a believable
 *   direction is worse than no measure, so it was taken out.
 *
 *   Age profile. There is no date of birth, and cadets age out at 20, so
 *   "how many leave in the next two years" cannot be answered here.
 *
 * Retention USED to be on that list, on the grounds that discharging deletes
 * the cadet. That was half right: it deletes the cadet and keeps their
 * RECORDS. In one real squadron's backup, 738 of 1,522 records belonged to
 * people no longer on strength -- just under half the log. So leavers are
 * counted from names in the log that are no longer on the books, and their
 * span of activity stands in for length of service. See squadronStats.js for
 * what that proxy can and cannot see.
 */

const RUNGS = ["Junior", "Second Class", "First Class", "Leading", "Senior", "Master"];

const rungOf = (label) => RUNGS.find((rung) => String(label).startsWith(rung)) || "Junior";

/*
 * Explicit map rather than `styles["rung-" + n]`: scoped class names do not
 * survive string concatenation.
 */
const RUNG_CLASS = [
  styles["rung-1"],
  styles["rung-2"],
  styles["rung-3"],
  styles["rung-4"],
  styles["rung-5"],
  styles["rung-6"],
];

const MONTHS = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];

/**
 * The five enquiries this screen answers.
 *
 * Ordered by how often they are asked rather than by how interesting they
 * are: what happened this year, then how people are getting on, then the
 * squadron-shape questions, then the housekeeping.
 */
const TABS = [
  { key: "year", label: "This Year" },
  { key: "progress", label: "Progression" },
  { key: "people", label: "People" },
  { key: "flights", label: "Flights" },
  { key: "keeping", label: "Record Keeping" },
];

/** Everything the squadron did in one training year. */
const metricsForYear = (year, cadets, events, flightPoints) => {
  const scoped = events.filter((event) => getEventYear(event) === year);
  const active = new Set(scoped.map((event) => event.cadetName).filter(Boolean));

  return {
    year,
    records: scoped.length,
    points: scoped.reduce((total, event) => total + getEventPoints(event, flightPoints), 0),
    exams: scoped.filter((event) => event.examName !== "").length,
    badges: scoped.filter((event) => event.badgeLevel && event.badgeCategory).length,
    awards: scoped.filter((event) => event.specialAward !== "").length,
    activeCadets: active.size,
    cadets: cadets.length,
  };
};

/**
 * How a figure compares with the year before.
 *
 * Returns null when there is no previous year, which is a different thing from
 * "no change" -- a squadron's first year should not be shown as flat.
 */
const deltaOf = (current, previous) => {
  if (previous === undefined || previous === null) return null;
  return current - previous;
};

const MusterStatistics = () => {
  const { data } = useContext(DataContext);
  const { flights, flightMap } = useSquadron();

  const cadets = data.cadets || [];
  const events = data.events || [];
  const flightPoints = data.flightPoints || {};

  const years = useMemo(() => {
    const seen = new Set();
    events.forEach((event) => {
      const year = getEventYear(event);
      if (year) seen.add(year);
    });
    return [...seen].sort((a, b) => b.localeCompare(a));
  }, [events]);

  const [year, setYear] = useState(() => years[0] || String(new Date().getFullYear()));
  const [tab, setTab] = useState("year");

  const scoped = useMemo(
    () => events.filter((event) => getEventYear(event) === year),
    [events, year]
  );

  /* -- 1. activity ------------------------------------------------------- */

  const activity = useMemo(() => {
    const dates = new Set(scoped.map((event) => event.date).filter(Boolean));
    const byMonth = new Array(12).fill(0);
    scoped.forEach((event) => {
      const month = Number(String(event.date).slice(5, 7));
      // The training year runs September to August, so month 9 is index 0.
      if (month >= 1 && month <= 12) byMonth[(month + 3) % 12] += 1;
    });
    return { dates: dates.size, byMonth };
  }, [scoped]);

  const busiestMonth = Math.max(1, ...activity.byMonth);

  /* -- 2. this year against the ones before ------------------------------ */

  /** Oldest first, so a table of them reads left to right like a timeline. */
  const timeline = useMemo(
    () =>
      [...years]
        .sort((a, b) => a.localeCompare(b))
        .map((value) => metricsForYear(value, cadets, events, flightPoints)),
    [years, cadets, events, flightPoints]
  );

  const current = timeline.find((entry) => entry.year === year) || timeline.at(-1);
  const currentIndex = timeline.indexOf(current);
  const previous = currentIndex > 0 ? timeline[currentIndex - 1] : null;

  const METRICS = [
    { key: "records", label: "Records logged" },
    { key: "points", label: "Points awarded" },
    { key: "exams", label: "Exams passed" },
    { key: "badges", label: "Badges awarded" },
    { key: "awards", label: "Special awards" },
    { key: "activeCadets", label: "Cadets with a record" },
  ];

  /* -- 3. flights, across the years -------------------------------------- */

  const flightTimeline = useMemo(() => {
    const byName = new Map(
      cadets.map((cadet) => [`${cadet.forename} ${cadet.surname}`, Number(cadet.flight)])
    );

    /*
     * Competing flights only. The Staff Team flight exists precisely so
     * that points earned by staff-flight cadets stay OUT of the
     * competition, so putting it in a comparison table would invite people
     * to read a number that was never meant to be read that way.
     */
    return getCompetingFlights(flights).map((flight) => {
      const members = cadets.filter((cadet) => Number(cadet.flight) === flight.index);
      const perYear = timeline.map((entry) => {
        const total = events
          .filter(
            (event) =>
              getEventYear(event) === entry.year && byName.get(event.cadetName) === flight.index
          )
          .reduce((sum, event) => sum + getEventPoints(event, flightPoints), 0);
        return { year: entry.year, total };
      });

      const now = perYear.find((entry) => entry.year === year)?.total || 0;
      const before = currentIndex > 0 ? perYear[currentIndex - 1]?.total : null;

      return {
        index: flight.index,
        name: flight.name,
        colour: flightColour(flight.index),
        size: members.length,
        perYear,
        now,
        perCadet: members.length ? Math.round(now / members.length) : 0,
        delta: deltaOf(now, before),
      };
    });
  }, [flights, cadets, events, flightPoints, timeline, year, currentIndex]);

  const bestFlightYear = Math.max(1, ...flightTimeline.flatMap((f) => f.perYear.map((y) => y.total)));

  /* -- 4. cadets who moved most ------------------------------------------ */

  const movers = useMemo(() => {
    if (!previous) return [];

    /*
     * Competing flights only, for the same reason the table above is. Points
     * earned in the staff flight are deliberately outside the competition, so
     * ranking a staff cadet as "most improved on points" measures them against
     * a thing they are not in.
     */
    const competing = new Set(getCompetingFlights(flights).map((flight) => flight.index));

    const pointsIn = (name, forYear) =>
      events
        .filter((event) => event.cadetName === name && getEventYear(event) === forYear)
        .reduce((sum, event) => sum + getEventPoints(event, flightPoints), 0);

    return cadets
      .filter((cadet) => competing.has(Number(cadet.flight)))
      .map((cadet) => {
        const name = `${cadet.forename} ${cadet.surname}`;
        const now = pointsIn(name, year);
        const before = pointsIn(name, previous.year);
        return {
          id: cadet.id,
          name,
          flight: cadet.flight,
          flightName: flightMap[cadet.flight] || "Unassigned",
          now,
          before,
          change: now - before,
        };
      })
      .filter((cadet) => cadet.change !== 0)
      .sort((a, b) => b.change - a.change);
  }, [cadets, events, flightPoints, year, previous, flightMap, flights]);

  /* -- 5. progression ----------------------------------------------------- */

  const progression = useMemo(() => {
    const derived = deriveClassifications(cadets, events);

    const funnel = RUNGS.map((rung, index) => ({
      rung,
      count: derived.filter((entry) => rungOf(entry.classificationLabel) === rung).length,
      tone: RUNG_CLASS[index],
    }));
    const widest = Math.max(1, ...funnel.map((band) => band.count));

    /*
     * Stalled means active but not progressing: at least one record this year,
     * and no exam passed in the last six months. Someone who has stopped
     * coming is a different problem, and lumping them together hides which is
     * which.
     */
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    const cutoffISO = cutoff.toISOString().slice(0, 10);

    const stalled = derived
      .filter((entry) => {
        const own = events.filter((event) => event.cadetName === entry.cadetName);
        if (!own.some((event) => getEventYear(event) === year)) return false;
        const lastExam = examsPassedBy(entry.cadetName, events)
          .map((event) => event.date)
          .sort()
          .at(-1);
        return !lastExam || lastExam < cutoffISO;
      })
      .map((entry) => ({
        id: entry.cadet.id,
        name: entry.cadetName,
        flight: entry.cadet.flight,
        label: entry.classificationLabel,
        target: entry.targetClassificationLabel,
        isBehind: entry.isBehind,
      }));

    return {
      funnel: funnel.map((band) => ({ ...band, width: `${(band.count / widest) * 100}%` })),
      behind: derived.filter((entry) => entry.isBehind).length,
      stalled,
    };
  }, [cadets, events, year]);

  /* -- 6. recognition ----------------------------------------------------- */

  const recognition = useMemo(() => {
    const totals = cadets
      .map((cadet) => {
        const name = `${cadet.forename} ${cadet.surname}`;
        const own = scoped.filter((event) => event.cadetName === name);
        return {
          id: cadet.id,
          name,
          points: own.reduce((sum, event) => sum + getEventPoints(event, flightPoints), 0),
          records: own.length,
        };
      })
      .sort((a, b) => b.points - a.points);

    const all = totals.reduce((sum, cadet) => sum + cadet.points, 0);
    const topFive = totals.slice(0, 5).reduce((sum, cadet) => sum + cadet.points, 0);

    const bands = [
      { label: "0", test: (p) => p === 0 },
      { label: "1–20", test: (p) => p > 0 && p <= 20 },
      { label: "21–40", test: (p) => p > 20 && p <= 40 },
      { label: "41–60", test: (p) => p > 40 && p <= 60 },
      { label: "61–100", test: (p) => p > 60 && p <= 100 },
      { label: "100+", test: (p) => p > 100 },
    ].map((band) => ({
      label: band.label,
      count: totals.filter((cadet) => band.test(cadet.points)).length,
      isZero: band.label === "0",
    }));
    const tallest = Math.max(1, ...bands.map((band) => band.count));

    return {
      share: all > 0 ? topFive / all : 0,
      bands: bands.map((band) => ({ ...band, height: `${(band.count / tallest) * 100}%` })),
      invisible: totals.filter((cadet) => cadet.records === 0),
    };
  }, [cadets, scoped, flightPoints]);

  /* -- 7. the wider picture, all from utils/squadronStats ---------------- */

  const configuredCategories = useMemo(
    () => Object.keys(flightPoints["Event Category Points"] || {}),
    [flightPoints]
  );

  const ladder = useMemo(() => badgeLadder(events), [events]);
  const reach = useMemo(
    () => categoryReach(cadets, events, configuredCategories),
    [cadets, events, configuredCategories]
  );
  const timings = useMemo(
    () =>
      timeToClassification(cadets, events, [
        "Second Class Cadet",
        "First Class Cadet",
      ]),
    [cadets, events]
  );
  const health = useMemo(() => recordingHealth(events), [events]);
  const former = useMemo(() => formerCadets(cadets, events), [cadets, events]);
  const intakeData = useMemo(() => intake(cadets), [cadets]);
  const ranks = useMemo(() => rankLadder(cadets, events, rankMap), [cadets, events]);
  const issues = useMemo(
    () => dataQuality(cadets, events, configuredCategories),
    [cadets, events, configuredCategories]
  );
  const ages = useMemo(() => flightAges(cadets, flights), [cadets, flights]);

  const signed = (value) => (value > 0 ? `+${value}` : String(value));

  const deltaClass = (value) => {
    if (value === null) return styles["delta-none"];
    if (value > 0) return styles["delta-up"];
    if (value < 0) return styles["delta-down"];
    return styles["delta-flat"];
  };

  return (
    <MusterPage
      title="Squadron Statistics"
      description="How the squadron is doing, and how that compares with the years before it."
      actions={
        <MusterSelect
          label="Year"
          value={year}
          onChange={setYear}
          options={years.map((value) => ({ value, label: value }))}
        />
      }
    >
      <nav className={styles.tabs} aria-label="Statistics sections">
        {TABS.map((entry) => (
          <MusterChip
            key={entry.key}
            active={tab === entry.key}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
          </MusterChip>
        ))}
      </nav>

      {tab === "year" && (
        <>
        {/* 1 */}
        <section className={styles.section}>
          <header className={styles.head}>
            <h2 className={styles.question}>How much is being recorded?</h2>
            <p className={styles.answer}>
              {current.records} records across {activity.dates}{" "}
              {activity.dates === 1 ? "date" : "dates"} in {year}, worth {current.points} points.
            </p>
          </header>
          <div className={styles.grid}>
            <article className={styles.card}>
              <h3 className={styles["card-title"]}>Records Logged</h3>
              <p className={styles.figure}>{current.records}</p>
              <dl className={styles.pairs}>
                <div>
                  <dt>Cadets on strength</dt>
                  <dd>{cadets.length}</dd>
                </div>
                <div>
                  <dt>Dates with a record</dt>
                  <dd>{activity.dates}</dd>
                </div>
                <div>
                  <dt>Points awarded</dt>
                  <dd>{current.points}</dd>
                </div>
              </dl>
            </article>

            <article className={styles["card-wide"]}>
              <h3 className={styles["card-title"]}>When They Were Logged</h3>
              <div className={styles.months}>
                {MONTHS.map((month, index) => (
                  <div key={month} className={styles.month}>
                    <div className={styles["month-track"]}>
                      <div
                        className={styles["month-bar"]}
                        style={{ height: `${(activity.byMonth[index] / busiestMonth) * 100}%` }}
                        title={`${month}: ${activity.byMonth[index]}`}
                      />
                    </div>
                    <span className={styles["month-label"]}>{month}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        {/* 2 */}
        <section className={styles.section}>
          <header className={styles.head}>
            <h2 className={styles.question}>How does this year compare?</h2>
            <p className={styles.answer}>
              {previous
                ? `${year} against ${previous.year}, and every year the squadron has records for.`
                : `${year} is the first year with records, so there is nothing to compare it with yet.`}
            </p>
          </header>

          <div className={styles["table-card"]}>
            <table className={styles.matrix}>
              <caption className={styles["visually-hidden"]}>
                Squadron metrics by training year
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={styles["matrix-head"]}>
                    Metric
                  </th>
                  {timeline.map((entry) => (
                    <th
                      key={entry.year}
                      scope="col"
                      className={entry.year === year ? styles["matrix-head-now"] : styles["matrix-head-num"]}
                    >
                      {entry.year}
                    </th>
                  ))}
                  <th scope="col" className={styles["matrix-head-num"]}>
                    Change
                  </th>
                </tr>
              </thead>
              <tbody>
                {METRICS.map((metric) => {
                  const delta = previous ? deltaOf(current[metric.key], previous[metric.key]) : null;
                  return (
                    <tr key={metric.key}>
                      <th scope="row" className={styles["matrix-row-head"]}>
                        {metric.label}
                      </th>
                      {timeline.map((entry) => (
                        <td
                          key={entry.year}
                          className={entry.year === year ? styles["matrix-cell-now"] : styles["matrix-cell"]}
                        >
                          {entry[metric.key]}
                        </td>
                      ))}
                      <td className={styles["matrix-cell"]}>
                        <span className={deltaClass(delta)}>
                          {delta === null ? "—" : signed(delta)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        </>
      )}

      {tab === "progress" && (
        <>
        {/* 4 */}
        <section className={styles.section}>
          <header className={styles.head}>
            <h2 className={styles.question}>Is everyone progressing?</h2>
            <p className={styles.answer}>
              {current.exams} exams passed in {year}
              {previous ? ` against ${previous.exams} in ${previous.year}` : ""}.{" "}
              {progression.behind === 0
                ? "Everybody is at or ahead of the target for their service length."
                : `${progression.behind} ${
                    progression.behind === 1 ? "cadet is" : "cadets are"
                  } behind the target for their service length.`}
            </p>
          </header>
          <div className={styles.grid}>
            <article className={styles.card}>
              <h3 className={styles["card-title"]}>Exams Passed</h3>
              <p className={styles.figure}>{current.exams}</p>
              <dl className={styles.pairs}>
                <div>
                  <dt>Behind target</dt>
                  <dd>{progression.behind}</dd>
                </div>
                <div>
                  <dt>No exam in six months</dt>
                  <dd>{progression.stalled.length}</dd>
                </div>
              </dl>
            </article>

            <article className={styles["card-wide"]}>
              <h3 className={styles["card-title"]}>Where the Squadron Sits</h3>
              <ul className={styles.rows}>
                {progression.funnel.map((band) => (
                  <li key={band.rung} className={styles.row}>
                    <span className={styles["row-name"]}>{band.rung}</span>
                    <span className={styles.track}>
                      <span className={band.tone} style={{ width: band.width }} />
                    </span>
                    <span className={styles["row-value"]}>{band.count}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className={styles.card}>
              <h3 className={styles["card-title"]}>Active, Not Progressing</h3>
              {progression.stalled.length === 0 ? (
                <p className={styles.caption}>Everybody active has passed something recently.</p>
              ) : (
                <ul className={styles.people}>
                  {progression.stalled.slice(0, 5).map((cadet) => (
                    <li key={cadet.id} className={styles.person}>
                      <span
                        className={styles.mark}
                        style={{ backgroundColor: flightColour(cadet.flight) }}
                        aria-hidden="true"
                      />
                      <span className={styles["person-text"]}>
                        <span className={styles["person-name"]}>{cadet.name}</span>
                        <span className={styles["person-note"]}>
                          {cadet.label}
                          {cadet.isBehind ? ` · target ${cadet.target}` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        </section>

          <TimeToClassification timings={timings} flightMap={flightMap} />
          <BadgeLadder ladder={ladder} />
        </>
      )}

      {tab === "people" && (
        <>
        {/* 5 */}
        <section className={styles.section}>
          <header className={styles.head}>
            <h2 className={styles.question}>Is recognition reaching everyone?</h2>
            <p className={styles.answer}>
              The top five hold {Math.round(recognition.share * 100)}% of this year&rsquo;s points
              {recognition.invisible.length > 0
                ? `, and ${recognition.invisible.length} ${
                    recognition.invisible.length === 1 ? "cadet has" : "cadets have"
                  } nothing recorded at all.`
                : ", and everybody has something recorded."}
            </p>
          </header>
          <div className={styles.grid}>
            <article className={styles.card}>
              <h3 className={styles["card-title"]}>Held by the Top Five</h3>
              <p className={styles.figure}>{Math.round(recognition.share * 100)}%</p>
              <MusterBar value={recognition.share} max={1} />
              <p className={styles.caption}>
                Not wrong in itself &mdash; keen cadets earn more. It only matters next to the panel
                on the right.
              </p>
            </article>

            <article className={styles["card-wide"]}>
              <h3 className={styles["card-title"]}>How Points Are Spread</h3>
              <div className={styles.histogram}>
                {recognition.bands.map((band) => (
                  <div key={band.label} className={styles.band}>
                    <span className={styles["band-count"]}>{band.count}</span>
                    <div className={styles["band-track"]}>
                      <div
                        className={band.isZero ? styles["band-zero"] : styles["band-bar"]}
                        style={{ height: band.height }}
                      />
                    </div>
                    <span className={styles["band-label"]}>{band.label}</span>
                  </div>
                ))}
              </div>
            </article>

            {recognition.invisible.length > 0 ? (
              <article className={styles.alert}>
                <h3 className={styles["alert-title"]}>
                  {recognition.invisible.length}{" "}
                  {recognition.invisible.length === 1 ? "cadet has" : "cadets have"} no record this
                  year
                </h3>
                <p className={styles.caption}>
                  They are on the books. Nothing has been logged against them.
                </p>
                <ul className={styles.names}>
                  {recognition.invisible.map((cadet) => (
                    <li key={cadet.id} className={styles.name}>
                      {cadet.name}
                    </li>
                  ))}
                </ul>
              </article>
            ) : (
              <article className={styles.card}>
                <h3 className={styles["card-title"]}>Everyone Has Something</h3>
                <p className={styles.caption}>
                  Every cadet on the books has at least one record this year.
                </p>
              </article>
            )}
          </div>
        </section>

          <Retention former={former} intakeData={intakeData} />
          <CategoryReach reach={reach} cadetCount={cadets.length} />
          <RankLadder ladder={ranks} flightMap={flightMap} />
        </>
      )}

      {tab === "flights" && (
        <>
        {/* 3 */}
        <section className={styles.section}>
          <header className={styles.head}>
            <h2 className={styles.question}>How do the flights compare?</h2>
            <p className={styles.answer}>
              Competing flights only, and points per cadet as well as the total &mdash; flights
              are rarely the same size, and the staff flight does not compete.
            </p>
          </header>

          <div className={styles["table-card"]}>
            <table className={styles.matrix}>
              <caption className={styles["visually-hidden"]}>Flight points by training year</caption>
              <thead>
                <tr>
                  <th scope="col" className={styles["matrix-head"]}>
                    Flight
                  </th>
                  {timeline.map((entry) => (
                    <th
                      key={entry.year}
                      scope="col"
                      className={entry.year === year ? styles["matrix-head-now"] : styles["matrix-head-num"]}
                    >
                      {entry.year}
                    </th>
                  ))}
                  <th scope="col" className={styles["matrix-head-num"]}>
                    Change
                  </th>
                  <th scope="col" className={styles["matrix-head-num"]}>
                    Per Cadet
                  </th>
                  <th scope="col" className={styles["matrix-head"]}>
                    {year}
                  </th>
                </tr>
              </thead>
              <tbody>
                {flightTimeline.map((flight) => (
                  <tr key={flight.index}>
                    <th scope="row" className={styles["matrix-row-head"]}>
                      <span className={styles["flight-name"]}>
                        <span
                          className={styles.mark}
                          style={{ backgroundColor: flight.colour }}
                          aria-hidden="true"
                        />
                        {flight.name}
                        <span className={styles["flight-size"]}>{flight.size}</span>
                      </span>
                    </th>
                    {flight.perYear.map((entry) => (
                      <td
                        key={entry.year}
                        className={entry.year === year ? styles["matrix-cell-now"] : styles["matrix-cell"]}
                      >
                        {entry.total}
                      </td>
                    ))}
                    <td className={styles["matrix-cell"]}>
                      <span className={deltaClass(flight.delta)}>
                        {flight.delta === null ? "—" : signed(flight.delta)}
                      </span>
                    </td>
                    <td className={styles["matrix-cell"]}>{flight.perCadet}</td>
                    <td className={styles["matrix-bar"]}>
                      <MusterBar value={flight.now} max={bestFlightYear} colour={flight.colour} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {movers.length > 0 && (
            <div className={styles.grid}>
              <article className={styles["card-wide"]}>
                <h3 className={styles["card-title"]}>Most Improved on {previous.year}</h3>
                <ul className={styles.people}>
                  {movers
                    .filter((cadet) => cadet.change > 0)
                    .slice(0, 5)
                    .map((cadet) => (
                      <li key={cadet.id} className={styles.person}>
                        <span
                          className={styles.mark}
                          style={{ backgroundColor: flightColour(cadet.flight) }}
                          aria-hidden="true"
                        />
                        <span className={styles["person-text"]}>
                          <span className={styles["person-name"]}>{cadet.name}</span>
                          <span className={styles["person-note"]}>
                            {cadet.flightName} &middot; {cadet.before} &rarr; {cadet.now}
                          </span>
                        </span>
                        <span className={styles["delta-up"]}>{signed(cadet.change)}</span>
                      </li>
                    ))}
                </ul>
              </article>

              <article className={styles["card-wide"]}>
                <h3 className={styles["card-title"]}>Doing Less Than on {previous.year}</h3>
                <p className={styles.caption}>
                  Usually a cadet who has got busy elsewhere rather than one who has lost interest,
                  but worth a word either way.
                </p>
                <ul className={styles.people}>
                  {movers
                    .filter((cadet) => cadet.change < 0)
                    .slice(-5)
                    .reverse()
                    .map((cadet) => (
                      <li key={cadet.id} className={styles.person}>
                        <span
                          className={styles.mark}
                          style={{ backgroundColor: flightColour(cadet.flight) }}
                          aria-hidden="true"
                        />
                        <span className={styles["person-text"]}>
                          <span className={styles["person-name"]}>{cadet.name}</span>
                          <span className={styles["person-note"]}>
                            {cadet.flightName} &middot; {cadet.before} &rarr; {cadet.now}
                          </span>
                        </span>
                        <span className={styles["delta-down"]}>{signed(cadet.change)}</span>
                      </li>
                    ))}
                </ul>
              </article>
            </div>
          )}
        </section>

          <FlightAges ages={ages} />
        </>
      )}

      {tab === "keeping" && (
        <>
          <RecordingHealth health={health} />
          <DataQuality issues={issues} />
        </>
      )}

      <p className={styles.footnote}>
        Attendance is not here: the app has no attendance model, only parade-night records, which
        are written when someone remembers to write them &mdash; so it measures the log rather than
        the squadron. Age profile is not here either, because there is no date of birth. Retention
        is worked out from the records left behind by cadets no longer on strength, so it is a
        floor rather than a measurement: it cannot see anyone who left with nothing logged.
      </p>
    </MusterPage>
  );
};

export default MusterStatistics;
