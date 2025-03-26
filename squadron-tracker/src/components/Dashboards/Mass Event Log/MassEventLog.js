import React, { useState, useEffect } from "react";
import { fetchCollectionData } from "../../../firebase/firestoreUtils";
import { getFirestore, doc, getDoc } from "firebase/firestore/lite";
import Table from "../../Table/Table";
import AddEventPopup from "./AddEventPopup";
import "./MassEventLog.css";

const MassEventLog = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedNames, setSelectedNames] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [filteredNames, setFilteredNames] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [names, setNames] = useState([]);
  const [eventDate, setEventDate] = useState(""); // New state for the date input
  const [badgeTypes, setBadgeTypes] = useState([]);
  const [eventCategories, setEventCategories] = useState([]);
  const [specialAwards, setSpecialAwards] = useState([]);

  const columns = ["Name", "Event", "Date", "Points"];

  useEffect(() => {
    const fetchCadetNames = async () => {
      try {
        // Fetch cadet names
        const cadetData = await fetchCollectionData("Cadets");
        const cadetNames = cadetData.map((cadet) => `${cadet.forename} ${cadet.surname}`);
        setNames(cadetNames);
      } catch (error) {
        console.error("Error fetching cadet names:", error);
      }
    };

  const fetchBadgeTypes = async () => {
    try {
        const db = getFirestore();
        // Fetch Badge Types
        const badgesDocRef = doc(db, "Flight Points", "Badges");
        const badgesDoc = await getDoc(badgesDocRef);
        const badgeTypes = badgesDoc.data()["Badge Types"];
        setBadgeTypes(badgeTypes);
      } catch (error) {
        console.error("Error fetching cadet names:", error);
      }
    };
  
  const fetchEventCategories = async () => {
    try {
        const db = getFirestore();
        // Fetch Event Categories
        const eventCategoryPointsDocRef = doc(db, "Flight Points", "Event Category Points");
        const eventCategoryPointsDoc = await getDoc(eventCategoryPointsDocRef);
        const eventCategories = Object.keys(eventCategoryPointsDoc.data());
        setEventCategories(eventCategories);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
  
  const fetchSpecialAwards = async () => {
    try {
        const db = getFirestore();
        // Fetch Special Awards
        const specialAwardsDocRef = doc(db, "Flight Points", "Special Awards");
        const specialAwardsDoc = await getDoc(specialAwardsDocRef);
        const specialAwards = specialAwardsDoc.data()["Special Awards"];
        setSpecialAwards(specialAwards);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    
    fetchCadetNames();
    fetchBadgeTypes();
    fetchEventCategories();
    fetchSpecialAwards();
  }, []);

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

  const handleAddEvent = () => {
    console.log("Selected Names:", selectedNames);
    console.log("Event Date:", eventDate); // Log the selected date
    setIsPopupOpen(false);
  };

  const closePopup = () => {
    setIsPopupOpen(false);
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
            Points: Math.floor(Math.random() * 10) + 1,
            AddedBy: event.addedBy,
            CreatedAt: event.createdAt,
            id: event.id,
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
      <AddEventPopup
        isPopupOpen={isPopupOpen}
        inputValue={inputValue}
        filteredNames={filteredNames}
        badgeTypes={badgeTypes}
        eventCategories={eventCategories}
        specialAwards={specialAwards}
        highlightedIndex={highlightedIndex}
        selectedNames={selectedNames}
        handleInputChange={handleInputChange}
        handleKeyDown={handleKeyDown}
        handleNameSelect={handleNameSelect}
        handleRemoveName={handleRemoveName}
        handleAddEvent={handleAddEvent}
        closePopup={closePopup}
        eventDate={eventDate} // Pass the date state
        handleDateChange={handleDateChange} // Pass the date change handler
      />
    </div>
  );
};

export default MassEventLog;