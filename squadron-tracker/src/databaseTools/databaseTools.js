import { getFirestore, collection, setDoc, doc } from "firebase/firestore/lite";
import { useContext } from "react";
import { DataContext } from "../context/DataContext";
import { useSquadron } from "../context/SquadronContext";

export const useSaveEvent = () => {
  const { data, setData } = useContext(DataContext); // Access the DataContext
  const { squadronNumber } = useSquadron(); // Access the squadron number from context

  const saveEvent = async (eventDetails) => {
    const existingEvents = data.events; // Get the current events array

    const {
      addedBy,
      badgeCategory = "",
      badgeLevel = "",
      cadetName, // Now an array of names
      createdAt,
      date,
      eventCategory = "",
      eventName = "",
      examName = "",
      specialAward = "",
    } = eventDetails;

    if (!addedBy || !date || !cadetName || !createdAt || !Array.isArray(cadetName) || cadetName.length === 0) {
      console.error("Invalid event details provided.");
      return;
    }

    // Validate the date
    const eventDate = new Date(date);
    const currentDate = new Date();
    const eightYearsAgo = new Date();
    eightYearsAgo.setFullYear(currentDate.getFullYear() - 8);
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(currentDate.getDate() + 7);

    if (eventDate < eightYearsAgo || eventDate > sevenDaysFromNow) {
      alert("The event date must be no more than 8 years in the past and no more than 7 days in the future.");
      return;
    }

    const db = getFirestore();

    try {
      const newEvents = []; // To store the new events for DataContext

      for (const name of cadetName) {
        // Check for duplicates in the existing events array
        const isDuplicate = existingEvents.some((event) => {
          // Duplicate Badge
          if (badgeCategory && badgeLevel) {
            return (
              event.cadetName === name &&
              event.badgeCategory === badgeCategory &&
              event.badgeLevel === badgeLevel
            );
          }

          // Duplicate Exam
          else if (examName) {
            return event.cadetName === name && event.examName === examName;
          }

          // Duplicate Special
          else if (specialAward) {
            return (
              event.cadetName === name &&
              event.specialAward === specialAward &&
              event.date === date
            );
          }

          // General Duplicate
          else if (eventName) {
            return (
              event.cadetName === name &&
              event.eventName === eventName &&
              event.date === date
            );
          }

          return false;
        });

        if (isDuplicate) {
          console.warn(`Duplicate event found: for cadet: ${name}`);
          continue; // Skip saving this event
        }

        // Create the new event
        const newEvent = {
          addedBy: addedBy,
          createdAt: createdAt,
          cadetName: name, // Use the current name from the array
          date: date,
          badgeCategory: badgeCategory,
          badgeLevel: badgeLevel,
          examName: examName,
          eventName: eventName,
          eventCategory: eventCategory,
          specialAward: specialAward,
        };

        const eventDocRef = doc(collection(db, "Squadron Databases", squadronNumber.toString(), "Event Log"));
        await setDoc(eventDocRef, newEvent);

        // Add the new event to the array for DataContext
        newEvents.push({
          ...newEvent,
          id: eventDocRef.id, // Include the document ID
        });
      }

      // Update the events array in DataContext
      setData((prevData) => ({
        ...prevData,
        events: [...(prevData.events || []), ...newEvents], // Append the new events
      }));

    } catch (error) {
      console.error("Error saving event details:", error);
      throw error;
    }
  };

  return saveEvent;
};