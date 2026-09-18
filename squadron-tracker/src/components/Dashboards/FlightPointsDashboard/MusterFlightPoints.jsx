import { useContext, useMemo, useState } from "react";
import { DataContext } from "../../../context/DataContext";
import { useSquadron } from "../../../context/SquadronContext";
import { getCadetPoints, getEventYear } from "../../../utils/points";
import { flightColour, getCompetingFlights } from "../../../utils/flights";
import MusterPage from "../../Muster/MusterPage";
import MusterTable from "../../Muster/MusterTable";
import {
  FlightMark,
  MusterBar,
  MusterEmpty,
  MusterSelect,
} from "../../Muster/MusterControls";
import styles from "./MusterFlightPoints.module.css";

/**
 * Flight points, Muster.
 *
 * The standings are the screen, so they are the first thing on it rather than
 * a table you read down to. Three things sit alongside each one:
 *
 * Points per cadet, because flights are rarely the same size. A flight of
 * eleven beating a flight of six on raw total has not necessarily done better,
 * and the competition is read out on parade -- so the fairer number belongs
 * next to the headline one rather than buried.
 *
 * A cumulative line through the year, which answers "are they pulling away or
 * did they win it in October" -- the question anyone looking at a close table
 * actually has.
 *
 * Who is carrying each flight. Worth knowing before the standings are read
 * out, because "Alpha are doing well" and "two people in Alpha are doing well"
 * call for different things to be said.
 */

const MONTHS = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];

/* The training year runs September to August, so month 8 (September) is index 0. */
const monthIndex = (date) => {
  const month = Number(String(date).slice(5, 7));
  if (!month) return -1;
  return (month + 3) % 12;
};

const MusterFlightPoints = () => {
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

  const competing = useMemo(() => getCompetingFlights(flights), [flights]);

  /** Every cadet's total for the chosen year, with their flight attached. */
  const cadetTotals = useMemo(() => {
    const events = data.events || [];
    const flightPoints = data.flightPoints || {};
    return (data.cadets || []).map((cadet) => {
      const name = `${cadet.forename} ${cadet.surname}`;
      return {
        id: cadet.id,
        name,
        flight: cadet.flight,
        flightName: flightMap[cadet.flight] || "Unassigned",
        points: getCadetPoints(name, year, events, flightPoints),
      };
    });
  }, [data.cadets, data.events, data.flightPoints, year, flightMap]);

  const standings = useMemo(() => {
    const rows = competing.map((flight) => {
      const members = cadetTotals.filter((cadet) => Number(cadet.flight) === flight.index);
      const total = members.reduce((sum, cadet) => sum + cadet.points, 0);
      return {
        index: flight.index,
        name: flight.name,
        colour: flightColour(flight.index),
        total,
        size: members.length,
        perCadet: members.length ? Math.round(total / members.length) : 0,
      };
    });

    const best = Math.max(1, ...rows.map((row) => row.total));
    return rows
      .sort((a, b) => b.total - a.total)
      .map((row, position) => ({ ...row, position: position + 1, share: row.total / best }));
  }, [competing, cadetTotals]);

  /**
   * Cumulative points per flight through the training year.
   *
   * Drawn as inline SVG rather than through Chart.js. The classic dashboard
   * already carries that dependency, but this is four polylines on a fixed
   * grid -- reaching for a charting library here would mean pushing theme
   * colours into its defaults just to draw lines that CSS variables can colour
   * directly.
   *
   * The viewBox ratio is honoured rather than stretched; see the stylesheet.
   */
  const series = useMemo(() => {
    const events = (data.events || []).filter((event) => getEventYear(event) === year);
    const flightPoints = data.flightPoints || {};
    const byName = new Map(cadetTotals.map((cadet) => [cadet.name, cadet.flight]));

    return standings.map((flight) => {
      const running = new Array(MONTHS.length).fill(0);
      events.forEach((event) => {
        if (Number(byName.get(event.cadetName)) !== flight.index) return;
        const index = monthIndex(event.date);
        if (index < 0) return;
        // getEventPoints is reached through getCadetPoints elsewhere; here the
        // per-event value is needed, so it is recomputed the same way.
        running[index] += getCadetPoints(event.cadetName, year, [event], flightPoints);
      });

      let total = 0;
      const cumulative = running.map((value) => {
        total += value;
        return total;
      });

      return { ...flight, cumulative, peak: total };
    });
  }, [data.events, data.flightPoints, cadetTotals, standings, year]);

  const chartMax = Math.max(1, ...series.map((flight) => flight.peak));

  /*
   * Who is carrying each flight: the handful at the top, which is the
   * question you have before the standings are read out.
   */
  const contributors = useMemo(
    () =>
      [...cadetTotals]
        .filter((cadet) => cadet.points > 0)
        .sort((a, b) => b.points - a.points)
        .slice(0, 8),
    [cadetTotals]
  );

  /*
   * Every cadet, including the ones on nothing.
   *
   * Duplicates a column of the cadet list on purpose. This is the screen
   * someone has open when they are working out who to chase, and sending
   * them to another screen to find out who scored nothing is how a question
   * with an answer right here turns into two screens and a note.
   */
  const everyone = useMemo(() => [...cadetTotals], [cadetTotals]);

  const topPoints = contributors[0]?.points || 1;
  const leader = standings[0];
  const runnerUp = standings[1];

  const rollColumns = [
    {
      key: "cadet",
      header: "Cadet",
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
      key: "points",
      header: "Points",
      align: "right",
      width: "90px",
      sortValue: (row) => row.points,
      render: (row) =>
        row.points === 0 ? (
          <span className={styles.none}>0</span>
        ) : (
          <strong>{row.points}</strong>
        ),
    },
  ];

  const columns = [
    {
      key: "cadet",
      header: "Cadet",
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
      key: "bar",
      header: "Share",
      width: "160px",
      render: (row) => (
        <MusterBar value={row.points} max={topPoints} colour={flightColour(row.flight)} width="140px" />
      ),
    },
    {
      key: "points",
      header: "Points",
      align: "right",
      width: "90px",
      sortValue: (row) => row.points,
      render: (row) => <strong>{row.points}</strong>,
    },
  ];

  return (
    <MusterPage
      title="Flight Points"
      description={
        leader && runnerUp
          ? `${leader.name} leads ${runnerUp.name} by ${leader.total - runnerUp.total}.`
          : "Points earned by each competing flight."
      }
      actions={
        <MusterSelect
          label="Year"
          value={year}
          onChange={setYear}
          options={years.map((value) => ({ value, label: value }))}
        />
      }
    >
      <section className={styles.standings} aria-label="Flight Standings">
        {standings.map((flight) => (
          <article key={flight.index} className={styles.flight} style={{ borderTopColor: flight.colour }}>
            <header className={styles["flight-head"]}>
              <span className={styles.position} style={{ color: flight.colour }}>
                {flight.position}
              </span>
              <h2 className={styles["flight-name"]}>{flight.name}</h2>
            </header>
            <p className={styles.total}>
              {flight.total}
              <span className={styles["total-unit"]}> points</span>
            </p>
            <MusterBar value={flight.share} max={1} colour={flight.colour} />
            <p className={styles["per-cadet"]}>
              <strong>{flight.perCadet}</strong> per cadet &middot; {flight.size}{" "}
              {flight.size === 1 ? "cadet" : "cadets"}
            </p>
          </article>
        ))}
      </section>

      {/*
        * The stem of the T. The year line and who is carrying each flight
        * both explain the standings above them, so they sit under it; the
        * roll on the right is the per-cadet detail you reach for next.
        */}
      <div className={styles.stem}>
        <div className={styles.explain}>
      <section className={styles.chart} aria-label="Points Through the Year">
        <header className={styles["chart-head"]}>
          <h2 className={styles["chart-title"]}>Points Through the Year</h2>
          <ul className={styles.legend}>
            {series.map((flight) => (
              <li key={flight.index} className={styles["legend-item"]}>
                <span className={styles.swatch} style={{ backgroundColor: flight.colour }} aria-hidden="true" />
                {flight.name}
              </li>
            ))}
          </ul>
        </header>

        <svg
          className={styles.svg}
          viewBox="0 0 760 240"
          role="img"
          aria-label={series
            .map((flight) => `${flight.name} finished on ${flight.peak} points`)
            .join(". ")}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((step) => {
            const y = 210 - step * 190;
            return (
              <g key={step}>
                <line x1="44" y1={y} x2="752" y2={y} className={styles.grid} />
                <text x="36" y={y + 4} textAnchor="end" className={styles.tick}>
                  {Math.round(step * chartMax)}
                </text>
              </g>
            );
          })}

          {series.map((flight) => (
            <polyline
              key={flight.index}
              className={styles.line}
              stroke={flight.colour}
              points={flight.cumulative
                .map((value, index) => {
                  const x = 44 + (index * (752 - 44)) / (MONTHS.length - 1);
                  const y = 210 - (value / chartMax) * 190;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(" ")}
            />
          ))}

          {MONTHS.map((month, index) => (
            <text
              key={month}
              x={44 + (index * (752 - 44)) / (MONTHS.length - 1)}
              y="232"
              textAnchor="middle"
              className={styles.tick}
            >
              {month}
            </text>
          ))}
        </svg>
      </section>

      <MusterTable
        columns={columns}
        rows={contributors}
        getRowKey={(row) => row.id}
        defaultSort={{ key: "points", direction: "desc" }}
        caption="Who is carrying each flight. Useful before the standings are read out on parade."
        empty={
          <MusterEmpty title={`Nothing scored in ${year}`}>
            Records added against a cadet count towards their flight automatically.
          </MusterEmpty>
        }
      />
        </div>

        <div className={styles.roll}>
          <MusterTable
            columns={rollColumns}
            rows={everyone}
            getRowKey={(row) => row.id}
            defaultSort={{ key: "points", direction: "desc" }}
            caption={`Every cadet, and what they have earned in ${year}.`}
            toolbar={
              <>
                <span className={styles["roll-title"]}>Every Cadet</span>
                <span className={styles.spacer} />
                <span className={styles.count}>
                  {everyone.filter((cadet) => cadet.points === 0).length} on nothing
                </span>
              </>
            }
            empty={<MusterEmpty title="No Cadets">Add cadets to see their points here.</MusterEmpty>}
          />
        </div>
      </div>
    </MusterPage>
  );
};

export default MusterFlightPoints;
