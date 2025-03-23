import React, { useState } from "react";
import { getFirestore, deleteDoc, doc } from "firebase/firestore/lite";
import { fetchCollectionData } from "./firestoreUtils";
import Popup from "./Popup";

const DischargeCadet = ({ cadets, setCadets, setSuccessMessage }) => {
  const [isSelectCadetPopupOpen, setIsSelectCadetPopupOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [selectedCadet, setSelectedCadet] = useState(null);

  const handleDischargeCadet = async () => {
    try {
      const db = getFirestore();

      if (!selectedCadet) {
        alert("No cadet selected for discharge.");
        return;
      }

      // Delete the cadet from Firestore
      await deleteDoc(doc(db, "Cadets", selectedCadet));

      // Trigger the success message
      setSuccessMessage("Cadet successfully discharged.");
      setTimeout(() => setSuccessMessage(""), 1000); // Automatically hide after 1 second

      // Close the confirmation popup
      setIsConfirmationOpen(false);

      // Refresh the cadets list
      const cadetsData = await fetchCollectionData("Cadets");
      setCadets(cadetsData);
    } catch (error) {
      console.error("Error discharging cadet:", error);
      alert("An error occurred while discharging the cadet.");
    }
  };

  return (
    <>
      {/* Button to open the select cadet popup */}
      <button
        className="table-button-red"
        onClick={() => setIsSelectCadetPopupOpen(true)}
      >
        Discharge Cadet
      </button>

      {/* Select Cadet Popup */}
      <Popup
        isOpen={isSelectCadetPopupOpen}
        onClose={() => setIsSelectCadetPopupOpen(false)}
        onConfirm={() => {
          if (selectedCadet) {
            setIsSelectCadetPopupOpen(false);
            setIsConfirmationOpen(true); // Open the confirmation popup
          } else {
            alert("Please select a cadet to discharge.");
          }
        }}
      >
        <h3>Select Cadet to Discharge</h3>
        <select
          value={selectedCadet || ""}
          onChange={(e) => setSelectedCadet(e.target.value)}
        >
          <option value="">-- Select Cadet --</option>
          {cadets.map((cadet) => (
            <option key={cadet.id} value={cadet.id}>
              {cadet.forename} {cadet.surname}
            </option>
          ))}
        </select>
      </Popup>

      {/* Discharge Confirmation Popup */}
      <Popup
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        onConfirm={handleDischargeCadet}
      >
        <h3>Confirm Discharge</h3>
        <p>Are you sure you want to discharge this cadet?</p>
      </Popup>
    </>
  );
};

export default DischargeCadet;