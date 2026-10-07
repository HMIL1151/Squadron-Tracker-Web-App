import React, { useState, useEffect } from "react";
import Modal from "../DashboardComponents/Modal";
import styles from "./MassEventLog.module.css";
import shared from "../DashboardComponents/dashboardStyles.module.css";
import { examList, badgeLevel } from "../../../utils/examList";
import { AVIATION, aviationToStore, guessAviation } from "../../../utils/aviation";

const AddEventPopup = ({
  isPopupOpen,
  inputValue,
  filteredNames,
  badgeTypes,
  eventCategories,
  specialAwards,
  highlightedIndex,
  selectedNames,
  handleInputChange,
  handleKeyDown,
  handleNameSelect,
  handleRemoveName,
  handleAddEvent,
  closePopup,
  eventDate,
  handleDateChange,
  onButtonSelect,
  /*
   * Optional, and only the Muster screen passes them. With extraDates
   * undefined the popup is exactly the classic one -- no "Add another date"
   * -- which the classic snapshot holds it to.
   */
  extraDates,
  onAddDate,
  onExtraDateChange,
  onRemoveDate,
  /*
   * Muster only, like extraDates: whether an Event/Other record offers to be
   * counted as a flight or glide on the PTS board. Left off, the classic
   * popup renders and saves exactly what it always has.
   */
  offerAviation = false,
}) => {
  const [selectedButton, setSelectedButton] = useState(null);
  const [freeText, setFreeText] = useState("");
  const [selectedBadgeType, setSelectedBadgeType] = useState("");
  const [selectedBadgeLevel, setSelectedBadgeLevel] = useState("");
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedEventCategory, setSelectedEventCategory] = useState("");
  const [selectedSpecialAward, setSelectedSpecialAward] = useState("");
  const [validationError, setValidationError] = useState("");
  /*
   * null until someone touches the select, and while it is null the select
   * follows the guess -- so typing "AEF" picks Flight without anyone asking,
   * and a choice once made is never overwritten by more typing.
   */
  const [aviationChoice, setAviationChoice] = useState(null);

  // Reset state when the popup is opened
  useEffect(() => {
    if (isPopupOpen) {
      setSelectedButton(null);
      setFreeText("");
      setSelectedBadgeType("");
      setSelectedBadgeLevel("");
      setSelectedExam("");
      setSelectedEventCategory("");
      setSelectedSpecialAward("");
      setValidationError("");
      setAviationChoice(null);
    }
  }, [isPopupOpen]);

  if (!isPopupOpen) return null;

  const handleButtonClick = (buttonText) => {
    setSelectedButton(buttonText);
    onButtonSelect(buttonText);
    // Reset all fields when switching buttons
    setFreeText("");
    setSelectedBadgeType("");
    setSelectedBadgeLevel("");
    setSelectedExam("");
    setSelectedEventCategory("");
    setSelectedSpecialAward("");
    setAviationChoice(null);
  };

  const guessedAviation = guessAviation({ eventName: freeText, eventCategory: selectedEventCategory });
  const aviation = aviationChoice ?? guessedAviation ?? "none";

  const onAddEventClick = () => {
    setValidationError("");

    // Validate the event date, and any extra ones
    const currentDate = new Date();

    const eightYearsAgo = new Date();
    eightYearsAgo.setFullYear(currentDate.getFullYear() - 8);

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(currentDate.getDate() + 7);

    const outOfRange = (value) => {
      const selectedDate = new Date(value);
      return selectedDate < eightYearsAgo || selectedDate > sevenDaysFromNow;
    };
    const extras = (extraDates || []).filter(Boolean);

    if (extras.length && (selectedButton === "Badge" || selectedButton === "Classification/Exam")) {
      setValidationError("A badge or exam is only passed once. Remove the extra dates.");
      return;
    }

    if (outOfRange(eventDate) || extras.some(outOfRange)) {
      setValidationError(
        "Invalid date: The selected date must be within the last 8 years and no more than 7 days in the future."
      );
      return; // Prevent the event from being added
    }

    // Capitalize the first letter of each word in the "Event Description" if "Event/Other" is selected
    let formattedFreeText = freeText;
    if (selectedButton === "Event/Other" && freeText) {
      const exceptions = ["DofE", "AEF", "RAF", "GIF", "RAFAC", "JL", "QAIC", "NCO", "JNCO", "SNCO", "MOI", "CWO", "WARMA"];
      
      formattedFreeText = freeText
        .toLowerCase()
        .split(" ")
        .map((word) => {
          if (word.toLowerCase() === "dofe") {
            return "DofE"; // Special case for "DofE"
          }
          if (exceptions.includes(word.toUpperCase())) {
            return word.toUpperCase(); // Convert other exceptions to uppercase
          }
          return word.length > 2
            ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            : word.toLowerCase();
        })
        .join(" ");
    }

    const eventData = {
      selectedBadgeType,
      selectedBadgeLevel,
      selectedExam,
      freeText: formattedFreeText, // Use the formatted text
      selectedEventCategory,
      selectedSpecialAward,
      ...(offerAviation && selectedButton === "Event/Other"
        ? {
            aviation: aviationToStore(aviation, {
              eventName: formattedFreeText,
              eventCategory: selectedEventCategory,
            }),
          }
        : {}),
    };

    handleAddEvent(eventData);
  };

  // The early return this component already had, above, is what keeps Modal's
  // children from being built while closed.
  return (
    <Modal
      isOpen={isPopupOpen}
      onClose={closePopup}
      title="Add New Event"
      size="md"
      onConfirm={onAddEventClick}
      confirmLabel="Add Event"
    >
        <div className={styles["flex-container"]}>
          <label className={styles["popup-label"]} htmlFor="autocomplete-input">
            Name(s):
          </label>
          <div className={styles["autocomplete-container"]}>
            <input
              id="autocomplete-input"
              type="text"
              className={styles["autocomplete-input"]}
              placeholder="Enter name(s)..."
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />
            {filteredNames.length > 0 && (
              <ul className={styles["autocomplete-suggestions"]}>
                {filteredNames.map((name, index) => (
                  <li
                    key={name}
                    className={index === highlightedIndex ? styles["highlighted"] : ""}
                    onClick={() => handleNameSelect(name)}
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className={styles["selected-names"]}>
          {selectedNames.map((name) => (
            <span key={name} className={styles["selected-name"]}>
              {name}
              <button
                className={styles["remove-name-button"]}
                onClick={() => handleRemoveName(name)}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
        <div className={styles["flex-container"]}>
          <label className={styles["popup-label"]} htmlFor="event-date">
            Date:
          </label>
          <input
            id="event-date"
            type="date"
            className={"date-input"}
            value={eventDate}
            onChange={handleDateChange}
          />
          {extraDates && (
            <button type="button" className={styles["add-date-button"]} onClick={onAddDate}>
              + Add another date
            </button>
          )}
        </div>
        {extraDates?.map((value, index) => (
          <div key={index} className={styles["flex-container"]}>
            <label className={styles["popup-label"]} htmlFor={`event-date-${index + 2}`}>
              Date {index + 2}:
            </label>
            <input
              id={`event-date-${index + 2}`}
              type="date"
              className={"date-input"}
              value={value}
              onChange={(e) => onExtraDateChange(index, e.target.value)}
            />
            <button
              type="button"
              className={styles["remove-date-button"]}
              aria-label={`Remove date ${index + 2}`}
              onClick={() => onRemoveDate(index)}
            >
              &times;
            </button>
          </div>
        ))}
        <div className={styles["button-grid"]}>
          {["Badge", "Classification/Exam", "Event/Other", "Special"].map((buttonText) => (
            <button
              key={buttonText}
              className={[styles["grid-button"], 
                selectedButton === buttonText ? styles["selected"] : ""
              ].filter(Boolean).join(" ")}
              onClick={() => handleButtonClick(buttonText)}
              dangerouslySetInnerHTML={{ __html: buttonText }}
            />
          ))}
        </div>
        <div className={styles["dynamic-fields"]}>
          {selectedButton === "Badge" && (
            <>
              <div className={styles["flex-container"]}>
                <label className={styles["popup-label"]} htmlFor="badge-type">
                  Badge Type:
                </label>
                <select
                  id="badge-type"
                  className={styles["dropdown"]}
                  value={selectedBadgeType}
                  onChange={(e) => setSelectedBadgeType(e.target.value)}
                >
                  <option value="" disabled>
                    Select Badge Type
                  </option>
                  {badgeTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles["flex-container"]}>
                <label className={styles["popup-label"]} htmlFor="badge-level">
                  Badge Level:
                </label>
                <select
                  id="badge-level"
                  className={styles["dropdown"]}
                  value={selectedBadgeLevel}
                  onChange={(e) => setSelectedBadgeLevel(e.target.value)}
                >
                  <option value="" disabled>
                    Select Badge Level
                  </option>
                  {badgeLevel.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          {selectedButton === "Classification/Exam" && (
            <div className={styles["flex-container"]}>
              <label className={styles["popup-label"]} htmlFor="exam">
                Exam:
              </label>
              <select
                id="exam"
                className={styles["dropdown"]}
                value={selectedExam}
                onChange={(e) => setSelectedExam(e.target.value)}
              >
                <option value="" disabled>
                  Select Exam
                </option>
                {examList.map((exam) => (
                  <option key={exam} value={exam}>
                    {exam}
                  </option>
                ))}
              </select>
            </div>
          )}
          {selectedButton === "Event/Other" && (
            <>
              <div className={styles["flex-container"]}>
                <label className={styles["popup-label"]} htmlFor="event-text">
                  Event Description:
                </label>
                <input
                  id="event-text"
                  type="text"
                  className={"text-input"}
                  placeholder="Enter event description..."
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                />
              </div>
              <div className={styles["flex-container"]}>
                <label className={styles["popup-label"]} htmlFor="event-category">
                  Event Category:
                </label>
                <select
                  id="event-category"
                  className={styles["dropdown"]}
                  value={selectedEventCategory}
                  onChange={(e) => setSelectedEventCategory(e.target.value)}
                >
                  <option value="" disabled>
                    Select Event Category
                  </option>
                  {eventCategories
                    .slice() // Create a shallow copy to avoid mutating the original array
                    .sort((a, b) => a.localeCompare(b)) // Sort alphabetically
                    .map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                </select>
              </div>
              {offerAviation && (
                <div className={styles["flex-container"]}>
                  <label className={styles["popup-label"]} htmlFor="event-aviation">
                    PTS board:
                  </label>
                  <select
                    id="event-aviation"
                    className={styles["dropdown"]}
                    value={aviation}
                    onChange={(e) => setAviationChoice(e.target.value)}
                  >
                    <option value="none">Not a flight or glide</option>
                    <option value="flying">Counts as a {AVIATION.flying.noun}</option>
                    <option value="gliding">Counts as a {AVIATION.gliding.noun}</option>
                  </select>
                </div>
              )}
            </>
          )}
          {selectedButton === "Special" && (
            <div className={styles["flex-container"]}>
              <label className={styles["popup-label"]} htmlFor="special-award">
                Special Award:
              </label>
              <select
                id="special-award"
                className={styles["dropdown"]}
                value={selectedSpecialAward}
                onChange={(e) => setSelectedSpecialAward(e.target.value)}
              >
                <option value="" disabled>
                  Select Special Award
                </option>
                {specialAwards.map((award) => (
                  <option key={award} value={award}>
                    {award}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {validationError && <p className={shared["popup-error"]}>{validationError}</p>}
    </Modal>
  );
};

export default AddEventPopup;