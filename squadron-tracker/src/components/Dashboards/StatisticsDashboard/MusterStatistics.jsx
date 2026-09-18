import { useContext, useMemo, useState } from "react";
import { DataContext } from "../../../context/DataContext";
import { useSquadron } from "../../../context/SquadronContext";
import { deriveClassifications, examsPassedBy } from "../../../utils/classification";
import { getCadetPoints, getEventYear } from "../../../utils/points";
import { flightColour, getAssignableFlights } from "../../../utils/flights";
import MusterPage from "../../Muster/MusterPage";
import { MusterBar, MusterButton, MusterSelect } from "../../Muster/MusterControls";
import styles from "./MusterStatistics.module.css";

/**
 * Squadron statistics.
 *
 * A screen the classic interface never had, built around four questions a
 * squadron actually gets asked rather than a wall of tiles. Each section
 * leads with the answer in a sentence; the numbers underneath are the working.
 *
 * Everything here is derived from records already in Firestore. Two things
 * deliberately are NOT on this page, and it is worth writing down why, because
 * they are the first things anyone will ask for:
 *
 *   Retention and strength over time. There is no discharge date -- the Admin
 *   Area deletes a cadet's record outright -- so the app cannot tell "left the
 *   squadron" from "never existed". A strength curve built from the start
 *   dates of the cadets who are still here would show a line that only ever
 *   rises, which is worse than no line at all.
 *
 *   Age profile. There is no date of birth. Cadets age out at 20, so "how many
 *   leave in the next two years" is a real planning question this cannot
 *   answer.
 *
 * Both need a schema change. Until then the page says what it knows.
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

const MusterStatistics = () => {
    const { data } = useContext(DataContext);
    const { flights, flightMap } = useSquadron();

    const years = useMemo(() => {
        const seen = new Set();
        (data.events || []).forEach((event) => {
            const year = getEventYear(event);
            if (year) seen.add(year);
        });
        return [...seen].sort((a, b) => b.localeCompare(a));
    }, [data.events]);

    const [year, setYear] = useState(() => years[0] || String(new Date().getFullYear()));

    const cadets = data.cadets || [];
    const events = data.events || [];
    const scoped = useMemo(
        () => events.filter((event) => getEventYear(event) === year),
        [events, year]
    );

    /* -- 1. activity ----------------------------------------------------- */

    const activity = useMemo(() => {
        const flightPoints = data.flightPoints || {};
        const dates = new Set(scoped.map((event) => event.date).filter(Boolean));
        const points = cadets.reduce(
            (total, cadet) =>
                total + getCadetPoints(`${cadet.forename} ${cadet.surname}`, year, events, flightPoints),
            0
        );
        const byMonth = new Array(12).fill(0);
        scoped.forEach((event) => {
            const month = Number(String(event.date).slice(5, 7));
            if (month >= 1 && month <= 12) byMonth[(month + 3) % 12] += 1;
        });
        return { records: scoped.length, dates: dates.size, points, byMonth };
    }, [scoped, cadets, events, data.flightPoints, year]);

    const busiestMonth = Math.max(1, ...activity.byMonth);

    /* -- 2. attendance --------------------------------------------------- */

    /*
     * Attendance is counted from parade-night records, which is the only
     * evidence the app holds. A squadron that does not log parade nights will
     * see nothing here -- which is the honest answer, not a bug.
     */
    const attendance = useMemo(() => {
        const paradeEvents = scoped.filter((event) =>
            /parade/i.test(event.eventCategory || "") || /parade/i.test(event.eventName || "")
        );
        const nights = new Set(paradeEvents.map((event) => event.date).filter(Boolean));
        const nightCount = nights.size;

        const perCadet = cadets.map((cadet) => {
            const name = `${cadet.forename} ${cadet.surname}`;
            const attended = new Set(
                paradeEvents.filter((event) => event.cadetName === name).map((event) => event.date)
            ).size;
            return {
                id: cadet.id,
                name,
                flight: cadet.flight,
                flightName: flightMap[cadet.flight] || "Unassigned",
                attended,
                rate: nightCount ? attended / nightCount : null,
            };
        });

        const byFlight = getAssignableFlights(flights).map((flight) => {
            const members = perCadet.filter((cadet) => Number(cadet.flight) === flight.index);
            const rate = members.length && nightCount
                ? members.reduce((sum, cadet) => sum + cadet.rate, 0) / members.length
                : null;
            return { ...flight, rate, size: members.length };
        });

        const average = nightCount && perCadet.length
            ? perCadet.reduce((sum, cadet) => sum + cadet.rate, 0) / perCadet.length
            : null;

        return {
            nightCount,
            average,
            byFlight: byFlight.filter((flight) => flight.size > 0),
            atRisk: perCadet
                .filter((cadet) => cadet.rate !== null && cadet.rate < 0.5)
                .sort((a, b) => a.rate - b.rate)
                .slice(0, 5),
        };
    }, [scoped, cadets, flights, flightMap]);

    /* -- 3. progression -------------------------------------------------- */

    const progression = useMemo(() => {
        const derived = deriveClassifications(cadets, events);

        const funnel = RUNGS.map((rung, index) => ({
            rung,
            count: derived.filter((entry) => rungOf(entry.classificationLabel) === rung).length,
            tone: RUNG_CLASS[index],
        }));
        const widest = Math.max(1, ...funnel.map((band) => band.count));

        const examsThisYear = scoped.filter((event) => event.examName !== "").length;

        /*
         * Stalled means attending but not progressing: at least one record this
         * year, and no exam passed in the last six months. A cadet who has
         * stopped coming shows up in the attendance section instead, and
         * conflating the two hides the difference between "needs a nudge" and
         * "needs a phone call".
         */
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 6);
        const cutoffISO = cutoff.toISOString().slice(0, 10);

        const stalled = derived
            .filter((entry) => {
                const own = events.filter((event) => event.cadetName === entry.cadetName);
                const active = own.some((event) => getEventYear(event) === year);
                if (!active) return false;
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
            examsThisYear,
            behind: derived.filter((entry) => entry.isBehind).length,
            stalled,
        };
    }, [cadets, events, scoped, year]);

    /* -- 4. recognition -------------------------------------------------- */

    const recognition = useMemo(() => {
        const flightPoints = data.flightPoints || {};
        const totals = cadets
            .map((cadet) => {
                const name = `${cadet.forename} ${cadet.surname}`;
                return {
                    id: cadet.id,
                    name,
                    flight: cadet.flight,
                    flightName: flightMap[cadet.flight] || "Unassigned",
                    points: getCadetPoints(name, year, events, flightPoints),
                    records: scoped.filter((event) => event.cadetName === name).length,
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
    }, [cadets, events, scoped, data.flightPoints, flightMap, year]);

    const percent = (value) => (value === null ? "—" : `${Math.round(value * 100)}%`);

    return (
        <MusterPage
            title="Squadron statistics"
            description="Four questions the squadron gets asked, answered from what has been logged."
            actions={
                <MusterSelect
                    label="Year"
                    value={year}
                    onChange={setYear}
                    options={years.map((value) => ({ value, label: value }))}
                />
            }
        >
            {/* 1 */}
            <section className={styles.section}>
                <header className={styles.head}>
                    <h2 className={styles.question}>How much is being recorded?</h2>
                    <p className={styles.answer}>
                        {activity.records} records across {activity.dates}{" "}
                        {activity.dates === 1 ? "date" : "dates"} in {year}, worth {activity.points} points.
                    </p>
                </header>
                <div className={styles.grid}>
                    <article className={styles.card}>
                        <h3 className={styles["card-title"]}>Records logged</h3>
                        <p className={styles.figure}>{activity.records}</p>
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
                                <dd>{activity.points}</dd>
                            </div>
                        </dl>
                    </article>

                    <article className={styles["card-wide"]}>
                        <h3 className={styles["card-title"]}>When they were logged</h3>
                        <div className={styles.months}>
                            {["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"].map(
                                (month, index) => (
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
                                )
                            )}
                        </div>
                    </article>
                </div>
            </section>

            {/* 2 */}
            <section className={styles.section}>
                <header className={styles.head}>
                    <h2 className={styles.question}>Who is turning up?</h2>
                    <p className={styles.answer}>
                        {attendance.nightCount === 0
                            ? "No parade nights have been logged this year, so attendance cannot be worked out."
                            : `${percent(attendance.average)} across ${attendance.nightCount} logged parade ${
                                  attendance.nightCount === 1 ? "night" : "nights"
                              }.`}
                    </p>
                </header>
                <div className={styles.grid}>
                    <article className={styles.card}>
                        <h3 className={styles["card-title"]}>Average attendance</h3>
                        <p className={styles.figure}>{percent(attendance.average)}</p>
                        <p className={styles.caption}>
                            Counted from parade-night records. A squadron that does not log them sees
                            nothing here.
                        </p>
                    </article>

                    <article className={styles["card-wide"]}>
                        <h3 className={styles["card-title"]}>By flight</h3>
                        {attendance.byFlight.length === 0 ? (
                            <p className={styles.caption}>Nothing to compare yet.</p>
                        ) : (
                            <ul className={styles.rows}>
                                {attendance.byFlight.map((flight) => (
                                    <li key={flight.index} className={styles.row}>
                                        <span className={styles["row-name"]}>{flight.name}</span>
                                        <MusterBar
                                            value={flight.rate || 0}
                                            max={1}
                                            colour={flightColour(flight.index)}
                                            width="100%"
                                        />
                                        <span className={styles["row-value"]}>{percent(flight.rate)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </article>

                    <article className={styles.card}>
                        <h3 className={styles["card-title"]}>Under half the nights</h3>
                        {attendance.atRisk.length === 0 ? (
                            <p className={styles.caption}>Nobody is below half. Worth saying out loud.</p>
                        ) : (
                            <ul className={styles.people}>
                                {attendance.atRisk.map((cadet) => (
                                    <li key={cadet.id} className={styles.person}>
                                        <span
                                            className={styles.mark}
                                            style={{ backgroundColor: flightColour(cadet.flight) }}
                                            aria-hidden="true"
                                        />
                                        <span className={styles["person-text"]}>
                                            <span className={styles["person-name"]}>{cadet.name}</span>
                                            <span className={styles["person-note"]}>{cadet.flightName}</span>
                                        </span>
                                        <span className={styles["person-value"]}>{percent(cadet.rate)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </article>
                </div>
            </section>

            {/* 3 */}
            <section className={styles.section}>
                <header className={styles.head}>
                    <h2 className={styles.question}>Is everyone progressing?</h2>
                    <p className={styles.answer}>
                        {progression.examsThisYear} exams passed in {year}.{" "}
                        {progression.behind === 0
                            ? "Everybody is at or ahead of the target for their service length."
                            : `${progression.behind} ${
                                  progression.behind === 1 ? "cadet is" : "cadets are"
                              } behind the target for their service length.`}
                    </p>
                </header>
                <div className={styles.grid}>
                    <article className={styles.card}>
                        <h3 className={styles["card-title"]}>Exams passed</h3>
                        <p className={styles.figure}>{progression.examsThisYear}</p>
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
                        <h3 className={styles["card-title"]}>Where the squadron sits</h3>
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
                        <h3 className={styles["card-title"]}>Attending, not progressing</h3>
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

            {/* 4 */}
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
                        <h3 className={styles["card-title"]}>Held by the top five</h3>
                        <p className={styles.figure}>{Math.round(recognition.share * 100)}%</p>
                        <MusterBar value={recognition.share} max={1} />
                        <p className={styles.caption}>
                            Not wrong in itself &mdash; keen cadets earn more. It only matters next to the
                            panel on the right.
                        </p>
                    </article>

                    <article className={styles["card-wide"]}>
                        <h3 className={styles["card-title"]}>How points are spread</h3>
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
                                {recognition.invisible.length === 1 ? "cadet has" : "cadets have"} no record
                                this year
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
                            <h3 className={styles["card-title"]}>Everyone has something</h3>
                            <p className={styles.caption}>
                                Every cadet on the books has at least one record this year.
                            </p>
                        </article>
                    )}
                </div>
            </section>

            <p className={styles.footnote}>
                Retention, strength over time and age profile are not here: the app stores no discharge
                date and no date of birth, so it cannot tell a cadet who left from one who was never
                added. Those need a schema change rather than another chart.
            </p>
        </MusterPage>
    );
};

export default MusterStatistics;
