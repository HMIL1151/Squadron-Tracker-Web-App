import React, { useState } from "react";
import "./MassEventLog.css";

const AddEventPopup = ({
  isPopupOpen,
  inputValue,
  filteredNames,
  highlightedIndex,
  selectedNames,
  handleInputChange,
  handleKeyDown,
  handleNameSelect,
  handleRemoveName,
  handleAddEvent,
  closePopup,
  eventDate,
  handleDateChange, // New prop for handling date input
}) => {
  const [selectedButton, setSelectedButton] = useState(null); // State to track the selected button

  if (!isPopupOpen) return null;

  const handleButtonClick = (buttonText) => {
    setSelectedButton(buttonText); // Update the selected button
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
            onChange={handleDateChange} // Handle date input changes
          />
        </div>
        {/* 2x2 Button Grid */}
        <div className="button-grid">
          {["Badge", "Classification/<br />Exam", "Event/<br />Other", "Special"].map((buttonText) => (
            <button
              key={buttonText}
              className={`grid-button ${
                selectedButton === buttonText ? "selected" : ""
              }`}
              onClick={() => handleButtonClick(buttonText)}
              dangerouslySetInnerHTML={{ __html: buttonText }} // Use this to render HTML inside the button
            />
          ))}
        </div>
        <button className="popup-button" onClick={handleAddEvent}>
          Add Event
        </button>
        <button className="popup-button cancel" onClick={closePopup}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AddEventPopup;