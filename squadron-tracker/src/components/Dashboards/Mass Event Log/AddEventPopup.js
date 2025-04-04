import React, { useState, useEffect } from "react";
import "./MassEventLog.css";
import "../Dashboard Components/dashboardStyles.css";
import { examList, badgeLevel } from "../../../utils/examList";

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
}) => {
  const [selectedButton, setSelectedButton] = useState(null);
  const [freeText, setFreeText] = useState("");
  const [selectedBadgeType, setSelectedBadgeType] = useState("");
  const [selectedBadgeLevel, setSelectedBadgeLevel] = useState("");
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedEventCategory, setSelectedEventCategory] = useState("");
  const [selectedSpecialAward, setSelectedSpecialAward] = useState("");

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
  };

  const onAddEventClick = () => {
    const eventData = {
      selectedBadgeType,
      selectedBadgeLevel,
      selectedExam,
      freeText,
      selectedEventCategory,
      selectedSpecialAward,
    };

    handleAddEvent(eventData);
  };

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <h3>Add New Event</h3>
        <div className="flex-container">
          <label className="popup-label" htmlFor="autocomplete-input">
            Name(s):
          </label>
          <div className="autocomplete-container">
            <input
              id="autocomplete-input"
              type="text"
              className="autocomplete-input"
              placeholder="Enter name(s)..."
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />
            {filteredNames.length > 0 && (
              <ul className="autocomplete-suggestions">
                {filteredNames.map((name, index) => (
                  <li
                    key={name}
                    className={index === highlightedIndex ? "highlighted" : ""}
                    onClick={() => handleNameSelect(name)}
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="selected-names">
          {selectedNames.map((name) => (
            <span key={name} className="selected-name">
              {name}
              <button
                className="remove-name-button"
                onClick={() => handleRemoveName(name)}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
        <div className="flex-container">
          <label className="popup-label" htmlFor="event-date">
            Date:
          </label>
          <input
            id="event-date"
            type="date"
            className="date-input"
            value={eventDate}
            onChange={handleDateChange}
          />
        </div>
        <div className="button-grid">
          {["Badge", "Classification/Exam", "Event/Other", "Special"].map((buttonText) => (
            <button
              key={buttonText}
              className={`grid-button ${
                selectedButton === buttonText ? "selected" : ""
              }`}
              onClick={() => handleButtonClick(buttonText)}
              dangerouslySetInnerHTML={{ __html: buttonText }}
            />
          ))}
        </div>
        <div className="dynamic-fields">
          {selectedButton === "Badge" && (
            <>
              <div className="flex-container">
                <label className="popup-label" htmlFor="badge-type">
                  Badge Type:
                </label>
                <select
                  id="badge-type"
                  className="dropdown"
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
              <div className="flex-container">
                <label className="popup-label" htmlFor="badge-level">
                  Badge Level:
                </label>
                <select
                  id="badge-level"
                  className="dropdown"
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
            <div className="flex-container">
              <label className="popup-label" htmlFor="exam">
                Exam:
              </label>
              <select
                id="exam"
                className="dropdown"
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
              <div className="flex-container">
                <label className="popup-label" htmlFor="event-text">
                  Event Description:
                </label>
                <input
                  id="event-text"
                  type="text"
                  className="text-input"
                  placeholder="Enter event description..."
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                />
              </div>
              <div className="flex-container">
                <label className="popup-label" htmlFor="event-category">
                  Event Category:
                </label>
                <select
                  id="event-category"
                  className="dropdown"
                  value={selectedEventCategory}
                  onChange={(e) => setSelectedEventCategory(e.target.value)}
                >
                  <option value="" disabled>
                    Select Event Category
                  </option>
                  {eventCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          {selectedButton === "Special" && (
            <div className="flex-container">
              <label className="popup-label" htmlFor="special-award">
                Special Award:
              </label>
              <select
                id="special-award"
                className="dropdown"
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
        <div className="popup-bottom-buttons">
          <button className="popup-button-red" onClick={closePopup}>
            Cancel
          </button>
          <button className="popup-button-green" onClick={onAddEventClick}>
            Add Event
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddEventPopup;