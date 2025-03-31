import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore/lite";
import { app } from "./firebase";

// Function to fetch data from a specific Firestore collection
export const fetchCollectionData = async (collectionName) => {
  const db = getFirestore(app);
  const collectionRef = collection(db, collectionName);
  const snapshot = await getDocs(collectionRef);

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Function to calculate total flight points for a given cadet
export const getTotalPointsForCadet = async (cadetName) => {
  try {
    const db = getFirestore(app);

    // Fetch events for the given cadet
    const eventsData = await fetchCollectionData("Event Log");

    // Fetch badge points
    const badgePointsDocRef = doc(db, "Flight Points", "Badge Points");
    const badgePointsDoc = await getDoc(badgePointsDocRef);
    const badgePoints = badgePointsDoc.data();

    // Fetch event category points
    const eventCategoryPointsDocRef = doc(db, "Flight Points", "Event Category Points");
    const eventCategoryPointsDoc = await getDoc(eventCategoryPointsDocRef);
    const eventCategoryPoints = eventCategoryPointsDoc.data();

    // Filter events for the given cadet
    const cadetEvents = eventsData.filter((event) => event.cadetName === cadetName);

    // Calculate total points
    const totalPoints = cadetEvents.reduce((sum, event) => {
      const { badgeCategory, badgeLevel, eventCategory, examName, specialAward } = event;

      if (badgeCategory) {
        return sum + Number(badgePoints[`${badgeLevel} Badge`] || 0);
      } else if (examName) {
        return sum + Number(badgePoints["Exam"] || 0);
      } else if (eventCategory) {
        return sum + Number(eventCategoryPoints[eventCategory] || 0);
      } else if (specialAward) {
        return sum + Number(badgePoints["Special"] || 0);
      }

      return sum;
    }, 0);

    console.log(`Total Points for Cadet ${cadetName}:`, totalPoints);
    return totalPoints;
  } catch (error) {
    console.error(`Error fetching total points for cadet ${cadetName}:`, error);
    return 0;
  }
};

// Function to calculate total flight points for a given flight
export const getTotalPointsForFlight = async (flightNumber) => {
  try {
    // Fetch all cadets
    const cadetsData = await fetchCollectionData("Cadets");

    // Filter cadets belonging to the given flight
    const cadetsInFlight = cadetsData.filter((cadet) => cadet.flight === flightNumber);

    // Calculate total points for the flight
    const totalPoints = await Promise.all(
      cadetsInFlight.map(async (cadet) => {
        const cadetName = `${cadet.forename} ${cadet.surname}`;
        return await getTotalPointsForCadet(cadetName);
      })
    );

    const flightTotalPoints = totalPoints.reduce((sum, points) => sum + points, 0);

    console.log(`Total Points for Flight ${flightNumber}:`, flightTotalPoints);
    return flightTotalPoints;
  } catch (error) {
    console.error(`Error fetching total points for flight ${flightNumber}:`, error);
    return 0;
  }
};

export const getEventsForCadet = async (cadetName) => {
  try {
    const eventData = await fetchCollectionData("Event Log");
    const cadetEvents = eventData.filter((event) => event.cadetName === cadetName);

    const formattedEvents = [];

    for (const event of cadetEvents) {
      const { badgeCategory, badgeLevel, eventName, examName, specialAward, date } = event;

      let eventDescription = "";

      if (badgeCategory) {
        eventDescription = `${badgeLevel} ${badgeCategory}`;
      } else if (examName) {
        eventDescription = `${examName}`;
      } else if (eventName) {
        eventDescription = eventName;
      } else if (specialAward) {
        eventDescription = specialAward;
      } else {
        console.warn(`Event for cadet ${cadetName} has missing fields:`, event);
        continue; // Skip invalid events
      }

      formattedEvents.push({
        event: eventDescription,
        date: date,
      });
    }

    console.log(`Events for Cadet ${cadetName}:`, formattedEvents);
    return formattedEvents;
  } catch (error) {
    console.error(`Error fetching events for cadet ${cadetName}:`, error);
    return [];
  }
};

export const getBadgesForCadet = async (cadetName) => {
  try {
    const eventData = await fetchCollectionData("Event Log");
    const cadetEvents = eventData.filter((event) => event.cadetName === cadetName);

    const badges = cadetEvents
      .filter((event) => event.badgeLevel && event.badgeCategory) // Filter only badge events
      .map((event) => ({
        badge: `${event.badgeLevel} ${event.badgeCategory}`, // Combine badgeLevel and badgeCategory
        date: event.date, // Include the date
      }));

    console.log(`Badges for Cadet ${cadetName}:`, badges);
    return badges;
  } catch (error) {
    console.error(`Error fetching badges for cadet ${cadetName}:`, error);
    return [];
  }
};

export const getPointsForAllCadets = async () => {
  try {
    // Fetch all cadets
    const cadetsData = await fetchCollectionData("Cadets");

    // Calculate points for each cadet
    const cadetPoints = await Promise.all(
      cadetsData.map(async (cadet) => {
        const cadetName = `${cadet.forename} ${cadet.surname}`;
        const pointsEarned = await getTotalPointsForCadet(cadetName);
        return { cadetName, pointsEarned };
      })
    );

    console.log("Points for all cadets:", cadetPoints);
    return cadetPoints;
  } catch (error) {
    console.error("Error fetching points for all cadets:", error);
    return [];
  }
};