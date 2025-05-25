import React, { useState, useEffect, useContext } from "react";
import Table from "../../Table/Table"; // Import the Table component
import { flightMap } from "../../../utils/mappings"; // Import flightMap from mappings.js
import { DataContext } from "../../../context/DataContext"; // Import DataContext

const FightPointsDashboard = () => {
    const [cadetPoints, setCadetPoints] = useState([]);
    const [flightPointsMap, setFlightPointsMap] = useState({});
    const [loading, setLoading] = useState(true); // Loading state
    const [year, setYear] = useState(new Date().getFullYear()); // State for the year input

    // Generate a list of years for the dropdown (e.g., last 10 years)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
    const { data } = useContext(DataContext); // Access data from DataContext

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Extract cadets and events from DataContext
                const cadets = data.cadets || [];
                const events = data.events || [];

                const flightPoints = {}; // To store total points for each flight

                // Map cadets to calculate points and flight
                const pointsData = cadets.map((cadet) => {
                    const { forename, surname, flight } = cadet;
                    const cadetName = `${forename} ${surname}`;


                    // Filter events for the current cadet and year
                    const cadetEvents = events.filter(
                        (event) =>
                            event.cadetName === cadetName &&
                            new Date(event.date).getFullYear() === year
                    );


                    // Calculate total points for the cadet
                    const pointsEarned = cadetEvents.reduce((total, event) => {
                        let eventPoints = 0;

                        // Determine points based on event type
                        if (event.badgeLevel && event.badgeCategory) {
                            // Badge Points (e.g., "Blue Badge")
                            eventPoints =
                                parseInt(
                                    data.flightPoints["Badge Points"]?.[`${event.badgeLevel} Badge`] || 0,
                                    10
                                );

                        } else if (event.examName) {
                            // Exam Points
                            eventPoints = parseInt(
                                data.flightPoints["Badge Points"]?.["Exam"] || 0,
                                10
                            );

                        } else if (event.eventCategory) {
                            // Event Category Points
                            eventPoints = parseInt(
                                data.flightPoints["Event Category Points"]?.[event.eventCategory] || 0,
                                10
                            );

                        } else if (event.specialAward) {
                            // Special Award Points
                            eventPoints = parseInt(
                                data.flightPoints["Badge Points"]?.["Special"] || 0,
                                10
                            );

                        } else {
                            console.warn("Unknown event type:", event);
                        }

                        return total + eventPoints;
                    }, 0);


                    // Calculate total points for the flight
                    if (!flightPoints[flight]) {
                        flightPoints[flight] = 0;
                    }
                    flightPoints[flight] += pointsEarned;


                    return { cadetName, pointsEarned, flight };
                });

                setCadetPoints(pointsData);
                setFlightPointsMap(flightPoints);
            } catch (error) {
                console.error("Error processing data from DataContext:", error);
            } finally {
                setLoading(false); // Set loading to false after data is processed
            }
        };

        fetchData();
    }, [data, year]); // Re-fetch data when the year or DataContext changes

    if (loading) {
        return <div>Loading...</div>; // Show loading message while fetching data
    }

    const formattedData = cadetPoints.map(({ cadetName, pointsEarned, flight }) => ({
        "Name": cadetName,
        "Points Earned": pointsEarned,
        "Flight": flight,
    }));

    // Define the colors array first
    const colors = ["#6C91C2", "#88C0A9", "#F4A261", "#E76F51", "#A8DADC"]; // Softer, pastel-like colors

    // Determine the cadets with the most points in their flight
    const topCadets = cadetPoints.reduce((acc, { cadetName, pointsEarned, flight }) => {
        if (!acc[flight] || pointsEarned > acc[flight].pointsEarned) {
            acc[flight] = { cadetName, pointsEarned };
        }
        return acc;
    }, {});

    // Debug: Print top cadet for each flight with flight number
    Object.entries(topCadets).forEach(([flight, { cadetName, pointsEarned }]) => {
        console.log(`Flight: ${flight}, Top Cadet: ${cadetName}, Points: ${pointsEarned}`);
    });

    // Create rowColors array for the Table component
    const rowColors = cadetPoints.map(({ cadetName, flight }) => {
        let color = "white"; // Default color for all rows
        // Ensure flight is a number for comparison
        const flightNum = Number(flight);
        // Only highlight top cadet in flights 2 and 3
        if ((flightNum === 2 || flightNum === 3) && topCadets[flight]?.cadetName === cadetName && topCadets[flight]?.pointsEarned > 0) {
            // Match the bar chart: flight 2 = colors[0], flight 3 = colors[1]
            color = colors[flightNum - 2]; // flight 2: 0, flight 3: 1
            console.log(`Highlighting cadet '${cadetName}' in flight ${flightNum} with color ${color}`);
        }
        return {
            row: cadetName,
            color,
        };
    });

    return (
        <div>
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
                        border: "1px solid #ccc",
                        backgroundColor: "#f9f9f9",
                        fontSize: "16px",
                        fontWeight: "bold",
                        width: "140px",
                        cursor: "pointer",
                        transition: "0.2s ease-in-out",
                        boxShadow: "0 2px 5px rgba(0, 0, 0, 0.1)",
                    }}
                    onMouseOver={(e) => (e.target.style.backgroundColor = "#e6e6e6")}
                    onMouseOut={(e) => (e.target.style.backgroundColor = "#f9f9f9")}
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
                                // Filter flights 2 and 3 and extract their points
                                const filteredPoints = Object.entries(flightPointsMap)
                                    .filter(([flight]) => flight === "2" || flight === "3") // Only include flights 2 and 3
                                    .map(([, points]) => points); // Extract the points

                                // Handle empty data or zero points for both flights
                                const maxPoints = filteredPoints.length > 0 && Math.max(...filteredPoints) > 0 ? Math.max(...filteredPoints) : 0;
                                const scaleFactor = maxPoints > 0 ? 500 / maxPoints : 0; // Scale only if maxPoints > 0

                                return Object.entries(flightPointsMap)
                                    .filter(([flight]) => flight === "2" || flight === "3") // Only include flights 2 and 3
                                    .map(([flight, points], index) => (
                                        <div
                                            key={flight}
                                            style={{
                                                width: "200px",
                                                height: `${points * scaleFactor}px`, // Scale the height based on points
                                                backgroundColor: colors[index % colors.length],
                                                margin: "0 10px",
                                                position: "relative", // Enable positioning for the label
                                                borderRadius: "5px", // Rounded corners for a modern look
                                                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", // Subtle shadow for depth
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
                                                    color: "#333", // Darker text color for readability
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
                            {Object.keys(flightPointsMap)
                                .filter((flight) => flight === "2" || flight === "3") // Only include flights 2 and 3
                                .map((flight, index) => (
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
                                                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)", // Subtle shadow for depth
                                            }}
                                        ></div>
                                        <span style={{ fontSize: "14px", color: "#333" }}>
                                            {flightMap[flight] || `Flight ${flight}`} {/* Use flightMap for labels */}
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

export default FightPointsDashboard;

