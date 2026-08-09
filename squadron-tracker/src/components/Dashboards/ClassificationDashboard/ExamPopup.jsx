import React, { useEffect, useState, useContext } from "react";
import { examList } from "../../../utils/examList"; // Import the examList
import Modal from "../DashboardComponents/Modal";
import styles from "./ExamPopup.module.css";
import shared from "../DashboardComponents/dashboardStyles.module.css"; // Optional: Add styles for the popup
import { DataContext } from "../../../context/DataContext"; // Import DataContext
import { useSaveEvent } from "../../../databaseTools/databaseTools";

const ExamPopup = ({ isOpen, onClose, cadetName, classification, user }) => {
  const [exams, setExams] = useState([]); // State to store the list of exams
  const [loading, setLoading] = useState(true); // State to track loading status
  const { data } = useContext(DataContext); // Access data and addExam function from DataContext
  const [examSelections, setExamSelections] = useState([{ selectedExam: "", examDate: "" }]); // Array of exam selections
  const [validationError, setValidationError] = useState("");
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
    setValidationError("");

    // Filter out empty selections (where both selectedExam and examDate are empty)
    const filteredSelections = examSelections.filter(
      (selection) => selection.selectedExam || selection.examDate
    );

    // Check if any selection has only one of the fields filled
    if (filteredSelections.some((selection) => 
      (selection.selectedExam && !selection.examDate) || 
      (!selection.selectedExam && selection.examDate)
    )) {
      setValidationError("Please ensure each selection has both an exam and a date, or leave both fields empty.");
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
  /*
   * Still an early return, even though Modal takes isOpen: JSX children are
   * built before Modal can decide not to show them.
   */
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add Exam${cadetName ? ` -- ${cadetName}` : ""}`}
      size="lg"
      variant={styles["exam-popup"]}
      onConfirm={handleAddExam}
      confirmLabel={
        examSelections.filter((s) => s.selectedExam && s.examDate).length > 1
          ? "Add Exams"
          : "Add Exam"
      }
      /*
       * What the cadet already has goes in the pane, beside the form rather
       * than above it. This dialog is the reason Modal has a pane at all: you
       * are choosing which exams to add while needing to see which are already
       * recorded, and stacking them meant scrolling away from one to use the
       * other.
       */
      pane={
        <>
          <h3>Classification Records</h3>
          <p><strong>Classification:</strong> {classification}</p>
          {loading ? (
            <p>Loading exams...</p>
          ) : exams.length > 0 ? (
            <div>
              {exams.map((exam, index) => (
                <span key={index} className={styles["exam-item"]}>{exam}</span>
              ))}
            </div>
          ) : (
            <p>No classification records found for this cadet.</p>
          )}
        </>
      }
    >
        <div className={styles["add-exam-section"]}>
          {examSelections.map((selection, index) => {
            // Calculate available exams for this dropdown
            const availableExams = examList.filter(
              (exam) => !exams.includes(exam) && !examSelections.some((sel, selIndex) => selIndex !== index && sel.selectedExam === exam)
            );

            return (
              <div key={index} className={styles["form-group-inline"]}>
                <select
                  className={styles["exam-select"]}
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
                  className={styles["exam-date"]}
                  value={selection.examDate}
                  onChange={(e) =>
                    handleSelectionChange(index, "examDate", e.target.value)
                  }
                />
              </div>
            );
          })}
          {validationError && <p className={shared["popup-error"]}>{validationError}</p>}
        </div>
    </Modal>
  );
};

export default ExamPopup;