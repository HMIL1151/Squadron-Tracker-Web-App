/**
 * Cadet records for a squadron.
 *
 * Every function takes squadronNumber first, so the collection path is built
 * in exactly one place (db.js) rather than in each component.
 */

import { deleteDoc, newSquadronDoc, setDoc, squadronDoc, updateDoc } from "./db";

const COLLECTION = "Cadets";

/**
 * Add a cadet.
 * @returns the new document id
 */
export const addCadet = async (squadronNumber, cadet) => {
  const ref = newSquadronDoc(squadronNumber, COLLECTION);
  await setDoc(ref, cadet);
  return ref.id;
};

/** Update the given fields on a cadet. */
export const updateCadet = async (squadronNumber, cadetId, fields) => {
  await updateDoc(squadronDoc(squadronNumber, COLLECTION, cadetId), fields);
};

/**
 * Remove a cadet.
 *
 * Note this leaves their EventLog entries in place -- points history is keyed
 * by cadet name, and discharging has never removed it.
 */
export const removeCadet = async (squadronNumber, cadetId) => {
  await deleteDoc(squadronDoc(squadronNumber, COLLECTION, cadetId));
};
