import React, { useEffect, useState, useContext } from "react";
import { examList } from "../../../utils/examList"; // Import the examList
import "./ExamPopup.css"; // Optional: Add styles for the popup
import { DataContext } from "../../../context/DataContext"; // Import DataContext
import { useSaveEvent } from "../../../databaseTools/databaseTools";

const ExamPopup = ({ isOpen, onClose, cadetName, classification, user }) => {
  const [exams, setExams] = useState([]); // State to store the list of exams
  const [loading, setLoading] = useState(true); // State to track loading status
  const { data } = useContext(DataContext); // Access data and addExam function from DataContext
  const [examSelections, setExamSelections] = useState([{ selectedExam: "", examDate: "" }]); // Array of exam selections
  const saveEvent = useSaveEvent(); // Access the saveEvent function from databaseTools

  useEffect(() => {
    const fetchExams = () => {
      if (!cadetName) return; // If no cadet is selected, skip fetching

      setLoading(true); // Start loading

      try {
        const fetchedExams = data.events
          .filter(
            (event) =>
              event.cadetName === cadetName && event.examName && event.examName.trim() !== ""
          )
          .map((event) => event.examName);

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

  useEffect(() => {
    if (!isOpen) {
      // Reset the form fields when the popup is closed
      setExamSelections([{ selectedExam: "", examDate: "" }]);
    }
  }, [isOpen]);

  const handleAddExam = () => {
    // Filter out empty selections (where both selectedExam and examDate are empty)
    const filteredSelections = examSelections.filter(
      (selection) => selection.selectedExam || selection.examDate
    );

    // Check if any selection has only one of the fields filled
    if (filteredSelections.some((selection) => 
      (selection.selectedExam && !selection.examDate) || 
      (!selection.selectedExam && selection.examDate)
    )) {
      alert("Please ensure each selection has both an exam and a date, or leave both fields empty.");
      return;
    }

    const createdAt = new Date();

    // Call the addExam function for each valid selection
    filteredSelections.forEach(({ selectedExam, examDate }) => {
      saveEvent({
        addedBy: user.displayName,
        createdAt: createdAt,
        cadetName: [cadetName],
        date: examDate,
        examName: selectedExam
      });

    });

    // Reset the form fields
    setExamSelections([{ selectedExam: "", examDate: "" }]);

    // Optionally, refetch exams to update the list
    setExams((prevExams) => [
      ...prevExams,
      ...filteredSelections.map((selection) => selection.selectedExam),
    ]);

    // Close the popup
    onClose();
  };

  const handleSelectionChange = (index, field, value) => {
    const updatedSelections = [...examSelections];
    updatedSelections[index][field] = value;
    setExamSelections(updatedSelections);

    // Add a new selection section if the last one is filled
    if (
      index === examSelections.length - 1 &&
      updatedSelections[index].selectedExam &&
      updatedSelections[index].examDate
    ) {
      setExamSelections([...updatedSelections, { selectedExam: "", examDate: "" }]);
    }
  };

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
              <span key={index} className="exam-item">{exam}</span>
            ))}
          </div>
        ) : (
          <p>No classification records found for this cadet.</p>
        )}

        {/* Add Exam Section */}
        <div className="add-exam-section">
          <h3>Add Exam</h3>
          {examSelections.map((selection, index) => {
            // Calculate available exams for this dropdown
            const availableExams = examList.filter(
              (exam) => !exams.includes(exam) && !examSelections.some((sel, selIndex) => selIndex !== index && sel.selectedExam === exam)
            );

            return (
              <div key={index} className="form-group-inline">
                <select
                  className="exam-select"
                  value={selection.selectedExam}
                  onChange={(e) =>
                    handleSelectionChange(index, "selectedExam", e.target.value)
                  }
                >
                  <option value="">-- Select an Exam --</option>
                  {availableExams.map((exam, idx) => (
                    <option key={idx} value={exam}>
                      {exam}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  className="exam-date"
                  value={selection.examDate}
                  onChange={(e) =>
                    handleSelectionChange(index, "examDate", e.target.value)
                  }
                />
              </div>
            );
          })}
          <div className="popup-bottom-buttons">
          <button className="popup-button-red" onClick={onClose}>
              Cancel
            </button>
            <button className="popup-button-green" onClick={handleAddExam}>
              {examSelections.filter(selection => selection.selectedExam && selection.examDate).length > 1
                ? "Add Exams"
                : "Add Exam"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamPopup;