import React, { useState, useEffect, useRef, useContext } from "react";
import { getCareerPeriod, getCertificateLines } from "../../../utils/cadets";
import generateCertificatePDF from "./CertificatePDF";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import styles from "./CertificateDashboard.module.css";
import shared from "../DashboardComponents/dashboardStyles.module.css";
import { useSquadron } from "../../../context/SquadronContext";
import { DataContext } from "../../../context/DataContext"; // Import DataContext

/*
 * Two certificates, one form.
 *
 * End of Year and End of Career differ only in which slice of a cadet's record
 * they print: one year, or all of it. Everything else -- picking a cadet,
 * reviewing and pruning the lines, the preview iframe, the bulk zip -- is
 * identical, so a second dashboard would have been this file duplicated with
 * one filter removed. The type is a dropdown; `selectedYear` is simply unused
 * (and hidden) when the type is "career".
 */
const TYPES = {
    year: { label: "End of Year", title: "Certificate of Achievement" },
    career: { label: "End of Career", title: "Certificate of Service" },
};

const CertificateDashboard = ({user}) => {
    const [cadetNames, setCadetNames] = useState([]);
    const [certificateType, setCertificateType] = useState("year");
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
    const [errorMessage, setErrorMessage] = useState("");
    const { squadronNumber } = useSquadron(); // Access the squadron number from context
    const { data } = useContext(DataContext); // Access data from DataContext

    const squadronName = user.squadronName; // Get the squadron name from the user object

    const isCareer = certificateType === "career";

    /** Everything downstream is keyed on this: null year means "whole career". */
    const certificateYear = isCareer ? null : selectedYear;

    /** What prints under the squadron name, and what names the file. */
    const periodFor = (cadet) =>
        isCareer ? getCareerPeriod(cadet, data) : selectedYear;

    /** The form is complete once a cadet is chosen, and a year if one applies. */
    const hasSelection = Boolean(selectedCadet) && (isCareer || Boolean(selectedYear));
    const missingSelectionMessage = isCareer
        ? "Please select a cadet."
        : "Please select both a cadet and a year.";

    useEffect(() => {
        // Fetch cadet names from DataContext
        const fetchCadetNames = () => {
            try {
                const names = data.cadets.map((cadet) => `${cadet.forename} ${cadet.surname}`);
                setCadetNames(names);
            } catch (error) {
                console.error("Error fetching cadet names:", error);
            }
        };

        fetchCadetNames();

        const currentYear = new Date().getFullYear();
        const yearList = Array.from({ length: 10 }, (_, i) => currentYear - i);
        setYears(yearList);
    }, [data]);

    const fetchCadetEvents = async () => {
        if (!hasSelection) {
            setErrorMessage(missingSelectionMessage);
            return;
        }
        setErrorMessage("");

        try {
            setEventStrings(getCertificateLines(selectedCadet, data, certificateYear));
            setIsGenerateClicked(true);
        } catch (error) {
            console.error("Error fetching cadet events:", error);
        }
    };

    const handleGeneratePDF = async () => {
        if (!hasSelection) {
            setErrorMessage(missingSelectionMessage);
            return;
        }
        setErrorMessage("");

        setIsLoading(true); // Show loading popup

        try {
            // Generate the PDF using the updated generateCertificatePDF function
            const pdfBlob = await generateCertificatePDF(
                selectedCadet,
                periodFor(selectedCadet),
                eventStrings,
                squadronNumber,
                data,
                squadronName,
                TYPES[certificateType].title
            );

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
            setErrorMessage("No PDF available to download. Please generate the PDF first.");
            return;
        }
        setErrorMessage("");

        // Trigger download of the generated PDF
        const link = document.createElement("a");
        link.href = URL.createObjectURL(generatedPdfBlob);
        link.download = `${selectedCadet}_Certificate_${isCareer ? "Career" : selectedYear}.pdf`;
        link.click();
    };

    const handleRemoveEvent = (index) => {
        const updatedEvents = eventStrings.filter((_, i) => i !== index);
        setEventStrings(updatedEvents);
    };

    const handleDownloadAllCertificates = async () => {
        if (!isCareer && !selectedYear) {
            setErrorMessage("Please select a year.");
            return;
        }
        setErrorMessage("");

        const zip = new JSZip();
        setIsLoading(true); // Show loading popup
        setProgress(0); // Reset progress

        const suffix = isCareer ? "Career" : selectedYear;

        for (let i = 0; i < cadetNames.length; i++) {
            const cadet = cadetNames[i];
            setLoadingMessage(`Generating certificate for ${cadet}... (${i + 1}/${cadetNames.length})`);

            try {
                /*
                 * Same arguments as the single preview above. This call used to
                 * pass `true` in the `data` slot and nothing at all for the
                 * squadron name, so every certificate in the zip was headed
                 * "Cadet Not Found" over "9999 (undefined) Squadron ATC".
                 */
                const pdfBlob = await generateCertificatePDF(
                    cadet,
                    periodFor(cadet),
                    getCertificateLines(cadet, data, certificateYear),
                    squadronNumber,
                    data,
                    squadronName,
                    TYPES[certificateType].title
                );
                zip.file(`${cadet}_Certificate_${suffix}.pdf`, pdfBlob);
            } catch (error) {
                console.error(`Error generating certificate for ${cadet}:`, error);
            }

            // Update progress
            setProgress(Math.round(((i + 1) / cadetNames.length) * 100));
        }

        setLoadingMessage("Finalizing ZIP file...");
        zip.generateAsync({ type: "blob" }).then((content) => {
            const zipName = isCareer
                ? "End of Career Certificates.zip"
                : `End of Year Certificates_${selectedYear}.zip`;
            saveAs(content, zipName);
            setIsLoading(false); // Hide loading popup
            setLoadingMessage(""); // Clear loading message
            setProgress(0); // Reset progress
        });
    };

    /** Any change to the selection invalidates the reviewed lines and the preview. */
    const clearGenerated = () => {
        setIsGenerateClicked(false);
        setEventStrings([]);
        setPdfBlobUrl(null); // Clear the PDF preview
        setGeneratedPdfBlob(null);
    };

    const handleCadetChange = (value) => {
        setSelectedCadet(value);
        clearGenerated();
    };

    const containerRef = useRef(null);
    const leftPanelRef = useRef(null);
    const rightPanelRef = useRef(null);
    const dividerRef = useRef(null);

    const handleYearChange = (value) => {
        setSelectedYear(value);
        clearGenerated();
    };

    const handleTypeChange = (value) => {
        setCertificateType(value);
        setErrorMessage("");
        clearGenerated();
    };

    /*
     * Refs, not document.querySelector(".divider").
     *
     * Those four lookups were hardcoded class-name selectors, which stopped
     * matching the moment this stylesheet became a module and the rendered
     * names became hashes -- divider was null, addEventListener threw, and the
     * whole dashboard rendered blank. Nothing in the suite caught it, because
     * jsdom never runs the drag. Refs point at the elements directly and cannot
     * drift from what is rendered.
     */
    useEffect(() => {
        const divider = dividerRef.current;
        const container = containerRef.current;
        const leftPanel = leftPanelRef.current;
        const rightPanel = rightPanelRef.current;
        if (!divider || !container || !leftPanel || !rightPanel) return undefined;

        let isDragging = false;

        const handleMouseDown = () => {
            isDragging = true;
            divider.classList.add(styles["dragging"]);
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
            divider.classList.remove(styles["dragging"]);
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
        <div className={styles["certificate-dashboard-container"]} ref={containerRef}>
            <div className={styles["left-panel"]} ref={leftPanelRef}>
                <div className={styles["certificate-dashboard"]}>
                    {errorMessage && <p className={shared["popup-error"]}>{errorMessage}</p>}
                    <label htmlFor="type-select">Certificate Type:</label>
                    <select
                        id="type-select"
                        value={certificateType}
                        onChange={(e) => handleTypeChange(e.target.value)}
                    >
                        {Object.entries(TYPES).map(([value, { label }]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>

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

                    {!isCareer && (
                        <>
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
                        </>
                    )}

                    {isCareer && selectedCadet && selectedCadet !== "all" && (
                        <p className={styles["career-period"]}>
                            Covering {periodFor(selectedCadet)} -- every record held for this cadet.
                        </p>
                    )}

                    {selectedCadet !== "all" && hasSelection && (
                        <button className={styles["generate-button"]} onClick={fetchCadetEvents}>
                            Generate
                        </button>
                    )}

                    {isGenerateClicked && selectedCadet !== "all" && (
                        <div className={styles["events-section"]}>
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
                                <p className={styles["no-events"]}>
                                    {isCareer
                                        ? "No events found for the selected cadet."
                                        : "No events found for the selected cadet and year."}
                                </p>
                            )}
                        </div>
                    )}

                    {selectedCadet === "all" && (isCareer || selectedYear) && (
                        <button className={styles["download-button"]} onClick={handleDownloadAllCertificates}>
                            Download All Certificates as .zip Folder
                        </button>
                    )}

                    {isGenerateClicked && selectedCadet !== "all" && eventStrings.length > 0 && (
                        <>
                            <button className={"preview-button"} onClick={handleGeneratePDF}>Preview PDF</button>
                            <button className={styles["download-button"]} onClick={handleDownloadPDF}>Download PDF</button>
                        </>
                    )}
                </div>
            </div>
            <div className={styles["divider"]} ref={dividerRef} />
            <div className={styles["right-panel"]} ref={rightPanelRef} style={{ position: "relative" }}>
                {isLoading && (
                    <div className={styles["loading-popup"]}>
                        <p>{loadingMessage || "Loading..."}</p>
                        <div className={styles["progress-bar-container"]}>
                            <div
                                className={styles["progress-bar"]}
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                )}
                {!isLoading && pdfBlobUrl ? (
                    <div className={styles["pdf-preview"]}>
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
                    !isLoading && <p className={styles["no-preview"]}>No preview available</p>
                )}
            </div>
        </div>
    );
};

export default CertificateDashboard;