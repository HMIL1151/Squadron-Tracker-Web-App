import React, { useEffect, useState } from "react";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore/lite";
import "./ExamPopup.css"; // Optional: Add styles for the popup

const ExamPopup = ({ isOpen, onClose, cadetName, classification }) => {
  const [exams, setExams] = useState([]); // State to store the list of exams
  const [loading, setLoading] = useState(true); // State to track loading status

  useEffect(() => {
    const fetchExams = async () => {
      if (!cadetName) return; // If no cadet is selected, skip fetching

      setLoading(true); // Start loading
      const db = getFirestore();

      try {
        // Query the "Event Log" collection for documents matching the cadetName
        const eventLogRef = collection(db, "Event Log");
        const q = query(eventLogRef, where("cadetName", "==", cadetName));
        const querySnapshot = await getDocs(q);

        // Filter out documents with an empty examName
        const fetchedExams = querySnapshot.docs
          .map((doc) => doc.data().examName)
          .filter((examName) => examName && examName.trim() !== ""); // Ensure examName is not blank
        setExams(fetchedExams);
      } catch (error) {
        console.error("Error fetching exams:", error);
        setExams([]); // Reset exams on error
      } finally {
        setLoading(false); // Stop loading
      }
    };

    if (isOpen) {
      fetchExams();
    }
  }, [isOpen, cadetName]);

  if (!isOpen) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close" onClick={onClose}>
          &times;
        </button>
        <h2>Cadet Details</h2>
        <p><strong>Name:</strong> {cadetName}</p>
        <p><strong>Classification:</strong> {classification}</p>
        <h3>Classification Records</h3>
        {loading ? (
          <p>Loading exams...</p>
        ) : exams.length > 0 ? (
          <div>
            {exams.map((exam, index) => (
              <p key={index}>{exam}</p> // Display each exam as a plain paragraph
            ))}
          </div>
        ) : (
          <p>No exams found for this cadet.</p>
        )}
      </div>
    </div>
  );
};

export default ExamPopup;