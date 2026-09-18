import { useContext, useState } from "react";
import { DataContext } from "../../../context/DataContext";
import { useSquadron } from "../../../context/SquadronContext";
import { addCadet, removeCadet } from "../../../firebase/cadets";

/**
 * Adding, discharging and editing cadets, minus how any of it looks.
 *
 * Lifted out of CadetsDashboard when the Muster interface needed the same
 * writes. Both interfaces call this and both open the same PopupManager, so
 * there is one implementation of "discharge a cadet" rather than two -- which
 * matters here more than on most screens, because discharging is destructive
 * and the second copy is always the one that skips the confirmation.
 *
 * Moved as-is, including the capitalisation rules and the 1-second success
 * messages. The classic screen's snapshot is the evidence that nothing moved.
 */
export const useCadetList = (user) => {
  const { squadronNumber } = useSquadron();
  const { data, setData } = useContext(DataContext);

  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedCadet, setSelectedCadet] = useState("");
  const [newCadet, setNewCadet] = useState({
    forename: "",
    surname: "",
    startDate: "",
    classification: "",
    flight: "",
    rank: "",
  });

  const handleDischarge = async () => {
    try {
      if (!selectedCadet) {
        setErrorMessage("Please select a cadet to discharge.");
        return;
      }

      await removeCadet(squadronNumber, selectedCadet);

      setData((prevData) => ({
        ...prevData,
        cadets: prevData.cadets.filter((cadet) => cadet.id !== selectedCadet),
      }));

      const dischargedCadet = data.cadets.find((cadet) => cadet.id === selectedCadet);
      setSuccessMessage(`${dischargedCadet.forename} ${dischargedCadet.surname} successfully discharged.`);
      setTimeout(() => setSuccessMessage(""), 1000); // Automatically hide after 1 second

      setIsPopupOpen(false);
      setIsConfirmationOpen(false);
      setSelectedCadet("");
    } catch (error) {
      console.error("Error discharging cadet:", error);
      setErrorMessage("An error occurred while discharging the cadet.");
    }
  };

  const handleAddCadet = async () => {
    try {
      if (!user) {
        setErrorMessage("User information is missing.");
        return;
      }

      let { forename, surname, startDate, flight, rank } = newCadet;

      if (!forename || !surname || !startDate || flight === "" || rank === "") {
        setErrorMessage("Please fill in all fields.");
        return;
      }

      // Capitalise each word, and each hyphenated part within a word, so
      // "mary-jane o'brien" files next to the rest of the squadron.
      const capitalizeWords = (str) =>
        str
          .split(" ")
          .map((word) =>
            word
              .split("-")
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
              .join("-")
          )
          .join(" ");

      forename = capitalizeWords(forename.trim());
      surname = capitalizeWords(surname.trim());

      const date = new Date(startDate);
      const formattedStartDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      const newCadetData = {
        forename,
        surname,
        startDate: formattedStartDate,
        /*
         * `flight` is a 1-BASED INDEX into the squadron's flights array, not
         * an id. Stored as a number because everything downstream compares it
         * numerically.
         */
        flight: parseInt(flight, 10),
        rank: parseInt(rank, 10),
        addedBy: user.displayName,
        createdAt: new Date(),
      };

      const newCadetId = await addCadet(squadronNumber, newCadetData);

      setData((prevData) => ({
        ...prevData,
        cadets: [...prevData.cadets, { id: newCadetId, ...newCadetData }],
      }));

      setSuccessMessage(`${forename} ${surname} successfully added.`);
      setTimeout(() => setSuccessMessage(""), 1000); // Automatically hide after 1 second

      setIsAddPopupOpen(false);

      setNewCadet({
        forename: "",
        surname: "",
        startDate: "",
        flight: "",
        rank: "",
      });
    } catch (error) {
      console.error("Error adding cadet:", error);
      setErrorMessage("An error occurred while adding the cadet.");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewCadet((prev) => ({ ...prev, [name]: value }));
  };

  /** Opens the edit popup for one cadet. */
  const handleRowClick = (cadetId) => {
    const cadet = data.cadets.find((c) => c.id === cadetId);

    if (cadet) {
      setSelectedCadet({
        ...cadet,
        addedBy: cadet.addedBy || "Unknown",
        createdAt: cadet.createdAt || null,
      });
    }

    setIsEditPopupOpen(true);
  };

  return {
    data,
    isAddPopupOpen,
    setIsAddPopupOpen,
    isPopupOpen,
    setIsPopupOpen,
    isConfirmationOpen,
    setIsConfirmationOpen,
    isEditPopupOpen,
    setIsEditPopupOpen,
    successMessage,
    errorMessage,
    selectedCadet,
    setSelectedCadet,
    newCadet,
    handleDischarge,
    handleAddCadet,
    handleInputChange,
    handleRowClick,
  };
};

export default useCadetList;
