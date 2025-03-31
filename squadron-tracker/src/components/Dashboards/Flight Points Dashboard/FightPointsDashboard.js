import React, { useState, useEffect } from "react";
import Table from "../../Table/Table"; // Import the Table component
import { getTotalPointsForCadet, getCadetFlight, getAllCadetNames } from "../../../firebase/firestoreUtils";

const FightPointsDashboard = () => {
    const [cadetPoints, setCadetPoints] = useState([]);
    const [loading, setLoading] = useState(true); // Loading state
    
    useEffect(() => {
        const fetchData = async () => {
            try {
                const cadetNames = await getAllCadetNames();
                console.log("Cadet Names:", cadetNames);

                const pointsData = await Promise.all(
                    cadetNames.map(async (cadetName) => {
                        const pointsEarned = await getTotalPointsForCadet(cadetName);
                        const flight = await getCadetFlight(cadetName); // Fetch the flight for each cadet
                        console.log(`Points for ${cadetName}:`, pointsEarned, `Flight: ${flight}`);
                        return { cadetName, pointsEarned, flight };
                    })
                );

                setCadetPoints(pointsData);
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
        "Flight": flight, // Add the flight column
    }));

    return (
        <div>
            <h1>Flight Points Dashboard</h1>
            <Table data={formattedData} columns={["Cadet Name", "Points Earned", "Flight"]} />
        </div>
    );
};

export default FightPointsDashboard;

