import { getFirestore, collection, getDocs, doc, getDoc, query, where, updateDoc } from "firebase/firestore/lite";
import { app } from "./firebase";
import { rankMap } from "../utils/mappings";
import { getEventDescription } from "../utils/points";

// Fetch TeamPoints document for a squadron
export const fetchTeamPoints = async (squadronNumber) => {
  try {
    const db = getFirestore(app);
    const teamPointsRef = doc(db, "SquadronDatabases", String(squadronNumber), "FlightPoints", "TeamPoints");
    const teamPointsDoc = await getDoc(teamPointsRef);
    if (!teamPointsDoc.exists()) {
      return {};
    }
    const data = teamPointsDoc.data();
    const { LastLoginDate, ...pointsFields } = data;
    let yearValid = false;
    if (LastLoginDate) {
      let loginYear;
      // Firestore Timestamp object: has toDate() method
      if (typeof LastLoginDate === 'object' && typeof LastLoginDate.toDate === 'function') {
        loginYear = LastLoginDate.toDate().getFullYear();
      } else if (typeof LastLoginDate === 'string') {
        // Try to parse year from string (e.g., '20 July 2025 at 22:27:33 UTC+1')
        const match = LastLoginDate.match(/\b(\d{4})\b/);
        if (match) {
          loginYear = parseInt(match[1], 10);
        }
      }
      const currentYear = new Date().getFullYear();
      yearValid = loginYear === currentYear;
    }
    // If year is not valid, zero out all flight points fields (except LastLoginDate)
    if (!yearValid) {
      const zeroed = {};
      Object.keys(pointsFields).forEach(key => {
        zeroed[key] = 0;
      });
      return zeroed;
    }
    // If year is valid, return all points fields (excluding LastLoginDate)
    return pointsFields;
  } catch (error) {
    console.error(`Error fetching TeamPoints for squadron ${squadronNumber}:`, error);
    return {};
  }
};

// Increment points for a flight in TeamPoints document
export const addPointsToFlight = async (squadronNumber, flightNumber, pointsToAdd) => {
  try {
    const db = getFirestore(app);
    const teamPointsRef = doc(db, "SquadronDatabases", String(squadronNumber), "FlightPoints", "TeamPoints");
    // Get current data
    const teamPointsDoc = await getDoc(teamPointsRef);
    if (!teamPointsDoc.exists()) {
      throw new Error("TeamPoints document does not exist for this squadron.");
    }
    const data = teamPointsDoc.data();
    const currentPoints = Number(data[flightNumber] || 0);
    const updatedPoints = currentPoints + Number(pointsToAdd);
    // Update the field for the flight
    await updateDoc(teamPointsRef, { [flightNumber]: updatedPoints });
    return updatedPoints;
  } catch (error) {
    console.error(`Error adding points to flight ${flightNumber} for squadron ${squadronNumber}:`, error);
    throw error;
  }
};

export const getEventsForCadet = async (cadetName, data) => {
  try {
    const eventData = data.events || [];

    return eventData
      .filter((event) => event.cadetName === cadetName)
      .map((event) => ({ event: getEventDescription(event), date: event.date }))
      // An event with none of the describing fields set cannot be put on a
      // certificate; drop it rather than printing a blank line.
      .filter(({ event }) => event !== "");
  } catch (error) {
    console.error(`Error fetching events for cadet ${cadetName}:`, error);
    return [];
  }
};

export const getCadetRank = async (cadetName, data) => {
  try {
    const cadetsData = data.cadets || [];
    const cadet = cadetsData.find((cadet) => `${cadet.forename} ${cadet.surname}` === cadetName);

    if (cadet) {
      const rankInt = cadet.rank; // Assuming rank is stored as an integer
      const rankString = rankMap[rankInt] || "Unknown Rank"; // Convert to string using rankMap
      return rankString;
    } else {
      console.warn(`Cadet ${cadetName} not found in DataContext.`);
      return "Cadet Not Found";
    }
  } catch (error) {
    console.error(`Error fetching rank for cadet ${cadetName}:`, error);
    return "Error Fetching Rank";
  }
};

export const checkUserRole = async (uid) => {
  try {
    const db = getFirestore(app);
    const collectionRef = collection(db, "MassUserList");

    // Query the collection for documents where the UID field matches the given UID
    const userQuery = query(collectionRef, where("UID", "==", uid));
    const snapshot = await getDocs(userQuery);

    if (!snapshot.empty) {
      let isSystemAdmin = false;
      let squadronNumber = null;

      // Iterate through all matching documents
      snapshot.forEach((doc) => {
        const userDoc = doc.data();

        // Check if the user is a system admin
        if (userDoc.systemAdmin === true) {
          isSystemAdmin = true;
        }

        // If not a system admin, check for squadron number
        if (userDoc.Squadron) {
          squadronNumber = userDoc.Squadron;
        }
      });

      // Return "System Admin" if any document has systemAdmin = true
      if (isSystemAdmin) {
        return "System Admin";
      }

      // Return the squadron number if found
      if (squadronNumber) {
        return squadronNumber;
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
    const squadronDocRef = doc(db, "SquadronDatabases", number.toString()); // Reference the document by the squadron number

    // Check if the document exists
    const squadronDoc = await getDoc(squadronDocRef);

    // Return true if the document exists, false otherwise
    return squadronDoc.exists();
  } catch (error) {
    console.error(`Error checking if squadron account ${number} exists:`, error);
    return false; // Return false if an error occurs
  }
};
