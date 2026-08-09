import React, { useState, useEffect, useContext } from "react";
import { addPointsToFlight, fetchTeamPoints } from "../../../firebase/flightPoints";
import Table from "../../Table/Table";
import { DataContext } from "../../../context/DataContext";
import { useSquadron } from "../../../context/SquadronContext";
import { getCadetPoints, getFlightPointTotals } from "../../../utils/points";
import { getAssignableFlights, getCompetingFlights } from "../../../utils/flights";
import Modal from "../DashboardComponents/Modal";
import "../DashboardComponents/dashboardStyles.css";

const FlightPointsDashboard = () => {
    const { data } = useContext(DataContext);
    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [selectedFlight, setSelectedFlight] = useState("");
    const [pointsToAdd, setPointsToAdd] = useState("");
    const [popupError, setPopupError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { squadronNumber, flightMap, flights } = useSquadron();

    // Which flights appear in the competition, and which can be allocated
    // points. Both come from the squadron's configuration -- this used to be
    // `flight === "2" || flight === "3"` hardcoded in four places, and the
    // allocation dropdown was built from whichever flights cadets happened to
    // be in, so an empty flight could not be given points at all.
    const competingFlights = getCompetingFlights(flights);
    const allocatableFlights = getAssignableFlights(flights);
    // Ref to trigger data refresh after points allocation
    const [refreshKey, setRefreshKey] = useState(0);

    // Handle popup confirm
    const handleConfirm = async () => {
        setPopupError("");
        if (!selectedFlight || !pointsToAdd || isNaN(pointsToAdd)) {
            setPopupError("Please select a flight and enter a valid number of points.");
            return;
        }
        setIsSubmitting(true);
        try {
            await addPointsToFlight(squadronNumber, String(selectedFlight), Number(pointsToAdd));
            setShowPopup(false);
            setSelectedFlight("");
            setPointsToAdd("");
            setRefreshKey(prev => prev + 1); // Trigger data refresh
        } catch (err) {
            setPopupError("Failed to allocate points. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };
    const [cadetPoints, setCadetPoints] = useState([]);
    const [flightPointsMap, setFlightPointsMap] = useState({});
    const [loading, setLoading] = useState(true); // Loading state
    const [year, setYear] = useState(new Date().getFullYear()); // State for the year input
    // Removed unused teamPoints state

    // Generate a list of years for the dropdown (e.g., last 10 years)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
    // ...existing code...

    useEffect(() => {
        setLoading(true);
        const fetchData = async () => {
            try {
                // Extract cadets and events from DataContext
                const cadets = data.cadets || [];
                const events = data.events || [];

                const pointsData = cadets.map((cadet) => ({
                    cadetName: `${cadet.forename} ${cadet.surname}`,
                    pointsEarned: getCadetPoints(
                        `${cadet.forename} ${cadet.surname}`,
                        year,
                        events,
                        data.flightPoints
                    ),
                    flight: cadet.flight,
                }));

                const flightPoints = getFlightPointTotals(year, cadets, events, data.flightPoints);

                setCadetPoints(pointsData);

                // Fetch TeamPoints from Firestore and merge with calculated points
                let mergedFlightPoints = { ...flightPoints };
                if (squadronNumber) {
                    const teamPointsData = await fetchTeamPoints(squadronNumber);
                    // Add TeamPoints to each flight's total
                    Object.keys(teamPointsData).forEach(flight => {
                        const teamPts = Number(teamPointsData[flight] || 0);
                        if (mergedFlightPoints[flight]) {
                            mergedFlightPoints[flight] += teamPts;
                        } else {
                            mergedFlightPoints[flight] = teamPts;
                        }
                    });
                }
                setFlightPointsMap(mergedFlightPoints);
            } catch (error) {
                console.error("Error processing data from DataContext or Firestore TeamPoints:", error);
            } finally {
                setLoading(false); // Set loading to false after data is processed
            }
        };
        fetchData();
    }, [data, year, squadronNumber, refreshKey]); // Re-fetch data when the year, DataContext, squadronNumber, or refreshKey changes

    if (loading) {
        return <div>Loading...</div>; // Show loading message while fetching data
    }

    const formattedData = cadetPoints.map(({ cadetName, pointsEarned, flight }) => ({
        "Name": cadetName,
        "Points Earned": pointsEarned,
        "Flight": flight,
    }));

    // Define the colors array first
    const colors = ["var(--chart-series-1)", "var(--chart-series-2)", "var(--chart-series-3)", "var(--chart-series-4)", "var(--chart-series-5)"]; // Softer, pastel-like colors

    // Determine the cadets with the most points in their flight
    const topCadets = cadetPoints.reduce((acc, { cadetName, pointsEarned, flight }) => {
        if (!acc[flight] || pointsEarned > acc[flight].pointsEarned) {
            acc[flight] = { cadetName, pointsEarned };
        }
        return acc;
    }, {});

    // Create rowColors array for the Table component
    const rowColors = cadetPoints.map(({ cadetName, flight }) => {
        /*
         * undefined, not a colour. A default of white here painted every row
         * white regardless of theme -- Table.jsx leaves --row-bg unset when the
         * value is undefined, so the table's own themed surface shows through
         * and only the highlighted rows carry a colour.
         */
        let color;
        // Ensure flight is a number for comparison
        const flightNum = Number(flight);
        // Only highlight top cadet in flights 2 and 3
        // Highlight the top cadet in each competing flight, in that flight's
        // chart colour. Indexing by position in the competing list rather than
        // `flightNum - 2`, which assumed flight 2 was always the first one.
        const competingPosition = competingFlights.findIndex((f) => f.index === flightNum);
        if (
            competingPosition !== -1 &&
            topCadets[flight]?.cadetName === cadetName &&
            topCadets[flight]?.pointsEarned > 0
        ) {
            color = colors[competingPosition % colors.length];
        }
        return {
            row: cadetName,
            color,
        };
    });

    return (
        <div>
            {/* Allocate Points Button */}
            <div style={{ marginBottom: "20px" }}>
                <button
                    style={{
                        padding: "10px 20px",
                        borderRadius: "8px",
                        background: "var(--chart-series-1)",
                        color: "var(--color-text-inverse)",
                        fontWeight: "bold",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "16px",
                        boxShadow: "var(--shadow-soft)",
                        marginRight: "10px"
                    }}
                    onClick={() => setShowPopup(true)}
                >
                    Allocate Points to Flight
                </button>
            </div>

            {/*
              * The shared Modal, not a hand-rolled overlay.
              *
              * This dialog used to be ~60 lines of inline styles: its own
              * scrim, its own card, its own button arrangement with Confirm
              * styled in a chart colour. It looked nothing like the other
              * dialogs, stayed white in dark mode, and had no Escape key, no
              * focus trap and no dialog role -- because none of that comes for
              * free when you build a modal out of a div.
              */}
            <Modal
                isOpen={showPopup}
                onClose={() => setShowPopup(false)}
                title="Allocate Points to Flight"
                variant="allocate-points"
                onConfirm={handleConfirm}
                confirmLabel={isSubmitting ? "Allocating..." : "Confirm"}
                confirmDisabled={isSubmitting}
            >
                <div className="form-group">
                    <label className="form-label" htmlFor="allocate-flight">Flight:</label>
                    <select
                        id="allocate-flight"
                        className="form-select"
                        value={selectedFlight}
                        onChange={e => setSelectedFlight(e.target.value)}
                    >
                        <option value="">Select Flight</option>
                        {allocatableFlights.map((f) => (
                            <option key={`flight-option-${f.index}`} value={f.index}>{f.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="allocate-points">Points to Add:</label>
                    <input
                        id="allocate-points"
                        className="form-input"
                        type="number"
                        value={pointsToAdd}
                        onChange={e => setPointsToAdd(e.target.value)}
                        min="1"
                    />
                </div>
                {popupError && <div className="popup-error">{popupError}</div>}
            </Modal>
            {/* Year Dropdown Section */}
            <div style={{ marginBottom: "20px" }}>
                <label htmlFor="yearDropdown" style={{ marginRight: "10px", fontWeight: "bold" }}>
                    Year:
                </label>
                <select
                    id="yearDropdown"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-surface-sunken)",
                        fontSize: "16px",
                        fontWeight: "bold",
                        width: "140px",
                        cursor: "pointer",
                        transition: "0.2s ease-in-out",
                        boxShadow: "var(--shadow-soft)",
                    }}
                    onMouseOver={(e) => (e.target.style.backgroundColor = "var(--grey-175)")}
                    onMouseOut={(e) => (e.target.style.backgroundColor = "var(--color-surface-sunken)")}
                >
                    {years.map((yearOption) => (
                        <option key={yearOption} value={yearOption}>
                            {yearOption}
                        </option>
                    ))}
                </select>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" }}>
                {/* Table Section */}
                <div style={{ flex: "1", minWidth: "300px" }}>
                    <Table
                        data={formattedData}
                        columns={["Name", "Points Earned", "Flight"]}
                        rowColors={rowColors} // Pass the rowColors prop
                    />
                </div>

                {/* Bar Chart Section */}
                <div style={{ flex: "1", minWidth: "300px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "200px" }}>
                        {/* Bars */}
                        <div style={{ display: "flex", alignItems: "flex-end", height: "300px" }}>
                            {(() => {
                                const bars = competingFlights.map((f) => ({
                                    ...f,
                                    points: Number(flightPointsMap[f.index] || 0),
                                }));

                                const maxPoints = Math.max(0, ...bars.map((b) => b.points));
                                const scaleFactor = maxPoints > 0 ? 500 / maxPoints : 0; // Scale only if maxPoints > 0

                                return bars
                                    .map(({ index: flight, points }, index) => (
                                        <div
                                            key={flight}
                                            style={{
                                                width: "200px",
                                                height: `${points * scaleFactor}px`, // Scale the height based on points
                                                backgroundColor: colors[index % colors.length],
                                                margin: "0 10px",
                                                position: "relative", // Enable positioning for the label
                                                borderRadius: "5px", // Rounded corners for a modern look
                                                boxShadow: "var(--shadow-md)", // Subtle shadow for depth
                                                transition: "height 0.5s ease-in-out", // Add smooth transition for height
                                            }}
                                        >
                                            {/* Points Label */}
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    top: "-20px", // Position above the bar
                                                    left: "50%",
                                                    transform: "translateX(-50%)", // Center horizontally
                                                    color: "var(--color-text)", // Darker text color for readability
                                                    fontSize: "14px",
                                                    fontWeight: "bold",
                                                }}
                                            >
                                                {points}
                                            </div>
                                        </div>
                                    ));
                            })()}
                        </div>

                        {/* Legend */}
                        <div style={{ display: "flex", justifyContent: "center", marginTop: "10px" }}>
                            {competingFlights
                                .map(({ index: flight, name }, index) => (
                                    <div
                                        key={flight}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            margin: "0 10px",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: "20px",
                                                height: "20px",
                                                backgroundColor: colors[index % colors.length],
                                                marginRight: "5px",
                                                borderRadius: "3px", // Rounded corners for the legend
                                                boxShadow: "var(--shadow-sm)", // Subtle shadow for depth
                                            }}
                                        ></div>
                                        <span style={{ fontSize: "14px", color: "var(--color-text)" }}>
                                            {name || flightMap[flight] || `Flight ${flight}`}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FlightPointsDashboard;

