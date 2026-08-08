/**
 * The event log for a squadron: badges, exams, events and awards.
 *
 * Writing an event goes through useSaveEvent in databaseTools, which owns the
 * duplicate detection and date validation. These are the raw operations it and
 * the dashboards build on.
 */

import { deleteDoc, newSquadronDoc, setDoc, squadronDoc, updateDoc } from "./db";

const COLLECTION = "EventLog";

/**
 * Record one event.
 * @returns the new document id
 */
export const addEvent = async (squadronNumber, event) => {
  const ref = newSquadronDoc(squadronNumber, COLLECTION);
  await setDoc(ref, event);
  return ref.id;
};

/** A reference for an event, for callers that need the id before writing. */
export const newEventRef = (squadronNumber) => newSquadronDoc(squadronNumber, COLLECTION);

export const removeEvent = async (squadronNumber, eventId) => {
  await deleteDoc(squadronDoc(squadronNumber, COLLECTION, eventId));
};

/** Rename the cadet on an event. Used when a cadet is renamed. */
export const renameEventCadet = async (squadronNumber, eventId, cadetName) => {
  await updateDoc(squadronDoc(squadronNumber, COLLECTION, eventId), { cadetName });
};
