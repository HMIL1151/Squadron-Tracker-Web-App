//TODO: Mass add Cadets from old tracker/from CSV file

import React, { useState, useContext } from "react";
import { DataContext } from "../../../context/DataContext"; // Import DataContext
import { rankMap, classificationMap } from "../../../utils/mappings";
import Table from "../../Table/Table";
import PopupManager from "./CadetsDashboardPopupManager";
import SuccessMessage from "../Dashboard Components/SuccessMessage";
import ErrorMessage from "../Dashboard Components/ErrorMessage";
import "./CadetsDashboard.css";
import { useSquadron } from "../../../context/SquadronContext";
import { addCadet, removeCadet } from "../../../firebase/cadets";

const CadetsDashboard = ({ user }) => {
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isEditPopupOpen, setIsEditPopupOpen] = useState(false); // New state for edit popup
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedCadet, setSelectedCadet] = useState("");
  const { squadronNumber } = useSquadron(); // Get the squadron number from the utils
  const { data, setData } = useContext(DataContext); // Access cadets and events from DataContext
  const [newCadet, setNewCadet] = useState({
    forename: "",
    surname: "",
    startDate: "",
    classification: "",
    flight: "",
    rank: "",
  });

  const cadetListColumns = [
    "Forename",
    "Surname",
    "Rank",
    "Flight",
    "Classification",
    "Start Date",
    "Service Length",
  ];

  const cadetListColumnMapping = {
    Forename: "forename",
    Surname: "surname",
    Rank: "rank",
    Flight: "flight",
    Classification: "classification",
    "Start Date": "startDate",
    AddedBy: "addedBy",
    CreatedAt: "createdAt",
  };



  const handleDischarge = async () => {
    try {
      if (!selectedCadet) {
        setErrorMessage("Please select a cadet to discharge.");
        return;
      }

      await removeCadet(squadronNumber, selectedCadet);

      // Update the DataContext's cadets
      setData((prevData) => ({
        ...prevData,
        cadets: prevData.cadets.filter((cadet) => cadet.id !== selectedCadet),
      }));

      // Trigger the success message
      const dischargedCadet = data.cadets.find((cadet) => cadet.id === selectedCadet);
      setSuccessMessage(`${dischargedCadet.forename} ${dischargedCadet.surname} successfully discharged.`);
      setTimeout(() => setSuccessMessage(""), 1000); // Automatically hide after 1 second

      // Close both popups
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



      // Helper function to capitalize each word in a string
      const capitalizeWords = (str) => {
        return str
            .split(" ") // Split by spaces first
            .map((word) =>
                word
                    .split("-") // Split by hyphens within each word
                    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                    .join("-") // Rejoin hyphenated parts
            )
            .join(" "); // Rejoin the words with spaces
      };

      // Format the forename and surname
      forename = capitalizeWords(forename.trim());
      surname = capitalizeWords(surname.trim());

      // Format the startDate to "YYYY-MM-DD"
      const date = new Date(startDate);
      const formattedStartDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      const newCadetData = {
        forename,
        surname,
        startDate: formattedStartDate,
        flight: parseInt(flight, 10),
        rank: parseInt(rank, 10),
        addedBy: user.displayName,
        createdAt: new Date(),
      };

      const newCadetId = await addCadet(squadronNumber, newCadetData);

      // Update the DataContext's cadets
      setData((prevData) => ({
        ...prevData,
        cadets: [...prevData.cadets, { id: newCadetId, ...newCadetData }],
      }));

      // Trigger the success message
      setSuccessMessage(`${forename} ${surname} successfully added.`);
      setTimeout(() => setSuccessMessage(""), 1000); // Automatically hide after 1 second

      // Close the Add Cadet popup
      setIsAddPopupOpen(false);

      // Reset the form fields
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

  // NOTE: a handleEditCadet lived here and was passed to PopupManager, but
  // PopupManager never destructured that prop -- it defines and uses its own.
  // The copy here was unreachable, so it has been removed; editing is handled
  // in CadetsDashboardPopupManager.

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewCadet((prev) => ({ ...prev, [name]: value }));
  };

  const handleRowClick = (cadetId) => {
    const cadet = data.cadets.find((c) => c.id === cadetId); // Find the selected cadet

    if (cadet) {
      setSelectedCadet({
        ...cadet,
        addedBy: cadet.addedBy || "Unknown", // Ensure addedBy is set
        createdAt: cadet.createdAt || null, // Ensure createdAt is set
      });
    }

    setIsEditPopupOpen(true); // Open the edit popup
  };

  const formattedCadets = data.cadets.map((cadet) => {

    const serviceLength = (() => {
      if (!cadet.startDate) return "N/A";

      const [year, month, day] = cadet.startDate.split("-").map(Number);
      const startDate = new Date(year, month - 1, day);
      const today = new Date();

      let years = today.getFullYear() - startDate.getFullYear();
      let months = today.getMonth() - startDate.getMonth();
      let days = today.getDate() - startDate.getDate();

      if (days < 0) {
        months -= 1;
        days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
      }

      if (months < 0) {
        years -= 1;
        months += 12;
      }

      return `${years} Yrs, ${months} Mos, ${days} Days`;
    })();

    // Calculate classification dynamically
    const matchingEvents = data.events.filter(
      (event) =>
        event.cadetName === `${cadet.forename} ${cadet.surname}` &&
        event.examName !== ""
    );

    let classificationCount = matchingEvents.length + 1;

    if (classificationCount > 12) {
      classificationCount = 12; // Cap at 13
    }
    
    return {
      ...Object.keys(cadetListColumnMapping).reduce((acc, key) => {
        acc[key] = cadet[cadetListColumnMapping[key]];
        return acc;
      }, {}),
      Classification: classificationMap[classificationCount] || classificationCount, // Map classification to its label or use the count
      "Service Length": serviceLength,
      id: cadet.id,
    };
  });


  return (
    <div className="table-dashboard-container">
      <div className="button-container">
        <button className="button-red" onClick={() => setIsPopupOpen(true)}>
          Discharge Cadet
        </button>
        <button className="button-green" onClick={() => setIsAddPopupOpen(true)}>
          Add Cadet
        </button>
      </div>
      <Table
        columns={cadetListColumns}
        data={formattedCadets}
        onRowClick={(row) => handleRowClick(row.id)}
        disableHover={false} // Pass the row click handler
        width="95%"
      />
      {/* Add text below the table to display the number of cadets */}
      <div className="cadet-count">
        <p>Total Cadets: {formattedCadets.length}</p>
      </div>
      <PopupManager
        isPopupOpen={isPopupOpen}
        isConfirmationOpen={isConfirmationOpen}
        isAddPopupOpen={isAddPopupOpen}
        isEditPopupOpen={isEditPopupOpen} // Pass the new popup state
        setIsPopupOpen={setIsPopupOpen}
        setIsConfirmationOpen={setIsConfirmationOpen}
        setIsAddPopupOpen={setIsAddPopupOpen}
        setIsEditPopupOpen={setIsEditPopupOpen} // Pass the setter for the new popup
        handleDischarge={handleDischarge}
        handleAddCadet={handleAddCadet}
        cadets={data.cadets}
        setCadets={() => {}} // No need to update cadets directly
        selectedCadet={selectedCadet}
        setSelectedCadet={setSelectedCadet}
        newCadet={newCadet}
        handleInputChange={handleInputChange}
        classificationMap={classificationMap}
        rankMap={rankMap}
      />
      <SuccessMessage message={successMessage} />
      <ErrorMessage message={errorMessage} />
    </div>
  );
};

export default CadetsDashboard;