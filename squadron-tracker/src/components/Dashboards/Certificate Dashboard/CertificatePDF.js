// filepath: c:\Users\harrison.milburn\Squadron-Tracker-Web-App\squadron-tracker\src\components\Dashboards\Certificate Dashboard\CertificatePDF.js
import jsPDF from "jspdf";

const generateCertificatePDF = (cadetName, year, events) => {
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(16);
    doc.text(`Certificate of Events for ${cadetName}`, 10, 10);
    doc.setFontSize(12);
    doc.text(`Year: ${year}`, 10, 20);

    // Add events
    doc.setFontSize(10);
    if (events.length > 0) {
        events.forEach((event, index) => {
            doc.text(`${index + 1}. ${event}`, 10, 30 + index * 10);
        });
    } else {
        doc.text("No events found for the selected cadet and year.", 10, 30);
    }

    // Save the PDF
    doc.save(`${cadetName}_Certificate_${year}.pdf`);
};

export default generateCertificatePDF;