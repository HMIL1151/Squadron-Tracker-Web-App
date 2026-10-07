/**
 * Cadet records for a squadron.
 *
 * Every function takes squadronNumber first, so the collection path is built
 * in exactly one place (db.js) rather than in each component.
 */

import { deleteDoc, deleteField, newSquadronDoc, setDoc, squadronDoc, updateDoc } from "./db";

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
 * Set, or with `override` null clear, a hand-set flying or gliding total.
 *
 * `field` is "flyingOverride" or "glidingOverride" (see utils/aviation.js).
 * One top-level field per kind rather than an `aviation: { flying, gliding }`
 * map: setting one must not need to read and rewrite the other, and dotted
 * field paths are the one thing the fake Firestore refuses to imitate.
 * Clearing deletes the field, so a cleared cadet is stored exactly as one that
 * never had an override.
 */
export const setAviationOverride = async (squadronNumber, cadetId, field, override) => {
  await updateDoc(squadronDoc(squadronNumber, COLLECTION, cadetId), {
    [field]: override ? override : deleteField(),
  });
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
