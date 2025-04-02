import jsPDF from "jspdf";
import { getCadetRank } from "../../../firebase/firestoreUtils"; // Import getCadetRank

const generateCertificatePDF = async (cadetName, year, events) => {
    const doc = new jsPDF();

    // Fetch the cadet's rank
    const rank = await getCadetRank(cadetName);

    // Load the watermark image
    const logoUrl = `${process.env.PUBLIC_URL}/logo.png`; // Public folder path
    const logoImage = await fetch(logoUrl)
        .then((response) => response.blob())
        .then((blob) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        });

    // Create a canvas to adjust the opacity of the image
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.src = logoImage;

    await new Promise((resolve) => {
        img.onload = () => {
            // Set canvas dimensions to match the image
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw the image with reduced opacity
            ctx.globalAlpha = 0.2; // Set opacity to 20%
            ctx.drawImage(img, 0, 0);

            resolve();
        };
    });

    // Get the Base64 data URL of the modified image
    const transparentImage = canvas.toDataURL("image/png");

    // Add watermark image with increased scale
    const watermarkWidth = 275; // Increased width
    const watermarkHeight = watermarkWidth; // Increased height
    const watermarkX = (doc.internal.pageSize.getWidth() - watermarkWidth) / 2; // Center horizontally
    const watermarkY = (doc.internal.pageSize.getHeight() - watermarkHeight) / 2; // Center vertically

    doc.addImage(transparentImage, "PNG", watermarkX, watermarkY, watermarkWidth, watermarkHeight);

    // Add certificate title
    doc.setFontSize(36);
    doc.text("Certificate of Achievement", doc.internal.pageSize.getWidth() / 2, 45, { align: "center" });

    // Add squadron name
    doc.setFontSize(24);
    doc.text("1151 (Wallsend) Squadron ATC", doc.internal.pageSize.getWidth() / 2, 55, { align: "center" });

    // Add year
    doc.setFontSize(16);
    doc.text(`${year}`, doc.internal.pageSize.getWidth() / 2, 65, { align: "center" });

    // Add cadet's rank and name
    doc.setFontSize(26);
    doc.text(`${rank} ${cadetName}`, doc.internal.pageSize.getWidth() / 2, 78, { align: "center" });

    // Add events
    doc.setFontSize(12);
    if (events.length > 0) {
        const lineHeight = 5; // Line height for each event
        const startY = 100; // Starting Y position for events
        const pageHeight = doc.internal.pageSize.getHeight(); // Height of the page
        const marginBottom = 20; // Bottom margin to avoid overflow

        let currentY = startY;

        events.forEach((event, index) => {
            if (currentY + lineHeight > pageHeight - marginBottom) {
                // Add a new page if the current Y position exceeds the page height
                doc.addPage();
                currentY = 20; // Reset Y position for the new page
            }

            doc.text(
                `${event}`,
                doc.internal.pageSize.getWidth() / 2,
                currentY,
                { align: "center" }
            );

            currentY += lineHeight; // Move to the next line
        });
    } else {
        doc.text(
            "No events found for the selected cadet and year.",
            doc.internal.pageSize.getWidth() / 2,
            100,
            { align: "center" }
        );
    }

    // Return the PDF as a Blob
    return doc.output("blob");
};

export default generateCertificatePDF;