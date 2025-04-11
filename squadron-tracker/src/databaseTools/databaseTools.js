import { getFirestore, collection, setDoc, doc } from "firebase/firestore/lite";

/**
 * Saves an event to Firestore and updates the DataContext.
 * @param {Object} eventDetails - The details of the event to save.
 * @param {string} sqnNo - The squadron number from context.
 * @param {Function} setData - The setData function from DataContext.
 */
export const saveEvent = async (eventDetails, sqnNo, setData) => {
  const {
    addedBy,
    badgeCategory,
    badgeLevel,
    cadetName, // Now an array of names
    createdAt,
    date,
    eventCategory,
    eventName,
    examName,
    specialAward,
  } = eventDetails;

  if (!addedBy || !date || !cadetName || !createdAt || !Array.isArray(cadetName) || cadetName.length === 0) {
    throw new Error("Invalid event details provided.");
  }

  const db = getFirestore();

  try {
    const newEvents = []; // To store the new events for DataContext

    for (const name of cadetName) {
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

      const eventDocRef = doc(collection(db, "Squadron Databases", sqnNo.toString(), "Event Log"));
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