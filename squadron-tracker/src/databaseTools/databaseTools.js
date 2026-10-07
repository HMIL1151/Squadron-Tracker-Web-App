import { useContext } from "react";
import { DataContext } from "../context/DataContext";
import { useSquadron } from "../context/SquadronContext";
import { newEventRef } from "../firebase/events";
import { setDoc } from "../firebase/db";

export const useSaveEvent = () => {
  const { data, setData } = useContext(DataContext); // Access the DataContext
  const { squadronNumber } = useSquadron(); // Access the squadron number from context

  /**
   * Saves one event per cadet named, per date given, skipping duplicates.
   *
   * Never alerts and never throws for input problems -- callers own the UI.
   * Returns { saved, skippedDuplicates, error }: `error` is a user-showable
   * message when nothing was attempted; `skippedDuplicates` lists cadets whose
   * event already existed.
   *
   * `dates` is optional and, when given, replaces `date`: "Joe did road
   * marching on the 3rd, the 10th and the 17th" is one form filled in once,
   * written as three records. Each date is checked for duplicates against the
   * log AND against the records written earlier in the same call, because
   * DataContext is not updated until the end -- without the second check, the
   * same date typed twice would be written twice. When several dates are
   * given, a skipped duplicate is reported with its date, since the name
   * alone no longer says which record was already there.
   *
   * `weaponName` marks a weapon handling test pass. It is only written when
   * set, so every other kind of record is stored exactly as before.
   *
   * `aviation` marks an Event/Other record as a flight or a glide (or, as
   * "none", as explicitly neither -- see utils/aviation.js). Same rule: only
   * written when set.
   */
  const saveEvent = async (eventDetails) => {
    const existingEvents = data.events; // Get the current events array

    const {
      addedBy,
      badgeCategory = "",
      badgeLevel = "",
      cadetName, // Now an array of names
      createdAt,
      date,
      dates,
      eventCategory = "",
      eventName = "",
      examName = "",
      specialAward = "",
      weaponName = "",
      aviation = "",
    } = eventDetails;

    const allDates = [...new Set((Array.isArray(dates) && dates.length ? dates : [date]).filter(Boolean))];

    if (!addedBy || !allDates.length || !cadetName || !createdAt || !Array.isArray(cadetName) || cadetName.length === 0) {
      console.error("Invalid event details provided.");
      return { saved: [], skippedDuplicates: [], error: "Missing event details." };
    }

    // Validate the dates
    const currentDate = new Date();
    const eightYearsAgo = new Date();
    eightYearsAgo.setFullYear(currentDate.getFullYear() - 8);
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(currentDate.getDate() + 7);

    const outOfRange = allDates.some((value) => {
      const eventDate = new Date(value);
      return eventDate < eightYearsAgo || eventDate > sevenDaysFromNow;
    });

    if (outOfRange) {
      return {
        saved: [],
        skippedDuplicates: [],
        error: "The event date must be no more than 8 years in the past and no more than 7 days in the future.",
      };
    }

    try {
      const newEvents = []; // To store the new events for DataContext
      const skippedDuplicates = [];

      for (const date of allDates) {
        for (const name of cadetName) {
          // Check for duplicates in the log, and in what this call has written
          const isDuplicate = [...existingEvents, ...newEvents].some((event) => {
            // Duplicate Badge
            if (badgeCategory && badgeLevel) {
              return (
                event.cadetName === name &&
                event.badgeCategory === badgeCategory &&
                event.badgeLevel === badgeLevel
              );
            }

            // Duplicate Exam
            else if (examName) {
              return event.cadetName === name && event.examName === examName;
            }

            // Duplicate Special
            else if (specialAward) {
              return (
                event.cadetName === name &&
                event.specialAward === specialAward &&
                event.date === date
              );
            }

            // General Duplicate
            else if (eventName) {
              return (
                event.cadetName === name &&
                event.eventName === eventName &&
                event.date === date
              );
            }

            // Duplicate weapon handling test: the same pass, recorded twice
            else if (weaponName) {
              return (
                event.cadetName === name &&
                event.weaponName === weaponName &&
                event.date === date
              );
            }

            return false;
          });

          if (isDuplicate) {
            skippedDuplicates.push(allDates.length > 1 ? `${name} (${date})` : name);
            continue; // Skip saving this event
          }

          // Create the new event
          const newEvent = {
            addedBy: addedBy,
            createdAt: createdAt,
            cadetName: name, // Use the current name from the array
            date: date,
            badgeCategory: badgeCategory,
            badgeLevel: badgeLevel,
            examName: examName,
            eventName: eventName,
            eventCategory: eventCategory,
            specialAward: specialAward,
            ...(weaponName ? { weaponName } : {}),
            ...(aviation ? { aviation } : {}),
          };

          const eventDocRef = newEventRef(squadronNumber);
          await setDoc(eventDocRef, newEvent);

          // Add the new event to the array for DataContext
          newEvents.push({
            ...newEvent,
            id: eventDocRef.id, // Include the document ID
          });
        }
      }

      // Update the events array in DataContext
      setData((prevData) => ({
        ...prevData,
        events: [...(prevData.events || []), ...newEvents], // Append the new events
      }));

      return { saved: newEvents.map((e) => e.cadetName), skippedDuplicates };
    } catch (error) {
      console.error("Error saving event details:", error);
      throw error;
    }
  };

  return saveEvent;
};