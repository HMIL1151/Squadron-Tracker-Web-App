import { useMemo, useState } from "react";
import { useSquadron } from "../../../context/SquadronContext";
import { classificationMap, rankMap } from "../../../utils/mappings";
import { deriveClassification } from "../../../utils/classification";
import { getCadetPoints, getEventYear } from "../../../utils/points";
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
import PopupManager from "./CadetsDashboardPopupManager";
import SuccessMessage from "../DashboardComponents/SuccessMessage";
import ErrorMessage from "../DashboardComponents/ErrorMessage";
import useCadetList from "./useCadetList";
import CadetPanel from "./CadetPanel";
import styles from "./MusterCadetList.module.css";

/**
 * The cadet list, Muster.
 *
 * Same writes as the classic screen -- they share useCadetList and open the
 * same popups -- but a different answer to "what is this screen for".
 *
 * Classic shows seven columns of stored fields: forename, surname, rank,
 * flight, classification, start date, service length. Two of those are one
 * name split in half, and "3 Yrs, 1 Mos, 12 Days" is a precision nobody needs
 * from a list. What it does not show is anything a cadet has DONE, so checking
 * on someone means leaving for another screen.
 *
 * Here the row carries the things staff actually ask about -- where they are
 * against where they should be, how many badges, points this year -- and
 * selecting a cadet opens a panel beside the list rather than a modal over it,
 * so you can read one cadet while still scanning the rest.
 */

const ALL = "all";

const MusterCadetList = ({ user }) => {
  const list = useCadetList(user);
  const { data } = list;
  const { flightMap, flights } = useSquadron();

  const [search, setSearch] = useState("");
  const [flightFilter, setFlightFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState(null);

  /** The training year the points column reports on: the latest one logged. */
  const currentYear = useMemo(() => {
    const years = (data.events || []).map(getEventYear).filter(Boolean);
    return years.length ? years.sort().at(-1) : String(new Date().getFullYear());
  }, [data.events]);

  const rows = useMemo(() => {
    const events = data.events || [];
    const flightPoints = data.flightPoints || {};

    return (data.cadets || []).map((cadet) => {
      const name = `${cadet.forename} ${cadet.surname}`;
      const progress = deriveClassification(cadet, events);
      const own = events.filter((event) => event.cadetName === name);

      return {
        id: cadet.id,
        cadet,
        name,
        rank: rankMap[cadet.rank] || "Cadet",
        flight: cadet.flight,
        flightName: flightMap[cadet.flight] || "Unassigned",
        classification: progress.classificationLabel,
        classificationIndex: progress.classification,
        targetLabel: progress.targetClassificationLabel,
        isBehind: progress.isBehind,
        badges: own.filter((event) => event.badgeLevel && event.badgeCategory).length,
        records: own.length,
        points: getCadetPoints(name, currentYear, events, flightPoints),
        serviceMonths: progress.serviceLengthInMonths,
      };
    });
  }, [data.cadets, data.events, data.flightPoints, flightMap, currentYear]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (flightFilter !== ALL && String(row.flight) !== flightFilter) return false;
        if (!needle) return true;
        return row.name.toLowerCase().includes(needle);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, search, flightFilter]);

  const selected = rows.find((row) => row.id === selectedId) || null;
  const filtersActive = search !== "" || flightFilter !== ALL;

  const clearFilters = () => {
    setSearch("");
    setFlightFilter(ALL);
  };

  const columns = [
    {
      key: "cadet",
      header: "Cadet",
      width: "240px",
      render: (row) => (
        <span className={styles.cadet}>
          <FlightMark flight={row.flight} />
          <span className={styles["cadet-text"]}>
            <span className={styles["cadet-name"]}>{row.name}</span>
            <span className={styles["cadet-rank"]}>{row.rank}</span>
          </span>
        </span>
      ),
    },
    {
      key: "flight",
      header: "Flight",
      width: "120px",
      render: (row) => row.flightName,
    },
    {
      key: "classification",
      header: "Classification",
      render: (row) => (
        <span className={styles.classification}>
          <span className={styles.pips} aria-hidden="true">
            {Array.from({ length: 6 }, (_, step) => (
              <span
                key={step}
                className={
                  /*
                   * Six pips for the six named rungs, rather than the twelve
                   * classification values. Junior through Master is what
                   * anyone says out loud; the +1 and +2 steps in between are
                   * an internal detail of the count.
                   */
                  row.classificationIndex > step * 2 ? styles["pip-on"] : styles.pip
                }
              />
            ))}
          </span>
          <span>{row.classification}</span>
          {row.isBehind && (
            <span className={styles.behind} title={`Expected to be ${row.targetLabel} by now`}>
              behind
            </span>
          )}
        </span>
      ),
    },
    {
      key: "badges",
      header: "Badges",
      align: "right",
      width: "96px",
      render: (row) => (row.badges === 0 ? <span className={styles.none}>—</span> : row.badges),
    },
    {
      key: "points",
      header: `Points ${currentYear}`,
      align: "right",
      width: "120px",
      render: (row) => <strong>{row.points}</strong>,
    },
  ];

  return (
    <MusterPage
      title="Cadet list"
      description={`${rows.length} on strength. Classification is worked out from exams passed, so it is never out of date.`}
      actions={
        <>
          <MusterButton kind="danger" onClick={() => list.setIsPopupOpen(true)}>
            Discharge cadet
          </MusterButton>
          <MusterButton
            kind="primary"
            onClick={() => list.setIsAddPopupOpen(true)}
            icon={
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                <path d="M8 3.4v9.2M3.4 8h9.2" />
              </svg>
            }
          >
            Add cadet
          </MusterButton>
        </>
      }
    >
      <div className={styles.layout}>
        <div className={styles.list}>
          <MusterTable
            columns={columns}
            rows={visible}
            getRowKey={(row) => row.id}
            selectedKey={selectedId}
            onRowClick={(row) => setSelectedId(row.id)}
            toolbar={
              <>
                <MusterSearch
                  label="Search cadets"
                  value={search}
                  onChange={setSearch}
                  placeholder="Search cadets"
                  width="230px"
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
                <span className={styles.count}>
                  {visible.length === rows.length
                    ? `${rows.length} cadets`
                    : `${visible.length} of ${rows.length} cadets`}
                </span>
              </>
            }
            empty={
              <MusterEmpty
                title={filtersActive ? "No cadets match" : "No cadets yet"}
                action={
                  filtersActive ? (
                    <MusterButton onClick={clearFilters}>Show all cadets</MusterButton>
                  ) : (
                    <MusterButton kind="primary" onClick={() => list.setIsAddPopupOpen(true)}>
                      Add the first cadet
                    </MusterButton>
                  )
                }
              >
                {filtersActive
                  ? "Try another flight, or clear the filters."
                  : "Add your cadets and their records start counting towards flight points."}
              </MusterEmpty>
            }
          />
        </div>

        {selected && (
          <CadetPanel
            row={selected}
            events={data.events || []}
            onClose={() => setSelectedId(null)}
            onEdit={() => list.handleRowClick(selected.id)}
          />
        )}
      </div>

      <PopupManager
        isPopupOpen={list.isPopupOpen}
        isConfirmationOpen={list.isConfirmationOpen}
        isAddPopupOpen={list.isAddPopupOpen}
        isEditPopupOpen={list.isEditPopupOpen}
        setIsPopupOpen={list.setIsPopupOpen}
        setIsConfirmationOpen={list.setIsConfirmationOpen}
        setIsAddPopupOpen={list.setIsAddPopupOpen}
        setIsEditPopupOpen={list.setIsEditPopupOpen}
        handleDischarge={list.handleDischarge}
        handleAddCadet={list.handleAddCadet}
        cadets={data.cadets}
        setCadets={() => {}}
        selectedCadet={list.selectedCadet}
        setSelectedCadet={list.setSelectedCadet}
        newCadet={list.newCadet}
        handleInputChange={list.handleInputChange}
        classificationMap={classificationMap}
        rankMap={rankMap}
      />
      <SuccessMessage message={list.successMessage} />
      <ErrorMessage message={list.errorMessage} />
    </MusterPage>
  );
};

export default MusterCadetList;
