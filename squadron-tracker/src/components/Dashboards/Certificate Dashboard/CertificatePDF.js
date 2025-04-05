import jsPDF from "jspdf";
import { getCadetRank } from "../../../firebase/firestoreUtils"; // Import getCadetRank


const generateCertificatePDF = async (cadetName, year, events, squadronNumber, data, squadronName) => {
    const doc = new jsPDF();

    // Fetch the cadet's rank
    const rank = await getCadetRank(cadetName, data);

    // Fetch the squadron name from Firestore
    // Load the watermark image
    const logoUrl = `${process.env.PUBLIC_URL}/${squadronNumber}.png?timestamp=${new Date().getTime()}`; // Add a timestamp to bypass cache
    let logoImage;

    try {
        // Attempt to fetch the squadron-specific logo
        logoImage = await fetch(logoUrl)
            .then((response) => {
                const contentType = response.headers.get("Content-Type");
                if (!response.ok || !contentType || !contentType.startsWith("image/")) {
                    throw new Error("Squadron logo not found or invalid content type");
                }
                return response.blob();
            })
            .then((blob) => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        resolve(reader.result);
                    };
                    reader.readAsDataURL(blob);
                });
            });
    } catch (error) {
        console.warn("Squadron logo not found or invalid, defaulting to RAFAC logo:", error);

        // Default to RAFAC.png if the squadron logo is not found or invalid
        const defaultLogoUrl = `${process.env.PUBLIC_URL}/RAFAC.png?timestamp=${new Date().getTime()}`; // Add a timestamp to bypass cache
        logoImage = await fetch(defaultLogoUrl)
            .then((response) => {
                const contentType = response.headers.get("Content-Type");
                if (!response.ok || !contentType || !contentType.startsWith("image/")) {
                    throw new Error("Default RAFAC logo not found or invalid content type");
                }
                return response.blob();
            })
            .then((blob) => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        resolve(reader.result);
                    };
                    reader.readAsDataURL(blob);
                });
            })
            .catch((error) => {
                console.error("Error fetching default RAFAC logo:", error);
                throw error; // Re-throw the error to handle it further up the chain if needed
            });
    }

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
    doc.text(
        `${squadronNumber} (${squadronName}) Squadron ATC`,
        doc.internal.pageSize.getWidth() / 2,
        55,
        { align: "center" }
    );

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