import { getFirestore, collection, getDocs, doc, getDoc, query, where } from "firebase/firestore/lite";
import { app } from "./firebase";
import { rankMap } from "../utils/mappings";


// Function to fetch data from a specific Firestore collection
export const fetchCollectionData = async (...pathSegments) => {
  try {
    
    const db = getFirestore();
    const collectionRef = collection(db, ...pathSegments); // Dynamically construct the path
    const snapshot = await getDocs(collectionRef);

    return snapshot.docs.map((doc) => ({
      id: doc.id, // Include the document ID
      ...doc.data(), // Include the document data
    }));
  } catch (error) {
    console.error("Error fetching collection data:", error);
    throw error;
  }
};

export const getTotalPointsForCadet = async (cadetName, year, squadronNumber) => {
  try {

    const db = getFirestore(app);

    // Fetch events for the given cadet
    const eventsData = await fetchCollectionData("Squadron Databases", squadronNumber.toString(),"Event Log");

    // Fetch badge points
    const badgePointsDocRef = doc(db, "Squadron Databases", squadronNumber.toString(),"Flight Points", "Badge Points");
    const badgePointsDoc = await getDoc(badgePointsDocRef);
    const badgePoints = badgePointsDoc.data();

    // Fetch event category points
    const eventCategoryPointsDocRef = doc(db, "Squadron Databases", squadronNumber.toString(), "Flight Points", "Event Category Points");
    const eventCategoryPointsDoc = await getDoc(eventCategoryPointsDocRef);
    const eventCategoryPoints = eventCategoryPointsDoc.data();

    // Filter events for the given cadet and year
    const cadetEvents = eventsData.filter((event) => {
      const eventYear = event.date?.substring(0, 4); // Extract the first 4 characters of the date string
      return event.cadetName === cadetName && eventYear === String(year);
    });

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

    return totalPoints;
  } catch (error) {
    console.error(`Error fetching total points for cadet ${cadetName} in ${year}:`, error);
    return 0;
  }
};

// Function to calculate total flight points for a given flight
export const getTotalPointsForFlight = async (flightNumber, squadronNumber) => {
  try {

    // Fetch all cadets
    const cadetsData = await fetchCollectionData("Squadron Databases", squadronNumber.toString(),"Cadets");

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

    return flightTotalPoints;
  } catch (error) {
    console.error(`Error fetching total points for flight ${flightNumber}:`, error);
    return 0;
  }
};

export const getEventsForCadet = async (cadetName, squadronNumber) => {
  try {

    const eventData = await fetchCollectionData("Squadron Databases", squadronNumber.toString(),"Event Log");
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

    return formattedEvents;
  } catch (error) {
    console.error(`Error fetching events for cadet ${cadetName}:`, error);
    return [];
  }
};

export const getBadgesForCadet = async (cadetName, squadronNumber) => {
  try {

    const eventData = await fetchCollectionData("Squadron Databases", squadronNumber.toString(),"Event Log");
    const cadetEvents = eventData.filter((event) => event.cadetName === cadetName);

    const badges = cadetEvents
      .filter((event) => event.badgeLevel && event.badgeCategory) // Filter only badge events
      .map((event) => ({
        badge: `${event.badgeLevel} ${event.badgeCategory}`, // Combine badgeLevel and badgeCategory
        date: event.date, // Include the date
      }));

    return badges;
  } catch (error) {
    console.error(`Error fetching badges for cadet ${cadetName}:`, error);
    return [];
  }
};

export const getPointsForAllCadets = async (squadronNumber) => {
  try {

    // Fetch all cadets
    const cadetsData = await fetchCollectionData("Squadron Databases", squadronNumber.toString(),"Cadets");

    // Calculate points for each cadet
    const cadetPoints = await Promise.all(
      cadetsData.map(async (cadet) => {
        const cadetName = `${cadet.forename} ${cadet.surname}`;
        const pointsEarned = await getTotalPointsForCadet(cadetName);
        return { cadetName, pointsEarned };
      })
    );

    return cadetPoints;
  } catch (error) {
    console.error("Error fetching points for all cadets:", error);
    return [];
  }
};

export const getCadetFlight = async (cadetName, squadronNumber) => {
  try {

    const cadetsData = await fetchCollectionData("Squadron Databases", squadronNumber.toString(),"Cadets");
    const cadet = cadetsData.find((cadet) => `${cadet.forename} ${cadet.surname}` === cadetName);

    if (cadet) {
      return cadet.flight;
    } else {
      console.warn(`Cadet ${cadetName} not found in the database.`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching flight for cadet ${cadetName}:`, error);
    return null;
  }
};

export const getAllCadetNames = async (squadronNumber) => {
  try {

    const cadetsData = await fetchCollectionData("Squadron Databases", squadronNumber.toString(),"Cadets");
    const cadetNames = cadetsData.map((cadet) => `${cadet.forename} ${cadet.surname}`);
    return cadetNames;
  } catch (error) {
    console.error("Error fetching all cadet names:", error);
    return [];
  }
};

export const getCadetRank = async (cadetName, squadronNumber) => {
  try {

    // Fetch all cadets
    const cadetsData = await fetchCollectionData("Squadron Databases", squadronNumber.toString(),"Cadets");

    // Find the cadet with the matching name
    const cadet = cadetsData.find(
      (cadet) => `${cadet.forename} ${cadet.surname}` === cadetName
    );

    if (cadet) {
      const rankInt = cadet.rank; // Assuming rank is stored as an integer
      const rankString = rankMap[rankInt] || "Unknown Rank"; // Convert to string using rankMap
      return rankString;
    } else {
      console.warn(`Cadet ${cadetName} not found in the database.`);
      return "Cadet Not Found";
    }
  } catch (error) {
    console.error(`Error fetching rank for cadet ${cadetName}:`, error);
    return "Error Fetching Rank";
  }
};

export const getBadgeTypeList = async (squadronNumber) => {
  try {

    const db = getFirestore(app);

    // Reference the 'Badges' document in the 'Flight Points' collection
    const badgesDocRef = doc(db, "Squadron Databases", squadronNumber.toString(), "Flight Points", "Badges");

    // Fetch the document
    const badgesDoc = await getDoc(badgesDocRef);

    if (badgesDoc.exists()) {
      // Extract the 'Badge Types' array field
      const badgeTypes = badgesDoc.data()["Badge Types"]; // Ensure correct field name

      if (Array.isArray(badgeTypes)) {
        return badgeTypes;
      } else {
        console.warn("'Badge Types' field is not an array or is missing.");
        return [];
      }
    } else {
      console.warn("Badges document does not exist in the 'Flight Points' collection.");
      return [];
    }
  } catch (error) {
    console.error("Error fetching badge types:", error);
    return [];
  }
};

export const getAllBadges = async (squadronNumber) => {
  try {
    // Fetch all cadets
    const cadetsData = await fetchCollectionData("Squadron Databases", squadronNumber.toString(),"Cadets");

    // Fetch all events
    const eventData = await fetchCollectionData("Squadron Databases", squadronNumber.toString(),"Event Log");

    // Create an array to store all badges
    const allBadges = [];

    // Iterate over each cadet
    cadetsData.forEach((cadet) => {
      const cadetName = `${cadet.forename} ${cadet.surname}`;

      // Filter events for the current cadet
      const cadetEvents = eventData.filter((event) => event.cadetName === cadetName);

      // Extract badge events and format them
      const badges = cadetEvents
        .filter((event) => event.badgeLevel && event.badgeCategory) // Filter only badge events
        .map((event) => ({
          cadetName,
          badge: `${event.badgeLevel} ${event.badgeCategory}`, // Combine badgeLevel and badgeCategory
          date: event.date, // Include the date
        }));

      // Add the cadet's badges to the allBadges array
      allBadges.push(...badges);
    });

    return allBadges;
  } catch (error) {
    console.error("Error fetching all badges:", error);
    return [];
  }
};

export const checkUserRole = async (uid) => {
  try {
    
    const db = getFirestore(app);
    const collectionRef = collection(db, "Mass User List");

    // Query the collection for a document where the UID field matches the given UID
    const userQuery = query(collectionRef, where("UID", "==", uid));
    const snapshot = await getDocs(userQuery);

    if (!snapshot.empty) {
      // Get the first matching document
      const userDoc = snapshot.docs[0].data();

      // Check if the user is a system admin
      if (userDoc.systemAdmin === true) {
        return "System Admin";
      }

      // If not a system admin, return the squadron number
      if (userDoc.Squadron) {
        return userDoc.Squadron; // Return the squadron number
      }

      // If no systemAdmin or Squadron field exists
      return "No Role Assigned";
    } else {
      // No document found with the matching UID
      return "First Login";
    }
  } catch (error) {
    console.error(`Error checking user role for UID ${uid}:`, error);
    return "Error";
  }
};

export const doesSquadronAccountExist = async (number) => {
  try {
    const db = getFirestore(app);
    const squadronDocRef = doc(db, "Squadron Databases", number.toString()); // Reference the document by the squadron number

    // Check if the document exists
    const squadronDoc = await getDoc(squadronDocRef);

    // Return true if the document exists, false otherwise
    return squadronDoc.exists();
  } catch (error) {
    console.error(`Error checking if squadron account ${number} exists:`, error);
    return false; // Return false if an error occurs
  }
};

