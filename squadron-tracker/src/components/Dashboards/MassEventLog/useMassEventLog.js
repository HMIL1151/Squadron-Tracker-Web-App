import { useContext, useEffect, useMemo, useState } from "react";
import { useSquadron } from "../../../context/SquadronContext";
import { DataContext } from "../../../context/DataContext";
import { removeEvent } from "../../../firebase/events";
import { useSaveEvent } from "../../../databaseTools/databaseTools";
import { getEventDescription, getEventPoints } from "../../../utils/points";

/**
 * Everything the event log does, minus how it looks.
 *
 * Lifted out of MassEventLog.jsx when the Muster interface arrived. Both
 * interfaces render this hook; neither owns the behaviour. That matters more
 * than it sounds, because the two screens will live side by side for as long
 * as the classic interface is kept: without this, "add a record" would be
 * implemented twice, and the second implementation would be the one that
 * forgets the duplicate handling below.
 *
 * Moved as-is. The add flow keeps its slightly awkward shape -- the typeahead
 * state, the four-way `selectedButton`, the cadet name that is an ARRAY on the
 * way into saveEvent and a string on the way out -- because changing behaviour
 * and changing interface in the same commit means neither can be reviewed. The
 * classic screen's snapshot is the evidence that nothing moved.
 */
export const useMassEventLog = (user) => {
  const { squadronNumber } = useSquadron();
  const { data, setData } = useContext(DataContext);
  const saveEvent = useSaveEvent();

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedNames, setSelectedNames] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [filteredNames, setFilteredNames] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [eventDate, setEventDate] = useState("");
  /*
   * Dates beyond the first, for "did road marching on the 3rd, 10th and
   * 17th". Kept apart from eventDate rather than turning it into an array,
   * so the classic popup -- which never offers a second date -- sees exactly
   * the state it always has.
   */
  const [extraDates, setExtraDates] = useState([]);
  const [selectedButton, setSelectedButton] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEventPopupOpen, setIsEventPopupOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const names = useMemo(
    () => (data.cadets || []).map((cadet) => `${cadet.forename} ${cadet.surname}`),
    [data.cadets]
  );

  /*
   * Reset the add-record form whenever the underlying data changes.
   *
   * This was one of two effects in the original that both keyed off `data`;
   * the other built the rows. Kept separate rather than merged, because they
   * do unrelated things and merging them would change when the form clears.
   */
  useEffect(() => {
    if (!squadronNumber) {
      console.error("Squadron number is not set.");
      return;
    }
    setSelectedNames([]);
    setFilteredNames([]);
    setHighlightedIndex(-1);
    setEventDate("");
    setExtraDates([]);
    setInputValue("");
    setSelectedButton(null);
  }, [data, squadronNumber]);

  /*
   * The rows. A memo rather than the original's effect-into-state, which
   * rendered once with the previous data before catching up. Same output.
   */
  const events = useMemo(() => {
    const flightPoints = data.flightPoints || {};
    return (data.events || []).map((event) => ({
      Name: event.cadetName || "Unknown",
      Record: getEventDescription(event),
      Date: event.date || "N/A",
      Points: getEventPoints(event, flightPoints),
      AddedBy: event.addedBy || "Unknown",
      CreatedAt: event.createdAt || "N/A",
      id: event.id || "N/A",
      eventCategory: event.eventCategory || "",
    }));
  }, [data.events, data.flightPoints]);

  useEffect(() => {
    setLoading(!squadronNumber);
  }, [squadronNumber, data]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    if (value) {
      setFilteredNames(
        names.filter((name) => name.toLowerCase().includes(value.toLowerCase()))
      );
      setHighlightedIndex(-1);
    } else {
      setFilteredNames([]);
    }
  };

  const handleDateChange = (e) => setEventDate(e.target.value);

  const addDate = () => setExtraDates((prev) => [...prev, ""]);
  const handleExtraDateChange = (index, value) =>
    setExtraDates((prev) => prev.map((current, i) => (i === index ? value : current)));
  const removeDate = (index) => setExtraDates((prev) => prev.filter((_, i) => i !== index));

  const handleNameSelect = (name) => {
    if (!selectedNames.includes(name)) {
      setSelectedNames((prev) => [...prev, name]);
    }
    setInputValue("");
    setFilteredNames([]);
    setHighlightedIndex(-1);
  };

  const handleRemoveName = (name) =>
    setSelectedNames((prev) => prev.filter((n) => n !== name));

  const handleKeyDown = (e) => {
    if (filteredNames.length > 0) {
      if (e.key === "ArrowDown") {
        setHighlightedIndex((prev) => (prev + 1) % filteredNames.length);
      } else if (e.key === "ArrowUp") {
        setHighlightedIndex((prev) =>
          prev === -1
            ? filteredNames.length - 1
            : (prev - 1 + filteredNames.length) % filteredNames.length
        );
      } else if (e.key === "Enter") {
        if (highlightedIndex >= 0 && highlightedIndex < filteredNames.length) {
          handleNameSelect(filteredNames[highlightedIndex]);
        }
      }
    }
  };

  const handleButtonSelect = (buttonText) => setSelectedButton(buttonText);

  const handleAddEvent = async (eventData) => {
    const {
      selectedBadgeType,
      selectedBadgeLevel,
      selectedExam,
      freeText,
      selectedEventCategory,
      selectedSpecialAward,
    } = eventData;

    if (!selectedNames.length) {
      setErrorMessage("Please select at least one name.");
      return;
    }

    if (!eventDate) {
      setErrorMessage("Please select a date.");
      return;
    }

    const dates = [eventDate, ...extraDates.filter(Boolean)];

    // A badge or exam is passed once; a second date could only be a duplicate.
    if (
      dates.length > 1 &&
      (selectedButton === "Badge" || selectedButton === "Classification/Exam")
    ) {
      setErrorMessage("A badge or exam is only passed once. Remove the extra dates.");
      return;
    }

    try {
      const newEvent = {
        addedBy: user.displayName,
        createdAt: new Date(),
        cadetName: selectedNames,
        date: eventDate,
        dates,
        badgeCategory: selectedButton === "Badge" ? selectedBadgeType : "",
        badgeLevel: selectedButton === "Badge" ? selectedBadgeLevel : "",
        examName: selectedButton === "Classification/Exam" ? selectedExam : "",
        eventName: selectedButton === "Event/Other" ? freeText : "",
        eventCategory: selectedButton === "Event/Other" ? selectedEventCategory : "",
        specialAward: selectedButton === "Special" ? selectedSpecialAward : "",
      };

      const { saved, skippedDuplicates, error } = await saveEvent(newEvent);

      if (error) {
        setErrorMessage(error);
        return;
      }

      setSelectedNames([]);
      setInputValue("");
      setEventDate("");
      setExtraDates([]);
      setSelectedButton(null);
      setIsPopupOpen(false);
      setErrorMessage("");

      // Duplicates were previously only a console warning, so a save that
      // silently did nothing still reported success.
      if (skippedDuplicates.length && !saved.length) {
        setErrorMessage(`Already recorded for ${skippedDuplicates.join(", ")}.`);
      } else if (skippedDuplicates.length) {
        setSuccessMessage(
          `Event added. Already recorded for ${skippedDuplicates.join(", ")}.`
        );
      } else if (saved.length > 1 && dates.length > 1) {
        setSuccessMessage(`${saved.length} records added.`);
      } else {
        setSuccessMessage("Event added successfully!");
      }
    } catch (error) {
      console.error("Error adding event:", error);
      setErrorMessage("An error occurred while adding the event. Please try again.");
    }
  };

  const handleRowClick = (eventData) => {
    setSelectedEvent(eventData);
    setIsEventPopupOpen(true);
  };

  const handleRemoveEvent = async (eventId) => {
    try {
      if (!eventId) {
        console.error("Invalid event ID. Cannot remove event.");
      }

      if (!squadronNumber) {
        console.error("Squadron number is not set. Cannot remove event.");
      }

      await removeEvent(squadronNumber, eventId);

      // Drop it from DataContext, which is what the rows are derived from.
      setData((prevData) => ({
        ...prevData,
        events: (prevData.events || []).filter((event) => {
          if (!event || typeof event !== "object") {
            console.warn("Skipping invalid event:", event);
            return false;
          }
          return event.id !== eventId;
        }),
      }));

      setIsEventPopupOpen(false);
    } catch (error) {
      console.error("Error removing event:", error);
      setErrorMessage("An error occurred while removing the event. Please try again.");
    }
  };

  /** The lists the add-record popup needs, all from flightPoints. */
  const badgeTypes = data.flightPoints?.Badges?.["Badge Types"] || [];
  const eventCategories = Object.keys(data.flightPoints?.["Event Category Points"] || {});
  const specialAwards = data.flightPoints?.["Special Awards"]?.["Special Awards"] || [];

  return {
    events,
    loading,
    badgeTypes,
    eventCategories,
    specialAwards,
    // add-record popup
    isPopupOpen,
    openPopup: () => setIsPopupOpen(true),
    closePopup: () => setIsPopupOpen(false),
    inputValue,
    filteredNames,
    highlightedIndex,
    selectedNames,
    eventDate,
    extraDates,
    addDate,
    handleExtraDateChange,
    removeDate,
    handleInputChange,
    handleKeyDown,
    handleNameSelect,
    handleRemoveName,
    handleDateChange,
    handleButtonSelect,
    handleAddEvent,
    // details popup
    isEventPopupOpen,
    selectedEvent,
    handleRowClick,
    closeEventPopup: () => setIsEventPopupOpen(false),
    handleRemoveEvent,
    // messages
    successMessage,
    errorMessage,
  };
};

export default useMassEventLog;
