/**
 * Finding and repairing squadron memberships the security rules cannot see.
 *
 * The rules decide membership by whether AuthorisedUsers/{uid} exists. Before
 * Phase 4 the Admin Dashboard granted access by writing
 * AuthorisedUsers/{requestId} instead -- the id of the access request, not of
 * the user. Under the launch-era `allow read, write: if true` that never
 * mattered; under the real rules those users sign in fine, find their squadron
 * through MassUserList, and are then refused every read of cadets and records.
 * The app showed them an empty tracker rather than an error.
 *
 * The id was the request's, so the request itself is the way back: a legacy
 * document shares its id with a UserRequests document, and that request
 * carries the uid the membership should have been keyed by. No guessing by
 * name or email is needed, and nothing that cannot be traced to a request is
 * touched.
 *
 * Two outcomes, and the second matters as much as the first:
 *
 *   rekey     request still granted, no uid-keyed document yet. Copy the
 *             document to the user's uid and remove the old one.
 *   leftover  the user already has a uid-keyed document, or the request is no
 *             longer granted. Remove the old one only. Re-keying a revoked
 *             user's leftover would silently give them their access back --
 *             revokeAccess deletes AuthorisedUsers/{uid}, so a legacy document
 *             survives a revoke untouched.
 *
 * Runs as a system admin, which the rules let read and write every squadron's
 * AuthorisedUsers and UserRequests. Squadron admins cannot run it across
 * squadrons, by design.
 */

import { collection, db, deleteDoc, getDocs, setDoc, squadronCollection, squadronDoc } from "./db";

const docsOf = (snapshot) => snapshot.docs.map((found) => ({ id: found.id, data: found.data() }));

/** Every legacy membership in one squadron. */
const scanSquadron = async (squadronNumber, squadronName) => {
  const [authorisedSnapshot, requestsSnapshot] = await Promise.all([
    getDocs(squadronCollection(squadronNumber, "AuthorisedUsers")),
    getDocs(squadronCollection(squadronNumber, "UserRequests")),
  ]);

  const authorised = docsOf(authorisedSnapshot);
  const requests = new Map(docsOf(requestsSnapshot).map((request) => [request.id, request.data]));
  const keyedByUid = new Set(authorised.map((member) => member.id));

  return authorised.flatMap(({ id, data }) => {
    const request = requests.get(id);
    // Not a request id, or a request that never recorded a uid: leave alone.
    // Squadron creators are keyed by uid and have no request, which is fine.
    if (!request?.uid || request.uid === id) return [];

    const uid = request.uid;
    const action = request.progress === "granted" && !keyedByUid.has(uid) ? "rekey" : "leftover";

    return [{
      squadronNumber,
      squadronName,
      legacyId: id,
      uid,
      displayName: data.displayName ?? request.displayName ?? "",
      email: data.email ?? request.email ?? "",
      role: data.role ?? "user",
      progress: request.progress ?? "",
      action,
      data,
    }];
  });
};

/** Every legacy membership in every squadron, sorted by squadron then name. */
export const findLegacyMemberships = async () => {
  const squadrons = docsOf(await getDocs(collection(db(), "SquadronList")))
    .map(({ data }) => ({ number: data.Number, name: data.Name ?? "" }))
    .filter(({ number }) => number !== undefined && number !== null);

  const found = (
    await Promise.all(squadrons.map(({ number, name }) => scanSquadron(number, name)))
  ).flat();

  return found.sort(
    (a, b) =>
      Number(a.squadronNumber) - Number(b.squadronNumber) ||
      a.displayName.localeCompare(b.displayName)
  );
};

/**
 * Apply one finding. The new document is written before the old one is
 * removed, so a failure part-way leaves the user with access rather than
 * without it.
 */
export const repairLegacyMembership = async (finding) => {
  const { squadronNumber, legacyId, uid, action, data } = finding;
  if (action === "rekey") {
    await setDoc(squadronDoc(squadronNumber, "AuthorisedUsers", uid), data);
  }
  await deleteDoc(squadronDoc(squadronNumber, "AuthorisedUsers", legacyId));
};
