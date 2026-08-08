/**
 * Creating squadrons: the new-account request queue, and the write set that
 * brings a squadron into existence.
 *
 * Two callers used to duplicate this: SystemAdminDashboard (approving someone
 * else's request) and WelcomePage (a system admin creating one directly). They
 * had drifted -- one defaulted the staff flight name, the other did not.
 */

import {
  collection,
  db,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  squadronCollection,
  writeBatch,
} from "./db";

const REQUESTS = "NewAccountRequests";

export const fetchAccountRequests = async () => {
  const snapshot = await getDocs(collection(db(), REQUESTS));
  return snapshot.docs.map((found) => ({ id: found.id, ...found.data() }));
};

export const createAccountRequest = async (request) => {
  const ref = doc(collection(db(), REQUESTS));
  await setDoc(ref, request);
  return ref.id;
};

export const deleteAccountRequest = async (requestId) => {
  await deleteDoc(doc(db(), REQUESTS, requestId));
};

/**
 * Bring a squadron into existence.
 *
 * Writes, in order: the SquadronList directory entry, the (empty) squadron
 * database document, the creator as its admin, a copy of the top-level
 * FlightPoints template, a granted UserRequest, and the creator's login
 * mapping. Both membership documents are keyed by uid, which the security
 * rules require.
 *
 * @returns the new SquadronList document id
 */
export const createSquadron = async ({ squadronName, squadronNumber, flights, uid, displayName, email }) => {
  const number = String(squadronNumber);

  const squadronListRef = doc(collection(db(), "SquadronList"));
  await setDoc(squadronListRef, {
    Name: squadronName,
    Number: parseInt(squadronNumber, 10),
    flights,
  });

  const squadronDbRef = doc(db(), "SquadronDatabases", number);
  await setDoc(squadronDbRef, {});

  await setDoc(doc(squadronCollection(number, "AuthorisedUsers"), uid), {
    displayName,
    email,
    role: "admin",
  });

  // Copy the template price list so the new squadron can score events at once.
  const template = await getDocs(collection(db(), "FlightPoints"));
  const batch = writeBatch(db());
  template.forEach((templateDoc) => {
    batch.set(doc(squadronCollection(number, "FlightPoints"), templateDoc.id), templateDoc.data());
  });
  await batch.commit();

  await setDoc(doc(squadronCollection(number, "UserRequests")), {
    displayName,
    email,
    uid,
    progress: "granted",
    timestamp: new Date().toISOString(),
  });

  await setDoc(doc(db(), "MassUserList", uid), {
    UID: uid,
    Squadron: parseInt(squadronNumber, 10),
  });

  return squadronListRef.id;
};
