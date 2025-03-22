import React, { useState, useEffect } from "react";
import { fetchCollectionData } from "./firestoreUtils";
import { getFirestore, deleteDoc, doc } from "firebase/firestore/lite";
import Table from "./Table";
import Popup from "./Popup";
import "./TableDashboard.css";

const CadetsDashboard = () => {
  const [cadets, setCadets] = useState([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedCadet, setSelectedCadet] = useState(""); // Store the selected cadet's ID

  const cadetListColumns = [
    "Forename",
    "Surname",
    "Rank",
    "Flight",
    "Classification",
    "Start Date",
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

  useEffect(() => {
    const fetchCadets = async () => {
      const cadetsData = await fetchCollectionData("Cadets");
      setCadets(cadetsData);
    };

    fetchCadets();
  }, []);

  const handleDischarge = async () => {
    try {
      if (!selectedCadet) {
        alert("Please select a cadet to discharge.");
        return;
      }

      const db = getFirestore();
      await deleteDoc(doc(db, "Cadets", selectedCadet));

      const dischargedCadet = cadets.find((cadet) => cadet.id === selectedCadet);
      setSuccessMessage(`${dischargedCadet.forename} ${dischargedCadet.surname} successfully discharged`);

      // Automatically hide the success message after 1 second
      setTimeout(() => {
        setSuccessMessage("");
      }, 1000);

      // Close both popups
      setIsPopupOpen(false);
      setIsConfirmationOpen(false);
      setSelectedCadet("");

      // Refresh the cadets list
      const cadetsData = await fetchCollectionData("Cadets");
      setCadets(cadetsData);
    } catch (error) {
      console.error("Error discharging cadet:", error);
      alert("An error occurred while discharging the cadet.");
    }
  };

  const formattedCadets = cadets.map((cadet) => {
    return Object.keys(cadetListColumnMapping).reduce((acc, key) => {
      acc[key] = cadet[cadetListColumnMapping[key]];
      return acc;
    }, {});
  });

  return (
    <div className="table-dashboard-container">
      <div className="button-container">
        <span className="dashboard-table-title">Cadets List</span>
        <button className="table-button-red" onClick={() => setIsPopupOpen(true)}>
          Discharge Cadet
        </button>
        <button className="table-button">Add Cadet</button>
      </div>
      <Table columns={cadetListColumns} data={formattedCadets} />

      {/* Popup for Discharge Cadet */}
      <Popup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        onConfirm={() => setIsConfirmationOpen(true)} // Open confirmation popup
      >
        <h3>Discharge Cadet</h3>
        <p>Select the cadet to discharge:</p>
        <select
          value={selectedCadet}
          onChange={(e) => setSelectedCadet(e.target.value)}
        >
          <option value="">-- Select a Cadet --</option>
          {cadets.map((cadet) => (
            <option key={cadet.id} value={cadet.id}>
              {cadet.forename} {cadet.surname}
            </option>
          ))}
        </select>
      </Popup>

      {/* Confirmation Popup */}
      <Popup
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        onConfirm={handleDischarge}
      >
        <h3>Are you sure?</h3>
        <p>Do you really want to discharge this cadet?</p>
      </Popup>

      {/* Success Message */}
      {successMessage && (
        <div className="success-popup">
          {successMessage}
        </div>
      )}
    </div>
  );
};

export default CadetsDashboard;