import { useContext, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { DataContext } from "../../../context/DataContext";
import { useSquadron } from "../../../context/SquadronContext";
import { getCareerPeriod, getCertificateLines } from "../../../utils/cadets";
import { getEventYear } from "../../../utils/points";
import generateCertificatePDF from "./CertificatePDF";
import MusterPage from "../../Muster/MusterPage";
import { MusterButton, MusterEmpty, MusterSelect } from "../../Muster/MusterControls";
import ErrorMessage from "../DashboardComponents/ErrorMessage";
import LoadingPopup from "../DashboardComponents/LoadingPopup";
import styles from "./MusterCertificates.module.css";

/**
 * Certificates, Muster.
 *
 * Same two certificate types and the same generator as the classic screen --
 * CertificatePDF.js is untouched, so what comes out of the printer is
 * identical. What changed is the shape of the task.
 *
 * The classic screen is a sequence: pick a cadet, press Generate, review the
 * lines, press Generate again to get a PDF, then press Download. Three buttons
 * that all say some form of "generate" and one that is the only way to find
 * out what will be on the certificate.
 *
 * Here it is one screen in three columns, left to right: what kind of
 * certificate, who it is for, and what it will say. The lines appear as soon
 * as a cadet is picked, because seeing them is the point of the review step,
 * and removing one is a single click rather than a round trip.
 */

const TYPES = {
    year: { label: "End of Year", title: "Certificate of Achievement" },
    career: { label: "End of Career", title: "Certificate of Service" },
};

const MusterCertificates = ({ user }) => {
    const { squadronNumber } = useSquadron();
    const { data } = useContext(DataContext);

    const [certificateType, setCertificateType] = useState("year");
    const [selectedCadet, setSelectedCadet] = useState("");
    const [selectedYear, setSelectedYear] = useState("");
    const [removed, setRemoved] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const squadronName = user.squadronName;
    const isCareer = certificateType === "career";
    const certificateYear = isCareer ? null : selectedYear;

    const cadetNames = useMemo(
        () => (data.cadets || []).map((cadet) => `${cadet.forename} ${cadet.surname}`),
        [data.cadets]
    );

    /*
     * The years that actually have records, newest first. The classic screen
     * offers the last ten calendar years whether or not the squadron existed
     * for them, so most of the dropdown produces an empty certificate.
     */
    const years = useMemo(() => {
        const seen = new Set();
        (data.events || []).forEach((event) => {
            const year = getEventYear(event);
            if (year) seen.add(year);
        });
        return [...seen].sort((a, b) => b.localeCompare(a));
    }, [data.events]);

    useEffect(() => {
        if (!selectedYear && years.length) setSelectedYear(years[0]);
    }, [years, selectedYear]);

    useEffect(() => {
        if (!selectedCadet && cadetNames.length) setSelectedCadet(cadetNames[0]);
    }, [cadetNames, selectedCadet]);

    /** Any change of selection invalidates which lines were struck out. */
    useEffect(() => {
        setRemoved([]);
    }, [selectedCadet, certificateType, selectedYear]);

    const allLines = useMemo(
        () => (selectedCadet ? getCertificateLines(selectedCadet, data, certificateYear) : []),
        [selectedCadet, data, certificateYear]
    );

    const lines = allLines.filter((_, index) => !removed.includes(index));

    const periodFor = (cadet) => (isCareer ? getCareerPeriod(cadet, data) : selectedYear);

    const handleDownloadOne = async () => {
        if (!selectedCadet || (!isCareer && !selectedYear)) {
            setErrorMessage(isCareer ? "Choose a cadet." : "Choose a cadet and a year.");
            return;
        }
        setErrorMessage("");
        setIsLoading(true);
        setLoadingMessage(`Preparing ${selectedCadet}'s certificate...`);

        try {
            const blob = await generateCertificatePDF(
                selectedCadet,
                periodFor(selectedCadet),
                lines,
                squadronNumber,
                data,
                squadronName,
                TYPES[certificateType].title
            );
            const suffix = isCareer ? "Career" : selectedYear;
            saveAs(blob, `${selectedCadet}_Certificate_${suffix}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            setErrorMessage("That certificate could not be produced. Try again.");
        } finally {
            setIsLoading(false);
            setLoadingMessage("");
        }
    };

    const handleDownloadAll = async () => {
        if (!isCareer && !selectedYear) {
            setErrorMessage("Choose a year.");
            return;
        }
        setErrorMessage("");

        const zip = new JSZip();
        setIsLoading(true);
        const suffix = isCareer ? "Career" : selectedYear;

        for (let i = 0; i < cadetNames.length; i += 1) {
            const cadet = cadetNames[i];
            setLoadingMessage(`Generating certificate for ${cadet}... (${i + 1}/${cadetNames.length})`);

            try {
                /*
                 * Every cadet gets their OWN lines, not the ones reviewed on
                 * screen -- those belong to whoever is selected. Struck-out
                 * lines apply to the single download only.
                 */
                const blob = await generateCertificatePDF(
                    cadet,
                    periodFor(cadet),
                    getCertificateLines(cadet, data, certificateYear),
                    squadronNumber,
                    data,
                    squadronName,
                    TYPES[certificateType].title
                );
                zip.file(`${cadet}_Certificate_${suffix}.pdf`, blob);
            } catch (error) {
                console.error(`Error generating certificate for ${cadet}:`, error);
            }
        }

        setLoadingMessage("Building the zip...");
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(
            content,
            isCareer ? "End of Career Certificates.zip" : `End of Year Certificates_${selectedYear}.zip`
        );
        setIsLoading(false);
        setLoadingMessage("");
    };

    return (
        <MusterPage
            title="Certificates"
            description="Pick a certificate, choose who it is for, then download one or the whole squadron."
        >
            {isLoading && <LoadingPopup message={loadingMessage} />}

            <div className={styles.columns}>
                <section className={styles.column} aria-label="Certificate type">
                    <h2 className={styles.heading}>Certificate</h2>
                    <div className={styles.choices}>
                        {Object.entries(TYPES).map(([key, type]) => (
                            <label
                                key={key}
                                className={certificateType === key ? styles["choice-on"] : styles.choice}
                            >
                                <input
                                    type="radio"
                                    name="certificate-type"
                                    value={key}
                                    checked={certificateType === key}
                                    onChange={() => setCertificateType(key)}
                                    className={styles.radio}
                                />
                                <span className={styles["choice-text"]}>
                                    <span className={styles["choice-name"]}>{type.label}</span>
                                    <span className={styles["choice-note"]}>
                                        {key === "year"
                                            ? "One training year, headed Certificate of Achievement."
                                            : "A cadet's whole service, headed Certificate of Service. No year needed."}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </div>

                    {!isCareer && (
                        <div className={styles.field}>
                            <MusterSelect
                                label="Training year"
                                value={selectedYear}
                                onChange={setSelectedYear}
                                options={years.map((year) => ({ value: year, label: year }))}
                            />
                        </div>
                    )}

                    <div className={styles.bulk}>
                        <MusterButton onClick={handleDownloadAll} disabled={isLoading}>
                            Download all {cadetNames.length} as a zip
                        </MusterButton>
                        <p className={styles.note}>
                            One PDF each. Nothing is written back to the squadron record.
                        </p>
                    </div>
                </section>

                <section className={styles.column} aria-label="Cadet">
                    <h2 className={styles.heading}>Cadet</h2>
                    <ul className={styles.cadets}>
                        {cadetNames.map((name) => (
                            <li key={name}>
                                <button
                                    type="button"
                                    className={name === selectedCadet ? styles["cadet-on"] : styles.cadet}
                                    onClick={() => setSelectedCadet(name)}
                                    aria-current={name === selectedCadet ? "true" : undefined}
                                >
                                    {name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className={styles.preview} aria-label="What the certificate will say">
                    <h2 className={styles.heading}>What it will say</h2>

                    {allLines.length === 0 ? (
                        <MusterEmpty title="Nothing to print">
                            {isCareer
                                ? `${selectedCadet || "This cadet"} has no records at all yet.`
                                : `${selectedCadet || "This cadet"} has no records in ${selectedYear}. Try another year, or an End of Career certificate.`}
                        </MusterEmpty>
                    ) : (
                        <>
                            <div className={styles.sheet}>
                                <p className={styles["sheet-squadron"]}>
                                    {squadronNumber} ({squadronName}) Squadron, Air Training Corps
                                </p>
                                <p className={styles["sheet-title"]}>{TYPES[certificateType].title}</p>
                                <p className={styles["sheet-name"]}>{selectedCadet}</p>
                                <p className={styles["sheet-period"]}>
                                    {isCareer ? getCareerPeriod(selectedCadet, data) : selectedYear}
                                </p>
                                <ul className={styles["sheet-lines"]}>
                                    {lines.map((line) => (
                                        <li key={line} className={styles["sheet-line"]}>
                                            {line}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className={styles.review}>
                                <h3 className={styles["review-title"]}>
                                    {lines.length} of {allLines.length} lines included
                                </h3>
                                <ul className={styles["review-list"]}>
                                    {allLines.map((line, index) => {
                                        const isRemoved = removed.includes(index);
                                        return (
                                            <li key={line} className={styles["review-row"]}>
                                                <label className={styles["review-label"]}>
                                                    <input
                                                        type="checkbox"
                                                        checked={!isRemoved}
                                                        onChange={() =>
                                                            setRemoved((current) =>
                                                                isRemoved
                                                                    ? current.filter((i) => i !== index)
                                                                    : [...current, index]
                                                            )
                                                        }
                                                        className={styles.checkbox}
                                                    />
                                                    <span className={isRemoved ? styles["review-off"] : undefined}>
                                                        {line}
                                                    </span>
                                                </label>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>

                            <div className={styles.actions}>
                                <MusterButton kind="primary" onClick={handleDownloadOne} disabled={isLoading}>
                                    Download {selectedCadet}&rsquo;s certificate
                                </MusterButton>
                            </div>
                        </>
                    )}
                </section>
            </div>

            <ErrorMessage message={errorMessage} />
        </MusterPage>
    );
};

export default MusterCertificates;
