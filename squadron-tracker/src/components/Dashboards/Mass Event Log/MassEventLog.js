import React, { useState, useEffect } from "react";
import { fetchCollectionData } from "../../../firebase/firestoreUtils";
import { getFirestore, doc, getDoc, addDoc, collection } from "firebase/firestore/lite";
import Table from "../../Table/Table";
import AddEventPopup from "./AddEventPopup";
import "./MassEventLog.css";
import SuccessMessage from "../SuccessMessage";


const MassEventLog = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedNames, setSelectedNames] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [filteredNames, setFilteredNames] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [names, setNames] = useState([]);
  const [eventDate, setEventDate] = useState("");
  const [badgeTypes, setBadgeTypes] = useState([]);
  const [eventCategories, setEventCategories] = useState([]);
  const [specialAwards, setSpecialAwards] = useState([]);
  const [selectedButton, setSelectedButton] = useState(null);
  const [freeText, setFreeText] = useState("");
  const [selectedBadgeType, setSelectedBadgeType] = useState("");
  const [selectedBadgeLevel, setSelectedBadgeLevel] = useState("");
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedEventCategory, setSelectedEventCategory] = useState("");
  const [selectedSpecialAward, setSelectedSpecialAward] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  

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

  const handleButtonSelect = (buttonText) => {
    setSelectedButton(buttonText); // Update the selectedButton state
    console.log(`Selected button: ${buttonText}`);
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
      const db = getFirestore();
      const createdAt = new Date(); // Current timestamp
  
      for (const name of selectedNames) {
        const newEvent = {
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
  
        await addDoc(collection(db, "Event Log"), newEvent);
      }

      // Trigger the success message
      setSuccessMessage(`Event successfully added.`);
      setTimeout(() => setSuccessMessage(""), 1000); // Automatically hide after 1 second
  
      // Refresh the table data
      await fetchEvents();
  
      // Reset the form and close the popup
      setSelectedNames([]);
      setInputValue("");
      setEventDate("");
      setSelectedButton(null);
      setFreeText("");
      setSelectedBadgeType("");
      setSelectedBadgeLevel("");
      setSelectedExam("");
      setSelectedEventCategory("");
      setSelectedSpecialAward("");
      setIsPopupOpen(false);
  
    } catch (error) {
      console.error("Error adding event:", error);
      alert("An error occurred while adding the event.");
    }
  };

  const closePopup = () => {
    setIsPopupOpen(false);
  };

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

  useEffect(() => {
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
        handleAddEvent={handleAddEvent} // Pass the function
        closePopup={closePopup}
        eventDate={eventDate}
        handleDateChange={handleDateChange}
        onButtonSelect={handleButtonSelect}
      />
      <SuccessMessage message={successMessage} />
    </div>
  );
};

export default MassEventLog;