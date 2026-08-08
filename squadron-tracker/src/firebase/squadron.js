/**
 * The SquadronList directory: a squadron's name, number and flights.
 *
 * Awkwardness this module exists to contain: SquadronList documents are
 * created with auto-generated ids but are only ever looked up by their
 * `Number` field. So anything that wants to *write* -- renaming a flight, say
 * -- has to find the document first and hold on to its id. Callers get
 * `{ id, ... }` back and never have to know.
 *
 * Replaces the near-duplicate fetchSquadronName and fetchFlightNames in
 * WelcomePage, which ran the same query twice on every login.
 */

import { collection, db, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "./db";

/**
 * The squadron's directory entry, or null.
 * @returns { id, Name, Number, flights } | null
 */
export const fetchSquadronDoc = async (squadronNumber) => {
  try {
    const snapshot = await getDocs(
      query(collection(db(), "SquadronList"), where("Number", "==", parseInt(squadronNumber, 10)))
    );
    if (snapshot.empty) {
      console.error(`Squadron ${squadronNumber} not found in SquadronList.`);
      return null;
    }
    const found = snapshot.docs[0];
    return { id: found.id, ...found.data() };
  } catch (error) {
    console.error(`Error fetching squadron ${squadronNumber}:`, error);
    return null;
  }
};

/** Whether a squadron's database exists. Used by the join flow. */
export const doesSquadronExist = async (squadronNumber) => {
  try {
    const squadronDoc = await getDoc(doc(db(), "SquadronDatabases", String(squadronNumber)));
    return squadronDoc.exists();
  } catch (error) {
    console.error(`Error checking if squadron ${squadronNumber} exists:`, error);
    return false;
  }
};

/**
 * Replace a squadron's flights array.
 *
 * Takes the SquadronList document id, not the squadron number -- see the note
 * at the top of this file.
 */
export const updateFlights = async (squadronDocId, flights) => {
  if (!squadronDocId) throw new Error("updateFlights: squadronDocId is required");
  await updateDoc(doc(db(), "SquadronList", squadronDocId), { flights });
};

/**
 * Make sure TeamPoints has a key for a flight index, without disturbing the
 * others. Called when a flight is added, so allocating points to it works
 * immediately rather than failing on a missing field.
 */
export const ensureTeamPointsKey = async (squadronNumber, flightIndex) => {
  const ref = doc(db(), "SquadronDatabases", String(squadronNumber), "FlightPoints", "TeamPoints");
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    await setDoc(ref, { [flightIndex]: 0 });
    return;
  }
  if (snapshot.data()[flightIndex] === undefined) {
    await updateDoc(ref, { [flightIndex]: 0 });
  }
};
