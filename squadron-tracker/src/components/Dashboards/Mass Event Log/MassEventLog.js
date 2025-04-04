//TODO: Mass add Events from old tracker/from CSV file
//TODO: check that added entry is actually saved into firestore by returning the doc name for the entry then checking that the entry is in there

import React, { useState, useEffect, useCallback } from "react";
import { useSquadron } from "../../../context/SquadronContext";
import { fetchCollectionData } from "../../../firebase/firestoreUtils";
import { getFirestore, doc, getDoc, addDoc, collection, deleteDoc, getDocs } from "firebase/firestore/lite";
import Table from "../../Table/Table";
import AddEventPopup from "./AddEventPopup";
import EventDetailsPopup from "./EventDetailsPopup"; // Import the new popup
import LoadingPopup from "../Dashboard Components/LoadingPopup"; // Import the new LoadingPopup component
import "./MassEventLog.css";
import "../Dashboard Components/dashboardStyles.css";
import SuccessMessage from "../Dashboard Components/SuccessMessage";


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
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null); // State for the selected event
  const [isEventPopupOpen, setIsEventPopupOpen] = useState(false);
  const [loading, setLoading] = useState(true); // Add loading state
  const { squadronNumber } = useSquadron(); // Access the squadron number from context

  const columns = ["Name", "Record", "Date", "Points"];

  useEffect(() => {
    const fetchCadetNames = async () => {
      try {
        if (!squadronNumber) {
          console.error("Squadron number is not set.");
          return;
        }
    
        const db = getFirestore();
        // Construct the path to the Cadets collection
        const cadetsCollectionRef = collection(db, "Squadron Databases", squadronNumber.toString(), "Cadets");
        const cadetSnapshot = await getDocs(cadetsCollectionRef);
    
        // Map the cadet data to an array of names
        const cadetNames = cadetSnapshot.docs.map((doc) => {
          const cadet = doc.data();
          return `${cadet.forename} ${cadet.surname}`;
        });
    
        setNames(cadetNames); // Update the state with the cadet names
      } catch (error) {
        console.error("Error fetching cadet names:", error);
      }
    };

  const fetchBadgeTypes = async () => {
    try {
        const db = getFirestore();
        // Fetch Badge Types
        const badgesDocRef = doc(db, "Squadron Databases", squadronNumber.toString(), "Flight Points", "Badges");
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
        const eventCategoryPointsDocRef = doc(db, "Squadron Databases", squadronNumber.toString(), "Flight Points", "Event Category Points");
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
        const specialAwardsDocRef = doc(db,"Squadron Databases", squadronNumber.toString(), "Flight Points", "Special Awards");
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
  }, [squadronNumber]);

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
  
        // Add the new event to Firestore and get the document reference
        const docRef = await addDoc(
          collection(db, "Squadron Databases", squadronNumber.toString(), "Event Log"),
          newEvent
        );
  
        // Perform a sense check to verify the document exists
        const docSnapshot = await getDoc(docRef);
        if (docSnapshot.exists()) {
          setSuccessMessage(`Event successfully added`);
        } else {
          console.error(`Failed to verify event with ID: ${docRef.id}`);
          alert(`Error: Event with ID ${docRef.id} could not be verified.`);
          return; // Exit the loop if verification fails
        }
      }
  
      // Refresh the table data
      await fetchEvents();
  
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

  const closePopup = () => {
    setIsPopupOpen(false);
  };

  const fetchEvents = useCallback(async () => {
    setLoading(true); // Set loading to true before fetching data
    try {
      const db = getFirestore();
      const eventData = await fetchCollectionData("Squadron Databases", squadronNumber.toString(), "Event Log");
      const formattedEvents = [];
  
      for (const event of eventData) {
        const { badgeCategory, badgeLevel, eventCategory, eventName, examName, specialAward, id } = event;
  
        // Check if all specified fields are empty
        if (!badgeCategory && !badgeLevel && !eventCategory && !eventName && !examName && !specialAward) {
          // Delete the document if all fields are empty
          const docRef = doc(db,"Squadron Databases", squadronNumber.toString(),  "Event Log", id);
          await deleteDoc(docRef);
          continue; // Skip adding this event to the formattedEvents array
        }
  
        let eventDescription = "";
        let flightPoints = 0;
  
        if (badgeCategory) {
          eventDescription = `${badgeLevel} ${badgeCategory}`;
          const badgePointsDocRef = doc(db,"Squadron Databases", squadronNumber.toString(),  "Flight Points", "Badge Points");
          const badgePointsDoc = await getDoc(badgePointsDocRef);
          flightPoints = badgePointsDoc.data()[`${badgeLevel} Badge`] || 0; // Fetch points for the badge
        } else if (examName) {
          eventDescription = `${examName}`;
          const badgePointsDocRef = doc(db,"Squadron Databases", squadronNumber.toString(),  "Flight Points", "Badge Points");
          const badgePointsDoc = await getDoc(badgePointsDocRef);
          flightPoints = badgePointsDoc.data()["Exam"] || 0; // Fetch points for the exam
        } else if (eventName) {
          eventDescription = eventName;
          const eventCategoryPointsDocRef = doc(db,"Squadron Databases", squadronNumber.toString(),  "Flight Points", "Event Category Points");
          const eventCategoryPointsDoc = await getDoc(eventCategoryPointsDocRef);
          flightPoints = eventCategoryPointsDoc.data()[eventCategory] || 0; // Fetch points for the event category
        } else if (specialAward) {
          eventDescription = specialAward;
          const badgePointsDocRef = doc(db,"Squadron Databases", squadronNumber.toString(),  "Flight Points", "Badge Points");
          const badgePointsDoc = await getDoc(badgePointsDocRef);
          flightPoints = badgePointsDoc.data()["Special"] || 0; // Fetch points for the special award
        } else {
          throw new Error("Invalid event data: Missing required fields for event description.");
        }
  
        formattedEvents.push({
          Name: event.cadetName,
          Record: eventDescription, // Update key to "Record"
          Date: event.date,
          Points: flightPoints,
          AddedBy: event.addedBy,
          CreatedAt: event.createdAt,
          id: event.id,
          eventCategory: eventCategory || "", // Include eventCategory
        });
      }
  
      setEvents(formattedEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false); // Set loading to false after data is fetched
    }
  }, [squadronNumber]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]); // Add fetchEvents as a dependency

  const handleRowClick = (eventData) => {
    setSelectedEvent(eventData);
    setIsEventPopupOpen(true);
  };

  const handleRemoveEvent = async (eventId) => {
    try {
      const db = getFirestore();
      await deleteDoc(doc(db,"Squadron Databases", squadronNumber.toString(),  "Event Log", eventId));
      setIsEventPopupOpen(false);
      fetchEvents(); // Refresh the table data
    } catch (error) {
      console.error("Error removing event:", error);
      alert("An error occurred while removing the event.");
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