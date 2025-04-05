//TODO: Mass add Events from old tracker/from CSV file
//TODO: check that added entry is actually saved into firestore by returning the doc name for the entry then checking that the entry is in there

import React, { useState, useEffect, useCallback, useContext } from "react";
import { useSquadron } from "../../../context/SquadronContext";
import { DataContext } from "../../../context/DataContext"; // Import DataContext
import Table from "../../Table/Table";
import AddEventPopup from "./AddEventPopup";
import EventDetailsPopup from "./EventDetailsPopup"; // Import the new popup
import LoadingPopup from "../Dashboard Components/LoadingPopup"; // Import the new LoadingPopup component
import "./MassEventLog.css";
import "../Dashboard Components/dashboardStyles.css";
import SuccessMessage from "../Dashboard Components/SuccessMessage";
import { getFirestore, deleteDoc, doc } from "firebase/firestore"; // Import Firestore functions

const MassEventLog = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedNames, setSelectedNames] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [filteredNames, setFilteredNames] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [eventDate, setEventDate] = useState("");
  const [selectedButton, setSelectedButton] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null); // State for the selected event
  const [isEventPopupOpen, setIsEventPopupOpen] = useState(false);
  const [loading, setLoading] = useState(true); // Add loading state
  const { squadronNumber } = useSquadron(); // Access the squadron number from context
  const { data, setData } = useContext(DataContext); // Access data from DataContext
  const [names, setNames] = useState([]);
  const [badgeTypes, setBadgeTypes] = useState([]);
  const [eventCategories, setEventCategories] = useState([]);
  const [specialAwards, setSpecialAwards] = useState([]);

  const columns = ["Name", "Record", "Date", "Points"];

  // Fetch data from DataContext instead of Firestore
  useEffect(() => {
    if (!squadronNumber) {
      console.error("Squadron number is not set.");
      return;
    }

    setLoading(true);

    try {
      // Extract data from DataContext
      const cadetNames = data.cadets.map((cadet) => `${cadet.forename} ${cadet.surname}`);
      const badgeTypes = data.flightPoints.Badges?.["Badge Types"] || [];
      const eventCategories = Object.keys(data.flightPoints["Event Category Points"] || {});
      const specialAwards = data.flightPoints["Special Awards"]?.["Special Awards"] || [];
      const eventLog = data.events;

      // Log the event data to debug

      // Set state with the extracted data
      setSelectedNames([]);
      setFilteredNames([]);
      setHighlightedIndex(-1);
      setEventDate("");
      setEvents(eventLog); // Ensure eventLog has the correct structure
      setInputValue("");
      setSelectedButton(null);

      // Set additional data for dropdowns
      setNames(cadetNames);
      setBadgeTypes(badgeTypes);
      setEventCategories(eventCategories);
      setSpecialAwards(specialAwards);
    } catch (error) {
      console.error("Error processing data from DataContext:", error);
    } finally {
      setLoading(false);
    }
  }, [data, squadronNumber]);

  useEffect(() => {
    if (!squadronNumber) {
      console.error("Squadron number is not set.");
      return;
    }

    setLoading(true);

    const processEvents = async () => {
      try {
        const eventLog = data.events;
        const flightPoints = data.flightPoints; // Access flight points from DataContext

        // Debugging: Log flightPoints and eventLog
        console.log("Flight Points:", flightPoints);
        console.log("Event Log:", eventLog);

        // Map eventLog to the desired format
        const mappedEvents = eventLog.map((event) => {
          let eventDescription = "";
          let points = 0;

          // Debugging: Log the current event being processed

          if (event.badgeCategory) {
            eventDescription = `${event.badgeLevel} ${event.badgeCategory}`;
            points = parseInt(flightPoints["Badge Points"]?.[`${event.badgeLevel} Badge`] || 0, 10); // Get badge points


          } else if (event.examName) {
            eventDescription = event.examName;
            points = parseInt(flightPoints["Badge Points"]?.["Exam"] || 0, 10); // Get exam points

            // Debugging: Log exam points calculation
          } else if (event.eventName) {
            eventDescription = event.eventName;
            points = parseInt(
              flightPoints["Event Category Points"]?.[event.eventCategory] || 0,
              10
            ); // Get event category points

            // Debugging: Log event category points calculation
          } else if (event.specialAward) {
            eventDescription = event.specialAward;
            points = parseInt(flightPoints["Badge Points"]?.["Special"] || 0, 10); // Get special award points

          } else {
            console.error(
              "Invalid event data: Missing required fields for event description.",
              event
            );
          }

          return {
            Name: event.cadetName || "Unknown",
            Record: eventDescription,
            Date: event.date || "N/A",
            Points: points,
            AddedBy: event.addedBy || "Unknown",
            CreatedAt: event.createdAt || "N/A",
            id: event.id || "N/A",
            eventCategory: event.eventCategory || "",
          };
        });


        // Set state with the mapped data
        setEvents(mappedEvents);
      } catch (error) {
        console.error("Error processing event data:", error);
      } finally {
        setLoading(false);
      }
    };

    processEvents();
  }, [data, squadronNumber]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    if (value) {
      const suggestions = names.filter((name) =>
        name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredNames(suggestions);
      setHighlightedIndex(-1);
    } else {
      setFilteredNames([]);
    }
  };

  const handleDateChange = (e) => {
    setEventDate(e.target.value); // Update the eventDate state
  };

  const handleNameSelect = (name) => {
    if (!selectedNames.includes(name)) {
      setSelectedNames((prev) => [...prev, name]);
    }
    setInputValue("");
    setFilteredNames([]);
    setHighlightedIndex(-1);
  };

  const handleRemoveName = (name) => {
    setSelectedNames((prev) => prev.filter((n) => n !== name));
  };

  const handleKeyDown = (e) => {
    if (filteredNames.length > 0) {
      if (e.key === "ArrowDown") {
        setHighlightedIndex((prev) => (prev + 1) % filteredNames.length);
      } else if (e.key === "ArrowUp") {
        setHighlightedIndex((prev) =>
          prev === -1 ? filteredNames.length - 1 : (prev - 1 + filteredNames.length) % filteredNames.length
        );
      } else if (e.key === "Enter") {
        if (highlightedIndex >= 0 && highlightedIndex < filteredNames.length) {
          handleNameSelect(filteredNames[highlightedIndex]);
        }
      }
    }
  };

  const handleButtonSelect = (buttonText) => {
    setSelectedButton(buttonText); // Update the selectedButton state
  };

  const handleAddEvent = async (eventData) => {
    const {
      selectedBadgeType,
      selectedBadgeLevel,
      selectedExam,
      freeText,
      selectedEventCategory,
      selectedSpecialAward,
    } = eventData;

    if (!selectedNames.length) {
      alert("Please select at least one name.");
      return;
    }

    if (!eventDate) {
      alert("Please select a date.");
      return;
    }

    try {
      const createdAt = new Date(); // Current timestamp
      let newEvent = null; // Declare newEvent outside the loop

      for (const name of selectedNames) {
        newEvent = {
          addedBy: user.displayName,
          createdAt,
          cadetName: name,
          date: eventDate,
          badgeCategory: selectedButton === "Badge" ? selectedBadgeType : "",
          badgeLevel: selectedButton === "Badge" ? selectedBadgeLevel : "",
          examName: selectedButton === "Classification/Exam" ? selectedExam : "",
          eventName: selectedButton === "Event/Other" ? freeText : "",
          eventCategory: selectedButton === "Event/Other" ? selectedEventCategory : "",
          specialAward: selectedButton === "Special" ? selectedSpecialAward : "",
        };

        // Add the new event to Firestore (if needed) and update the context
      }

      // Refresh the table data
      setEvents((prev) => [...prev, ...selectedNames.map((name) => ({ ...newEvent, cadetName: name }))]);

      // Reset the form and close the popup
      setSelectedNames([]);
      setInputValue("");
      setEventDate("");
      setSelectedButton(null);
      setIsPopupOpen(false);
    } catch (error) {
      console.error("Error adding event:", error);
      alert("An error occurred while adding the event.");
    }
  };

  const handleRowClick = (eventData) => {
    setSelectedEvent(eventData);
    setIsEventPopupOpen(true);
  };

  const handleRemoveEvent = async (eventId) => {
    try {
      const db = getFirestore(); // Initialize Firestore

      // Debugging: Log eventId and squadronNumber
      console.log("Attempting to remove event with ID:", eventId);
      console.log("Squadron Number:", squadronNumber);

      if (!eventId) {
        throw new Error("Invalid event ID. Cannot remove event.");
      }

      if (!squadronNumber) {
        throw new Error("Squadron number is not set. Cannot remove event.");
      }

      // Delete the event document from Firestore
      const eventDocRef = doc(db, "Squadron Databases", squadronNumber.toString(), "Event Log", eventId);
      console.log("Firestore Path:", eventDocRef.path);

      await deleteDoc(eventDocRef);
      console.log(`Event with ID ${eventId} deleted from Firestore.`);

      // Remove the event from the local state
      setEvents((prev) => {
        const updatedEvents = prev.filter((event) => event.id !== eventId);
        console.log("Updated local events:", updatedEvents);
        return updatedEvents;
      });

      // Remove the event from DataContext's eventLog
      setData((prevData) => {
        console.log("Current DataContext events:", prevData.events);

        // Ensure prevData.events is an array
        const updatedEventLog = (prevData.events || []).filter((event) => {
          if (!event || typeof event !== "object") {
            console.warn("Skipping invalid event:", event);
            return false;
          }
          return event.id !== eventId;
        });

        console.log("Updated DataContext events:", updatedEventLog);

        return {
          ...prevData,
          events: updatedEventLog,
        };
      });

      console.log(`Event with ID ${eventId} removed from DataContext.`);

      setIsEventPopupOpen(false); // Close the popup
    } catch (error) {
      console.error("Error removing event:", error);
      alert("An error occurred while removing the event. Please try again.");
    }
  };

  return (
    <div className="table-dashboard-container">
      {loading && <LoadingPopup />} {/* Show loading popup while loading */}
      <div className="button-container">
        <button className="button-green" onClick={() => setIsPopupOpen(true)}>
          Add New Record
        </button>
      </div>
      <Table
        columns={columns}
        data={events}
        disableHover={false}
        width="80%"
        onRowClick={handleRowClick} // Add row click handler
      />
      <AddEventPopup
        isPopupOpen={isPopupOpen}
        inputValue={inputValue}
        filteredNames={filteredNames}
        badgeTypes={data.flightPoints.Badges?.["Badge Types"] || []}
        eventCategories={Object.keys(data.flightPoints["Event Category Points"] || {})}
        specialAwards={data.flightPoints["Special Awards"]?.["Special Awards"] || []}
        highlightedIndex={highlightedIndex}
        selectedNames={selectedNames}
        handleInputChange={handleInputChange}
        handleKeyDown={handleKeyDown}
        handleNameSelect={handleNameSelect}
        handleRemoveName={handleRemoveName}
        handleAddEvent={handleAddEvent}
        closePopup={() => setIsPopupOpen(false)}
        eventDate={eventDate}
        handleDateChange={handleDateChange}
        onButtonSelect={handleButtonSelect}
      />
      <EventDetailsPopup
        isOpen={isEventPopupOpen}
        eventData={selectedEvent}
        onClose={() => setIsEventPopupOpen(false)}
        onRemove={handleRemoveEvent}
      />
      <SuccessMessage message={successMessage} />
    </div>
  );
};

export default MassEventLog;