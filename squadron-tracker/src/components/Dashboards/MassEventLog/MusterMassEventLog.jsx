import { useContext, useMemo, useState } from "react";
import { DataContext } from "../../../context/DataContext";
import { useSquadron } from "../../../context/SquadronContext";
import { getEventYear } from "../../../utils/points";
import MusterPage from "../../Muster/MusterPage";
import MusterTable from "../../Muster/MusterTable";
import {
  FlightMark,
  MusterButton,
  MusterChip,
  MusterEmpty,
  MusterSearch,
  MusterSelect,
  MusterTag,
  SummaryStrip,
} from "../../Muster/MusterControls";
import AddEventPopup from "./AddEventPopup";
import EventDetailsPopup from "./EventDetailsPopup";
import LoadingPopup from "../DashboardComponents/LoadingPopup";
import SuccessMessage from "../DashboardComponents/SuccessMessage";
import ErrorMessage from "../DashboardComponents/ErrorMessage";
import useMassEventLog from "./useMassEventLog";
import styles from "./MusterMassEventLog.module.css";

/**
 * The event log, Muster.
 *
 * Same behaviour as the classic screen -- they share useMassEventLog, and both
 * open the same add and details popups. What changed is what you can find.
 *
 * The classic screen shows every record the squadron has ever logged, oldest
 * first, with a filter box inside each column heading. On a squadron with a
 * few years of history that is a wall you scroll rather than a list you read.
 * Here it is newest first, filtered to one training year by default, with the
 * search and filters gathered into one toolbar above the table, and a strip of
 * totals so the page answers "how are we doing" before you read a single row.
 *
 * The table also shows flight and category, which the classic one does not --
 * they are the two things staff most often want to slice by, and having to
 * open a record to find out which flight someone is in is why people keep
 * their own lists.
 */

const ALL = "all";

const MusterMassEventLog = ({ user }) => {
  const log = useMassEventLog(user);
  const { data } = useContext(DataContext);
  const { flightMap } = useSquadron();

  const [search, setSearch] = useState("");
  const [year, setYear] = useState(ALL);
  const [category, setCategory] = useState(ALL);

  /** Which flight each cadet is in, so a row can be marked without a lookup. */
  const flightByName = useMemo(() => {
    const map = new Map();
    (data.cadets || []).forEach((cadet) => {
      map.set(`${cadet.forename} ${cadet.surname}`, cadet.flight);
    });
    return map;
  }, [data.cadets]);

  /** Training years present in the log, newest first. */
  const years = useMemo(() => {
    const seen = new Set();
    (data.events || []).forEach((event) => {
      const value = getEventYear(event);
      if (value) seen.add(value);
    });
    return [...seen].sort((a, b) => b.localeCompare(a));
  }, [data.events]);

  const categories = useMemo(() => {
    const seen = new Set();
    log.events.forEach((event) => {
      if (event.eventCategory) seen.add(event.eventCategory);
    });
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [log.events]);

  /*
   * Newest first. The classic screen inherits whatever order Firestore handed
   * back, which in practice is the order things were written -- so the record
   * you just added appears at the bottom of a screen of history.
   */
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return log.events
      .filter((event) => {
        if (year !== ALL && String(event.Date).slice(0, 4) !== year) return false;
        if (category !== ALL && event.eventCategory !== category) return false;
        if (!needle) return true;
        return (
          String(event.Name).toLowerCase().includes(needle) ||
          String(event.Record).toLowerCase().includes(needle)
        );
      })
      .map((event) => ({
        ...event,
        flight: flightByName.get(event.Name),
        flightName: flightMap[flightByName.get(event.Name)] || "",
      }))
      .sort((a, b) => String(b.Date).localeCompare(String(a.Date)));
  }, [log.events, search, year, category, flightByName, flightMap]);

  /*
   * Totals for whatever is currently selected, not for all time. A number that
   * ignores the filter above it is a number people learn to distrust.
   */
  const summary = useMemo(() => {
    const scoped = year === ALL ? log.events : log.events.filter((e) => String(e.Date).slice(0, 4) === year);
    const points = scoped.reduce((total, event) => total + (event.Points || 0), 0);
    const exams = (data.events || []).filter(
      (event) => event.examName !== "" && (year === ALL || getEventYear(event) === year)
    ).length;

    return [
      { label: year === ALL ? "Records logged" : `Records in ${year}`, value: scoped.length },
      { label: "Cadets on strength", value: (data.cadets || []).length },
      { label: "Exams passed", value: exams },
      { label: "Points awarded", value: points.toLocaleString("en-GB") },
    ];
  }, [log.events, data.events, data.cadets, year]);

  const filtersActive = search !== "" || year !== ALL || category !== ALL;

  const clearFilters = () => {
    setSearch("");
    setYear(ALL);
    setCategory(ALL);
  };

  const columns = [
    {
      key: "cadet",
      header: "Cadet",
      width: "260px",
      sortValue: (row) => row.Name,
      filterValue: (row) => row.Name + " " + row.flightName,
      render: (row) => (
        <span className={styles.cadet}>
          <FlightMark flight={row.flight} />
          <span className={styles["cadet-name"]}>{row.Name}</span>
          {row.flightName && <span className={styles["cadet-flight"]}>{row.flightName}</span>}
        </span>
      ),
    },
    {
      key: "record",
      header: "Record",
      sortValue: (row) => row.Record,
      filterValue: (row) => row.Record,
      render: (row) => row.Record,
    },
    {
      key: "category",
      header: "Category",
      width: "180px",
      sortValue: (row) => row.eventCategory,
      filterValue: (row) => row.eventCategory,
      render: (row) => (row.eventCategory ? <MusterTag>{row.eventCategory}</MusterTag> : null),
    },
    {
      key: "date",
      header: "Date",
      width: "130px",
      // Stored "YYYY-MM-DD", so string order is date order.
      sortValue: (row) => row.Date,
      filterValue: (row) => row.Date,
      render: (row) => <span className={styles.date}>{row.Date}</span>,
    },
    {
      key: "points",
      header: "Points",
      align: "right",
      width: "92px",
      sortValue: (row) => row.Points,
      render: (row) => <strong className={styles.points}>{row.Points}</strong>,
    },
  ];

  return (
    <MusterPage
      title="Mass Event Log"
      description="Everything recorded against a cadet, newest first."
      actions={
        <MusterButton
          kind="primary"
          onClick={log.openPopup}
          icon={
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
              <path d="M8 3.4v9.2M3.4 8h9.2" />
            </svg>
          }
        >
          Add Record
        </MusterButton>
      }
    >
      {log.loading && <LoadingPopup />}

      <SummaryStrip items={summary} />

      <MusterTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        onRowClick={log.handleRowClick}
        defaultSort={{ key: "date", direction: "desc" }}
        toolbar={
          <>
            <MusterSearch
              label="Search records"
              value={search}
              onChange={setSearch}
              placeholder="Search cadet or record"
              width="268px"
            />
            <MusterSelect
              label="Year"
              value={year}
              onChange={setYear}
              options={[
                { value: ALL, label: "All years" },
                ...years.map((value) => ({ value, label: value })),
              ]}
            />
            <MusterSelect
              label="Category"
              value={category}
              onChange={setCategory}
              options={[
                { value: ALL, label: "All categories" },
                ...categories.map((value) => ({ value, label: value })),
              ]}
            />
            {filtersActive && (
              <MusterChip active onClick={clearFilters}>
                Clear Filters
              </MusterChip>
            )}
            <span className={styles.spacer} />
            <span className={styles.count}>
              {rows.length === log.events.length
                ? `${rows.length} records`
                : `${rows.length} of ${log.events.length} records`}
            </span>
          </>
        }
        empty={
          <MusterEmpty
            title={filtersActive ? "Nothing Matches Those Filters" : "No Records Yet"}
            action={
              filtersActive ? (
                /*
                 * Worded differently from the toolbar chip on purpose. When the
                 * table is empty both are on screen at once, and two buttons
                 * with the same label two inches apart read as a mistake even
                 * though they do the same thing.
                 */
                <MusterButton onClick={clearFilters}>Show All Records</MusterButton>
              ) : (
                <MusterButton kind="primary" onClick={log.openPopup}>
                  Add the First Record
                </MusterButton>
              )
            }
          >
            {filtersActive
              ? "Try a different year, or clear the filters to see the whole log."
              : "Badges, exams, parade nights and awards all live here. Add one and it counts towards flight points straight away."}
          </MusterEmpty>
        }
      />

      <AddEventPopup
        isPopupOpen={log.isPopupOpen}
        inputValue={log.inputValue}
        filteredNames={log.filteredNames}
        badgeTypes={log.badgeTypes}
        eventCategories={log.eventCategories}
        specialAwards={log.specialAwards}
        highlightedIndex={log.highlightedIndex}
        selectedNames={log.selectedNames}
        handleInputChange={log.handleInputChange}
        handleKeyDown={log.handleKeyDown}
        handleNameSelect={log.handleNameSelect}
        handleRemoveName={log.handleRemoveName}
        handleAddEvent={log.handleAddEvent}
        closePopup={log.closePopup}
        eventDate={log.eventDate}
        handleDateChange={log.handleDateChange}
        onButtonSelect={log.handleButtonSelect}
      />
      <EventDetailsPopup
        isOpen={log.isEventPopupOpen}
        eventData={log.selectedEvent}
        onClose={log.closeEventPopup}
        onRemove={log.handleRemoveEvent}
      />
      <SuccessMessage message={log.successMessage} />
      <ErrorMessage message={log.errorMessage} />
    </MusterPage>
  );
};

export default MusterMassEventLog;
