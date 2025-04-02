import React, { useState, useEffect } from "react";
import { getAllCadetNames, getEventsForCadet } from "../../../firebase/firestoreUtils";
import generateCertificatePDF from "./CertificatePDF";
import JSZip from "jszip"; // Import JSZip
import { saveAs } from "file-saver"; // Import FileSaver

const CertificateDashboard = () => {
    const [cadetNames, setCadetNames] = useState([]);
    const [selectedCadet, setSelectedCadet] = useState("");
    const [selectedYear, setSelectedYear] = useState("");
    const [years, setYears] = useState([]);
    const [eventStrings, setEventStrings] = useState([]);

    useEffect(() => {
        const fetchCadetNames = async () => {
            try {
                const names = await getAllCadetNames();
                setCadetNames(names);
            } catch (error) {
                console.error("Error fetching cadet names:", error);
            }
        };

        fetchCadetNames();

        const currentYear = new Date().getFullYear();
        const yearList = Array.from({ length: 10 }, (_, i) => currentYear - i);
        setYears(yearList);
    }, []);

    const fetchCadetEvents = async () => {
        if (!selectedCadet || !selectedYear) {
            alert("Please select both a cadet and a year.");
            return;
        }

        try {
            const events = await getEventsForCadet(selectedCadet);
            const filteredEvents = events.filter(event => {
                const eventYear = new Date(event.date).getFullYear();
                return eventYear === parseInt(selectedYear, 10);
            });

            const sortedEvents = filteredEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
            const formattedEvents = sortedEvents.map(event => 
                `${event.event} (${formatDate(event.date)})`
            );
            setEventStrings(formattedEvents);
        } catch (error) {
            console.error("Error fetching cadet events:", error);
        }
    };

    const formatDate = (dateString) => {
        const options = { day: "2-digit", month: "short", year: "numeric" };
        return new Date(dateString).toLocaleDateString("en-GB", options);
    };

    const handleGeneratePDF = () => {
        if (!selectedCadet || !selectedYear) {
            alert("Please select both a cadet and a year.");
            return;
        }
        generateCertificatePDF(selectedCadet, selectedYear, eventStrings);
    };

    const handleRemoveEvent = (index) => {
        // Remove the event at the specified index
        const updatedEvents = eventStrings.filter((_, i) => i !== index);
        setEventStrings(updatedEvents);
    };

    const handleDownloadAllCertificates = async () => {
        if (!selectedYear) {
            alert("Please select a year.");
            return;
        }

        const zip = new JSZip();

        for (const cadet of cadetNames) {
            try {
                const events = await getEventsForCadet(cadet);
                const filteredEvents = events.filter(event => {
                    const eventYear = new Date(event.date).getFullYear();
                    return eventYear === parseInt(selectedYear, 10);
                });

                const sortedEvents = filteredEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
                const formattedEvents = sortedEvents.map(event =>
                    `${event.event} (${formatDate(event.date)})`
                );

                const pdfBlob = await generateCertificatePDF(cadet, selectedYear, formattedEvents, true); // Pass `true` to return Blob
                zip.file(`${cadet}_Certificate_${selectedYear}.pdf`, pdfBlob);
            } catch (error) {
                console.error(`Error generating certificate for ${cadet}:`, error);
            }
        }

        // Generate the zip file and trigger download
        zip.generateAsync({ type: "blob" }).then(content => {
            saveAs(content, `Certificates_${selectedYear}.zip`);
        });
    };

    return (
        <div>
            <h1>Certificate Dashboard</h1>

            <label htmlFor="cadet-select">Select Cadet:</label>
            <select
                id="cadet-select"
                value={selectedCadet}
                onChange={(e) => setSelectedCadet(e.target.value)}
            >
                <option value="">-- Select a Cadet --</option>
                <option value="all">All Cadets</option> {/* Add "All Cadets" option */}
                {cadetNames.map((name, index) => (
                    <option key={index} value={name}>
                        {name}
                    </option>
                ))}
            </select>

            <label htmlFor="year-select">Select Year:</label>
            <select
                id="year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
            >
                <option value="">-- Select a Year --</option>
                {years.map((year, index) => (
                    <option key={index} value={year}>
                        {year}
                    </option>
                ))}
            </select>

            <button onClick={fetchCadetEvents}>Generate</button>

            <div>
                <h2>Events</h2>
                {eventStrings.length > 0 ? (
                    <div>
                        {eventStrings.map((eventString, index) => (
                            <p
                                key={index}
                                onClick={() => handleRemoveEvent(index)} // Add click handler
                                style={{ cursor: "pointer", color: "red" }} // Add styling to indicate interactivity
                                title="Click to remove this event"
                            >
                                {eventString}
                            </p>
                        ))}
                    </div>
                ) : (
                    <p>No events found for the selected cadet and year.</p>
                )}
            </div>

            {/* Show the "Download All Certificates" button if "All Cadets" is selected */}
            {selectedCadet === "all" && (
                <button onClick={handleDownloadAllCertificates}>
                    Download All Certificates as .zip Folder
                </button>
            )}

            {/* Button to generate PDF */}
            <button onClick={handleGeneratePDF}>Download PDF</button>
        </div>
    );
};

export default CertificateDashboard;