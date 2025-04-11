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
    cadetName,
    createdAt,
    date,
    eventCategory,
    eventName,
    examName,
    specialAward,
  } = eventDetails;

  if (!addedBy || !date || !cadetName || !createdAt) {
    throw new Error("Invalid event details provided.");
  }

  const db = getFirestore();

  try {

    const newEvent = {
        addedBy: addedBy,
        createdAt: createdAt,
        cadetName: cadetName,
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

    // Update the events array in DataContext
    setData((prevData) => ({
      ...prevData,
      events: [
        ...(prevData.events || []),
        {
          addedBy,
          id: eventDocRef.id,
          badgeCategory,
          badgeLevel,
          cadetName,
          createdAt,
          date,
          eventCategory,
          eventName,
          examName,
          specialAward,
        },
      ],
    }));

  } catch (error) {
    console.error("Error saving event details:", error);
    throw error;
  }
};