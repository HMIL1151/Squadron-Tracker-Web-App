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

    useEffect(() => {
        const divider = document.querySelector(".divider");
        const container = document.querySelector(".certificate-dashboard-container");
        const leftPanel = document.querySelector(".left-panel");
        const rightPanel = document.querySelector(".right-panel");

        let isDragging = false;

        const handleMouseDown = (e) => {
            isDragging = true;
            divider.classList.add("dragging");
        };

        const handleMouseMove = (e) => {
            if (!isDragging) return;

            // Calculate the mouse position relative to the container
            const containerRect = container.getBoundingClientRect();
            const mouseX = e.clientX - containerRect.left;

            // Calculate the new widths for the panels
            const containerWidth = container.offsetWidth;
            const leftWidth = Math.min(Math.max((mouseX / containerWidth) * 100, 10), 90); // Restrict to 10%-90%

            leftPanel.style.width = `${leftWidth}%`;
            rightPanel.style.width = `${100 - leftWidth}%`;
        };

        const handleMouseUp = () => {
            isDragging = false;
            divider.classList.remove("dragging");
        };

        divider.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            divider.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    return (
        <div className="certificate-dashboard-container">
            <div className="left-panel">
                <div className="certificate-dashboard">
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

                    {selectedCadet && selectedCadet !== "all" && selectedYear && (
                        <button className="generate-button" onClick={fetchCadetEvents}>
                            Generate
                        </button>
                    )}

                    {isGenerateClicked && selectedCadet !== "all" && (
                        <div className="events-section">
                            <h2>Review Certificate Lines</h2>
                            {eventStrings.length > 0 ? (
                                <div>
                                    {eventStrings.map((eventString, index) => (
                                        <p
                                            key={index}
                                            onClick={() => handleRemoveEvent(index)}
                                            title="Click to remove from Certificate"
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

                    {selectedCadet === "all" && selectedYear && (
                        <button className="download-button" onClick={handleDownloadAllCertificates}>
                            Download All Certificates as .zip Folder
                        </button>
                    )}

                    {isGenerateClicked && selectedCadet !== "all" && eventStrings.length > 0 && (
                        <button className="download-button" onClick={handleGeneratePDF}>Download PDF</button>
                    )}
                </div>
            </div>
            <div className="divider" />
            <div className="right-panel">
                {/* Right panel is intentionally left blank for now */}
            </div>
        </div>
    );
};

export default CertificateDashboard;