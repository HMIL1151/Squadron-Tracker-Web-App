import React, { useEffect, useState } from "react";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore/lite";
import { examList } from "../../../utils/examList"; // Import the examList
import "./ExamPopup.css"; // Optional: Add styles for the popup
import { useSquadron } from "../../../context/SquadronContext";


const ExamPopup = ({ isOpen, onClose, cadetName, classification }) => {
  const [exams, setExams] = useState([]); // State to store the list of exams
  const [loading, setLoading] = useState(true); // State to track loading status
  const { squadronNumber } = useSquadron(); // Access the squadron number from context

  useEffect(() => {
    const fetchExams = async () => {
      if (!cadetName) return; // If no cadet is selected, skip fetching

      setLoading(true); // Start loading
      const db = getFirestore();

      try {
        // Query the "Event Log" collection for documents matching the cadetName
        const eventLogRef = collection(db, "Squadron Databases", squadronNumber.toString(), "Event Log");
        const q = query(eventLogRef, where("cadetName", "==", cadetName));
        const querySnapshot = await getDocs(q);

        // Filter out documents with an empty examName
        const fetchedExams = querySnapshot.docs
          .map((doc) => doc.data().examName)
          .filter((examName) => examName && examName.trim() !== ""); // Ensure examName is not blank

        // Sort the exams based on the order in examList
        const sortedExams = fetchedExams.sort(
          (a, b) => examList.indexOf(a) - examList.indexOf(b)
        );

        setExams(sortedExams);
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
  }, [isOpen, cadetName, squadronNumber]);

  // Close the popup when clicking outside of it
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (isOpen && event.target.classList.contains("popup-overlay")) {
        onClose();
      }
    };

    const handleEscKey = (event) => {
      if (isOpen && event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("click", handleOutsideClick);
      document.addEventListener("keydown", handleEscKey);
    }

    return () => {
      document.removeEventListener("click", handleOutsideClick);
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isOpen, onClose]);

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
        <h3>Classification Records:</h3>
        {loading ? (
          <p>Loading exams...</p>
        ) : exams.length > 0 ? (
          <div>
            {exams.map((exam, index) => (
              <span key={index} className="exam-item">{exam}</span> // Add a class for styling
            ))}
          </div>
        ) : (
          <p>No classification records found for this cadet.</p>
        )}
      </div>
    </div>
  );
};

export default ExamPopup;