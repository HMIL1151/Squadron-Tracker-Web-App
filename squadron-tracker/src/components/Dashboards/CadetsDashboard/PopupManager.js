import React, { useState } from "react";
import Popup from "./Popup";
import SuccessMessage from "./SuccessMessage"; // Import SuccessMessage
import CadetForm from "./CadetForm";
import { doc, updateDoc, getFirestore } from "firebase/firestore"; // Import Firestore functions
import { app } from "../../../firebase/firebase"; // Correct import path for app

const PopupManager = ({
  isPopupOpen,
  isConfirmationOpen,
  isAddPopupOpen,
  isEditPopupOpen,
  setIsPopupOpen,
  setIsConfirmationOpen,
  setIsAddPopupOpen,
  setIsEditPopupOpen,
  handleDischarge,
  handleAddCadet,
  cadets,
  selectedCadet,
  setSelectedCadet,
  newCadet,
  handleInputChange,
  classificationMap,
  flightMap,
  rankMap,
}) => {
  const [editedCadet, setEditedCadet] = useState(selectedCadet || {});
  const [successMessage, setSuccessMessage] = useState(""); // State for success message
  const db = getFirestore(app); // Initialize Firestore using app

  // Update the editedCadet state when the selectedCadet changes
  React.useEffect(() => {
    setEditedCadet(selectedCadet || {});
  }, [selectedCadet]);

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditedCadet((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditCadet = async () => {
    if (!editedCadet.id) return;

    try {
      const cadetDocRef = doc(db, "Cadets", editedCadet.id); // Reference to the cadet's Firestore document
      await updateDoc(cadetDocRef, {
        forename: editedCadet.forename,
        surname: editedCadet.surname,
        rank: parseInt(editedCadet.rank, 10),
        flight: parseInt(editedCadet.flight, 10),
        classification: parseInt(editedCadet.classification, 10),
        startDate: editedCadet.startDate,
      });

      setSuccessMessage("Cadet information updated successfully!"); // Set success message
      setIsEditPopupOpen(false); // Close the popup
      setTimeout(() => setSuccessMessage(""), 3000); // Clear the message after 3 seconds
    } catch (error) {
      console.error("Error updating cadet:", error);
      alert("An error occurred while updating the cadet.");
    }
  };

  return (
    <>
      {/* Discharge Cadet Popup */}
      <Popup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        onConfirm={() => setIsConfirmationOpen(true)}
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

      {/* Add Cadet Popup */}
      <Popup
        isOpen={isAddPopupOpen}
        onClose={() => setIsAddPopupOpen(false)}
        onConfirm={handleAddCadet}
      >
        <h3>Add Cadet</h3>
        <CadetForm
          newCadet={newCadet}
          handleInputChange={handleInputChange}
          classificationMap={classificationMap}
          flightMap={flightMap}
          rankMap={rankMap}
        />
      </Popup>

      {/* Edit Cadet Popup */}
      {isEditPopupOpen && (
        <Popup
          isOpen={isEditPopupOpen}
          onClose={() => setIsEditPopupOpen(false)}
          onConfirm={handleEditCadet} // Use the confirm button to save changes
        >
          <h2>Edit Cadet</h2>
          {editedCadet ? (
            <form>
              <label>
                Forename:
                <input
                  type="text"
                  name="forename"
                  value={editedCadet.forename || ""}
                  onChange={handleEditInputChange}
                />
              </label>
              <label>
                Surname:
                <input
                  type="text"
                  name="surname"
                  value={editedCadet.surname || ""}
                  onChange={handleEditInputChange}
                />
              </label>
              <label>
                Rank:
                <select
                  name="rank"
                  value={editedCadet.rank || ""}
                  onChange={handleEditInputChange}
                >
                  {Object.entries(rankMap).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Flight:
                <select
                  name="flight"
                  value={editedCadet.flight || ""}
                  onChange={handleEditInputChange}
                >
                  {Object.entries(flightMap).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Classification:
                <select
                  name="classification"
                  value={editedCadet.classification || ""}
                  onChange={handleEditInputChange}
                >
                  {Object.entries(classificationMap).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Start Date:
                <input
                  type="date"
                  name="startDate"
                  value={editedCadet.startDate || ""}
                  onChange={handleEditInputChange}
                />
              </label>
            </form>
          ) : (
            <p>No cadet selected.</p>
          )}
        </Popup>
      )}

      {/* Success Message */}
      <SuccessMessage message={successMessage} />
    </>
  );
};

export default PopupManager;