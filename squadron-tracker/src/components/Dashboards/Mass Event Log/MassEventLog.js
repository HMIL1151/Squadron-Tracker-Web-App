import React, { useState, useEffect } from "react";
import { fetchCollectionData } from "../../../firebase/firestoreUtils";
import Table from "../../Table/Table";
import "./MassEventLog.css";

const MassEventLog = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false); // State for popup visibility
  const [selectedNames, setSelectedNames] = useState([]); // State for selected names
  const [inputValue, setInputValue] = useState(""); // State for the input value
  const [filteredNames, setFilteredNames] = useState([]); // State for filtered name suggestions
  const [highlightedIndex, setHighlightedIndex] = useState(-1); // State for highlighted suggestion
  const [names, setNames] = useState([]); // State for names fetched from Firestore

  const columns = ["Name", "Event", "Date", "Points"];

  // Fetch cadet names from Firestore
  useEffect(() => {
    const fetchCadetNames = async () => {
      try {
        const cadetData = await fetchCollectionData("Cadets");
        const cadetNames = cadetData.map((cadet) => `${cadet.forename} ${cadet.surname}`);
        setNames(cadetNames);
      } catch (error) {
        console.error("Error fetching cadet names:", error);
      }
    };

    fetchCadetNames();
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    // Filter names based on the input value
    if (value) {
      const suggestions = names.filter((name) =>
        name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredNames(suggestions);
      setHighlightedIndex(-1); // Reset highlighted index
    } else {
      setFilteredNames([]);
    }
  };

  const handleNameSelect = (name) => {
    if (!selectedNames.includes(name)) {
      setSelectedNames((prev) => [...prev, name]);
    }
    setInputValue(""); // Clear the input field after selection
    setFilteredNames([]); // Clear suggestions
    setHighlightedIndex(-1); // Reset highlighted index
  };

  const handleRemoveName = (name) => {
    setSelectedNames((prev) => prev.filter((n) => n !== name));
  };

  const handleKeyDown = (e) => {
    if (filteredNames.length > 0) {
      if (e.key === "ArrowDown") {
        // Move down the list
        setHighlightedIndex((prev) => (prev + 1) % filteredNames.length);
      } else if (e.key === "ArrowUp") {
        // Move up the list
        setHighlightedIndex((prev) =>
          prev === -1 ? filteredNames.length - 1 : (prev - 1 + filteredNames.length) % filteredNames.length
        );
      } else if (e.key === "Enter") {
        // Select the highlighted name
        if (highlightedIndex >= 0 && highlightedIndex < filteredNames.length) {
          handleNameSelect(filteredNames[highlightedIndex]);
        }
      }
    }
  };

  const handleAddEvent = () => {
    console.log("Selected Names:", selectedNames);
    setIsPopupOpen(false); // Close the popup after adding
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventData = await fetchCollectionData("Event Log");
        const formattedEvents = eventData.map((event) => {
          const { badgeCategory, badgeLevel, examName, eventName, specialAward } = event;

          let eventDescription = "";
          if (badgeCategory) {
            eventDescription = `${badgeLevel} ${badgeCategory}`;
          } else if (examName) {
            eventDescription = `${examName} Exam`;
          } else if (eventName) {
            eventDescription = eventName;
          } else if (specialAward) {
            eventDescription = specialAward;
          } else {
            throw new Error("Invalid event data: Missing required fields for event description.");
          }

          return {
            Name: event.cadetName,
            Event: eventDescription,
            Date: event.date,
            Points: Math.floor(Math.random() * 10) + 1, // Random number between 1-10
            AddedBy: event.addedBy,
            CreatedAt: event.createdAt,
            id: event.id, // Add the event ID
          };
        });

        setEvents(formattedEvents);
      } catch (error) {
        console.error("Error fetching events:", error);
      }
    };

    fetchEvents();
  }, []);

  return (
    <div className="table-dashboard-container">
      <div className="button-container">
        <button className="table-button" onClick={() => setIsPopupOpen(true)}>
          Add New Event
        </button>
      </div>
      <Table columns={columns} data={events} disableHover={false} width="80%" />

      {/* Popup for selecting names */}
      {isPopupOpen && (
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
            <button className="popup-button" onClick={handleAddEvent}>
              Add Event
            </button>
            <button className="popup-button cancel" onClick={() => setIsPopupOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MassEventLog;