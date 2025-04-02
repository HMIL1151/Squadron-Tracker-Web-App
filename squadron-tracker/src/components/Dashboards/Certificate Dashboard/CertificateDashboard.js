import React, { useState, useEffect } from "react";
import { getAllCadetNames, getEventsForCadet } from "../../../firebase/firestoreUtils";
import generateCertificatePDF from "./CertificatePDF";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import "./CertificateDashboard.css";

const CertificateDashboard = () => {
    const [cadetNames, setCadetNames] = useState([]);
    const [selectedCadet, setSelectedCadet] = useState("");
    const [selectedYear, setSelectedYear] = useState("");
    const [years, setYears] = useState([]);
    const [eventStrings, setEventStrings] = useState([]);
    const [isGenerateClicked, setIsGenerateClicked] = useState(false);
    const [pdfBlobUrl, setPdfBlobUrl] = useState(null); // State to store the PDF Blob URL
    const [generatedPdfBlob, setGeneratedPdfBlob] = useState(null); // State to store the generated PDF Blob
    const [isLoading, setIsLoading] = useState(false); // State to track loading
    const [loadingMessage, setLoadingMessage] = useState(""); // State to store the loading message
    const [progress, setProgress] = useState(0); // State to track progress percentage

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
            setIsGenerateClicked(true);
        } catch (error) {
            console.error("Error fetching cadet events:", error);
        }
    };

    const formatDate = (dateString) => {
        const options = { day: "2-digit", month: "short", year: "numeric" };
        return new Date(dateString).toLocaleDateString("en-GB", options);
    };

    const handleGeneratePDF = async () => {
        if (!selectedCadet || !selectedYear) {
            alert("Please select both a cadet and a year.");
            return;
        }

        setIsLoading(true); // Show loading popup

        try {
            // Generate the PDF using the updated generateCertificatePDF function
            const pdfBlob = await generateCertificatePDF(selectedCadet, selectedYear, eventStrings);

            // Create a Blob URL for preview
            const blobUrl = URL.createObjectURL(pdfBlob);
            setPdfBlobUrl(blobUrl); // Set the Blob URL to state

            // Store the Blob for download
            setGeneratedPdfBlob(pdfBlob); // Store the Blob for later download
        } catch (error) {
            console.error("Error generating PDF:", error);
        } finally {
            setIsLoading(false); // Hide loading popup
        }
    };

    const handleDownloadPDF = () => {
        if (!generatedPdfBlob) {
            alert("No PDF available to download. Please generate the PDF first.");
            return;
        }

        // Trigger download of the generated PDF
        const link = document.createElement("a");
        link.href = URL.createObjectURL(generatedPdfBlob);
        link.download = `${selectedCadet}_Certificate_${selectedYear}.pdf`;
        link.click();
    };

    const handleRemoveEvent = (index) => {
        const updatedEvents = eventStrings.filter((_, i) => i !== index);
        setEventStrings(updatedEvents);
    };

    const handleDownloadAllCertificates = async () => {
        if (!selectedYear) {
            alert("Please select a year.");
            return;
        }

        const zip = new JSZip();
        setIsLoading(true); // Show loading popup
        setProgress(0); // Reset progress

        for (let i = 0; i < cadetNames.length; i++) {
            const cadet = cadetNames[i];
            setLoadingMessage(`Generating certificate for ${cadet}... (${i + 1}/${cadetNames.length})`);

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

                const pdfBlob = await generateCertificatePDF(cadet, selectedYear, formattedEvents, true);
                zip.file(`${cadet}_Certificate_${selectedYear}.pdf`, pdfBlob);
            } catch (error) {
                console.error(`Error generating certificate for ${cadet}:`, error);
            }

            // Update progress
            setProgress(Math.round(((i + 1) / cadetNames.length) * 100));
        }

        setLoadingMessage("Finalizing ZIP file...");
        zip.generateAsync({ type: "blob" }).then(content => {
            saveAs(content, `End of Year Certificates_${selectedYear}.zip`);
            setIsLoading(false); // Hide loading popup
            setLoadingMessage(""); // Clear loading message
            setProgress(0); // Reset progress
        });
    };

    const handleCadetChange = (value) => {
        setSelectedCadet(value);
        setIsGenerateClicked(false);
        setEventStrings([]);
        setPdfBlobUrl(null); // Clear the PDF preview
    };

    const handleYearChange = (value) => {
        setSelectedYear(value);
        setIsGenerateClicked(false);
        setEventStrings([]);
        setPdfBlobUrl(null); // Clear the PDF preview
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

            const containerRect = container.getBoundingClientRect();
            const mouseX = e.clientX - containerRect.left;

            const containerWidth = container.offsetWidth;
            const leftWidth = Math.min(Math.max((mouseX / containerWidth) * 100, 10), 90);

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
                        onChange={(e) => handleYearChange(e.target.value)}
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
                        <>
                            <button className="preview-button" onClick={handleGeneratePDF}>Preview PDF</button>
                            <button className="download-button" onClick={handleDownloadPDF}>Download PDF</button>
                        </>
                    )}
                </div>
            </div>
            <div className="divider" />
            <div className="right-panel" style={{ position: "relative" }}>
                {isLoading && (
                    <div className="loading-popup">
                        <p>{loadingMessage || "Loading..."}</p>
                        <div className="progress-bar-container">
                            <div
                                className="progress-bar"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                )}
                {!isLoading && pdfBlobUrl ? (
                    <div className="pdf-preview">
                        <h2>Certificate Preview</h2>
                        <iframe
                            src={pdfBlobUrl}
                            title="PDF Preview"
                            width="100%"
                            height="100%"
                            style={{ border: "none" }}
                        />
                    </div>
                ) : (
                    !isLoading && <p className="no-preview">No preview available</p>
                )}
            </div>
        </div>
    );
};

export default CertificateDashboard;