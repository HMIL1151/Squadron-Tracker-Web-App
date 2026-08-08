/**
 * Who may use the app, and for which squadron.
 *
 * Three collections work together:
 *   MassUserList/{uid}                      uid -> squadron, read at login
 *   SquadronDatabases/{sqn}/AuthorisedUsers/{uid}   membership + role
 *   SquadronDatabases/{sqn}/UserRequests/{id}       access requests
 *
 * Both membership documents are keyed by uid. That matters: the security
 * rules check membership at AuthorisedUsers/{request.auth.uid}, so a
 * differently-keyed document would leave a granted user locked out.
 */

import {
  collection,
  db,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  squadronCollection,
  squadronDoc,
  updateDoc,
  where,
} from "./db";

/**
 * What a signed-in user is allowed to do.
 * @returns "System Admin" | squadron number | "No Role Assigned" | "First Login" | "Error"
 */
export const checkUserRole = async (uid) => {
  try {
    const snapshot = await getDocs(
      query(collection(db(), "MassUserList"), where("UID", "==", uid))
    );
    if (snapshot.empty) return "First Login";

    let isSystemAdmin = false;
    let squadronNumber = null;
    snapshot.forEach((found) => {
      const row = found.data();
      if (row.systemAdmin === true) isSystemAdmin = true;
      if (row.Squadron) squadronNumber = row.Squadron;
    });

    if (isSystemAdmin) return "System Admin";
    if (squadronNumber) return squadronNumber;
    return "No Role Assigned";
  } catch (error) {
    console.error(`Error checking user role for UID ${uid}:`, error);
    return "Error";
  }
};

export const fetchAccessRequests = async (squadronNumber) => {
  const snapshot = await getDocs(squadronCollection(squadronNumber, "UserRequests"));
  return snapshot.docs.map((found) => ({ id: found.id, ...found.data() }));
};

export const setRequestProgress = async (squadronNumber, requestId, progress) => {
  await updateDoc(squadronDoc(squadronNumber, "UserRequests", requestId), { progress });
};

/** File a request to join a squadron. */
export const createAccessRequest = async (squadronNumber, request) => {
  const ref = doc(squadronCollection(squadronNumber, "UserRequests"));
  await setDoc(ref, request);
  return ref.id;
};

/**
 * Grant access: the membership document and the login mapping, both keyed by
 * uid so a re-grant overwrites rather than duplicating.
 */
export const grantAccess = async (squadronNumber, { uid, displayName, email, role }) => {
  if (!uid) throw new Error("grantAccess: uid is required");
  await setDoc(squadronDoc(squadronNumber, "AuthorisedUsers", uid), { displayName, email, role });
  await setDoc(doc(db(), "MassUserList", uid), { UID: uid, Squadron: squadronNumber });
};

/** Revoke access, removing both documents so no login mapping survives. */
export const revokeAccess = async (squadronNumber, uid) => {
  if (!uid) throw new Error("revokeAccess: uid is required");
  await deleteDoc(squadronDoc(squadronNumber, "AuthorisedUsers", uid));
  await deleteDoc(doc(db(), "MassUserList", uid));
};

/** Whether this user is a system admin, per the rules-only lookup table. */
export const isSystemAdmin = async (uid) => {
  const snapshot = await getDocs(
    query(collection(db(), "MassUserList"), where("UID", "==", uid))
  );
  return snapshot.docs.some((found) => found.data().systemAdmin === true);
};
