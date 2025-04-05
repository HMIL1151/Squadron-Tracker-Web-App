import React, { useEffect, useState, useContext } from "react";
import { examList } from "../../../utils/examList"; // Import the examList
import "./ExamPopup.css"; // Optional: Add styles for the popup
import { DataContext } from "../../../context/DataContext"; // Import DataContext

const ExamPopup = ({ isOpen, onClose, cadetName, classification }) => {
  const [exams, setExams] = useState([]); // State to store the list of exams
  const [loading, setLoading] = useState(true); // State to track loading status
  const { data } = useContext(DataContext); // Access data from DataContext

  useEffect(() => {
    const fetchExams = () => {
      if (!cadetName) return; // If no cadet is selected, skip fetching

      setLoading(true); // Start loading

      try {
        // Filter the events from DataContext for the selected cadet
        const fetchedExams = data.events
          .filter(
            (event) =>
              event.cadetName === cadetName && event.examName && event.examName.trim() !== ""
          )
          .map((event) => event.examName);

        // Sort the exams based on the order in examList
        const sortedExams = fetchedExams.sort(
          (a, b) => examList.indexOf(a) - examList.indexOf(b)
        );

        setExams(sortedExams);
      } catch (error) {
        console.error("Error processing exams from DataContext:", error);
        setExams([]); // Reset exams on error
      } finally {
        setLoading(false); // Stop loading
      }
    };

    if (isOpen) {
      fetchExams();
    }
  }, [isOpen, cadetName, data.events]);

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