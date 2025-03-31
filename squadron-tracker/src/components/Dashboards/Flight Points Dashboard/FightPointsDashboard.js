import React, { useState, useEffect } from "react";
import Table from "../../Table/Table"; // Import the Table component
import { getTotalPointsForCadet, getCadetFlight, getAllCadetNames } from "../../../firebase/firestoreUtils";

const FightPointsDashboard = () => {
    const [cadetPoints, setCadetPoints] = useState([]);
    const [flightPointsMap, setFlightPointsMap] = useState({});
    const [loading, setLoading] = useState(true); // Loading state

    useEffect(() => {
        const fetchData = async () => {
            try {
                const cadetNames = await getAllCadetNames();
                console.log("Cadet Names:", cadetNames);

                const flightPoints = {}; // To store total points for each flight

                const pointsData = await Promise.all(
                    cadetNames.map(async (cadetName) => {
                        const pointsEarned = await getTotalPointsForCadet(cadetName);
                        const flight = await getCadetFlight(cadetName); // Fetch the flight for each cadet

                        // Calculate total points for the flight
                        if (!flightPoints[flight]) {
                            flightPoints[flight] = 0;
                        }
                        flightPoints[flight] += pointsEarned;

                        console.log(`Points for ${cadetName}:`, pointsEarned, `Flight: ${flight}`);
                        return { cadetName, pointsEarned, flight };
                    })
                );

                // Log total points for each flight
                console.log("Total Points for Each Flight:", flightPoints);

                setCadetPoints(pointsData);
                setFlightPointsMap(flightPoints);
                console.log("Cadet Points Data:", pointsData);
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false); // Set loading to false after data is fetched
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return <div>Loading...</div>; // Show loading message while fetching data
    }

    const formattedData = cadetPoints.map(({ cadetName, pointsEarned, flight }) => ({
        "Cadet Name": cadetName,
        "Points Earned": pointsEarned,
        "Flight": flight,
    }));

    const colors = ["#6C91C2", "#88C0A9", "#F4A261", "#E76F51", "#A8DADC"]; // Softer, pastel-like colors

    return (
        <div>
            <h1>Flight Points Dashboard</h1>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" }}>
                {/* Table Section */}
                <div style={{ flex: "1", minWidth: "300px" }}>
                    <Table data={formattedData} columns={["Cadet Name", "Points Earned", "Flight"]} />
                </div>

                {/* Bar Chart Section */}
                <div style={{ flex: "1", minWidth: "300px" }}>
                    <h2>Flight Points Bar Chart</h2>
                    <div style={{ display: "flex", alignItems: "flex-end", height: "300px", marginTop: "20px" }}>
                        {Object.entries(flightPointsMap).map(([flight, points], index) => (
                            <div
                                key={flight}
                                style={{
                                    width: "100px",
                                    height: `${points}px`, // Scale the height based on points
                                    backgroundColor: colors[index % colors.length],
                                    margin: "0 10px",
                                    textAlign: "center",
                                    color: "#fff",
                                    fontSize: "14px",
                                    display: "flex",
                                    alignItems: "flex-end",
                                    justifyContent: "center",
                                    borderRadius: "5px", // Rounded corners for a modern look
                                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", // Subtle shadow for depth
                                }}
                            >
                                {points}
                            </div>
                        ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", marginTop: "10px" }}>
                        {Object.keys(flightPointsMap).map((flight, index) => (
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
                                <span style={{ fontSize: "14px", color: "#333" }}>{flight}</span> {/* Subtle text color */}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FightPointsDashboard;

