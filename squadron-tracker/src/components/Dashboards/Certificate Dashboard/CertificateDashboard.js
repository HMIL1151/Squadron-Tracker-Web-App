import React, { useState, useEffect } from "react";
import { getAllCadetNames, getEventsForCadet } from "../../../firebase/firestoreUtils";
import generateCertificatePDF from "./CertificatePDF";
import JSZip from "jszip"; // Import JSZip
import { saveAs } from "file-saver"; // Import FileSaver
import "./CertificateDashboard.css"; // Import the new CSS file

const CertificateDashboard = () => {
    const [cadetNames, setCadetNames] = useState([]);
    const [selectedCadet, setSelectedCadet] = useState("");
    const [selectedYear, setSelectedYear] = useState("");
    const [years, setYears] = useState([]);
    const [eventStrings, setEventStrings] = useState([]);
    const [isGenerateClicked, setIsGenerateClicked] = useState(false); // Track if Generate button is clicked

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
            setIsGenerateClicked(true); // Mark Generate button as clicked
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

    const handleCadetChange = (value) => {
        setSelectedCadet(value);
        setIsGenerateClicked(false); // Reset the generate state
        setEventStrings([]); // Clear the events list
    };

    const handleYearChange = (value) => {
        setSelectedYear(value);
        setIsGenerateClicked(false); // Reset the generate state
        setEventStrings([]); // Clear the events list
    };

    return (
        <div className="certificate-dashboard">
            {/* Cadet and Year Dropdowns */}
            <label htmlFor="cadet-select">Select Cadet:</label>
            <select
                id="cadet-select"
                value={selectedCadet}
                onChange={(e) => handleCadetChange(e.target.value)}
            >
                <option value="">-- Select a Cadet --</option>
                <option value="all">All Cadets</option>
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
                onChange={(e) => handleYearChange(e.target.value)} // Use the new handler
            >
                <option value="">-- Select a Year --</option>
                {years.map((year, index) => (
                    <option key={index} value={year}>
                        {year}
                    </option>
                ))}
            </select>

            {/* Generate Button */}
            {selectedCadet && selectedCadet !== "all" && selectedYear && (
                <button className="generate-button" onClick={fetchCadetEvents}>
                    Generate
                </button>
            )}

            {/* Events Section (only visible after Generate is clicked and not for "All Cadets") */}
            {isGenerateClicked && selectedCadet !== "all" && (
                <div className="events-section">
                    <h2>Events</h2>
                    {eventStrings.length > 0 ? (
                        <div>
                            {eventStrings.map((eventString, index) => (
                                <p
                                    key={index}
                                    onClick={() => handleRemoveEvent(index)}
                                    title="Click to remove this event"
                                >
                                    {eventString}
                                </p>
                            ))}
                        </div>
                    ) : (
                        <p className="no-events">No events found for the selected cadet and year.</p>
                    )}
                </div>
            )}

            {/* Download All Certificates Button */}
            {selectedCadet === "all" && selectedYear && (
                <button className="download-button" onClick={handleDownloadAllCertificates}>
                    Download All Certificates as .zip Folder
                </button>
            )}

            {/* Download PDF Button (only visible when not "All Cadets" and events list is not empty) */}
            {isGenerateClicked && selectedCadet !== "all" && eventStrings.length > 0 && (
                <button className="download-button" onClick={handleGeneratePDF}>Download PDF</button>
            )}
        </div>
    );
};

export default CertificateDashboard;