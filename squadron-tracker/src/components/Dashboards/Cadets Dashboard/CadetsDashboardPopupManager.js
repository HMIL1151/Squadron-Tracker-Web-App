import React, { useState } from "react";
import Popup from "../Dashboard Components/Popup";
import SuccessMessage from "../Dashboard Components/SuccessMessage"; // Import SuccessMessage
import CadetForm from "./CadetForm";
import { doc, updateDoc, getFirestore } from "firebase/firestore"; // Import Firestore functions
import { app } from "../../../firebase/firebase"; // Correct import path for app
import { fetchCollectionData } from "../../../firebase/firestoreUtils"; // Import fetchCollectionData
import { useSquadron } from "../../../context/SquadronContext";

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
  setCadets, // Add setCadets to update the cadets list
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
  const { squadronNumber } = useSquadron(); // Access the squadron number from context

  // Update the editedCadet state when the selectedCadet changes
  React.useEffect(() => {
    if (selectedCadet) {
      // Ensure startDate is in the correct format (YYYY-MM-DD)
      const formattedStartDate = selectedCadet.startDate; // Assuming it's already in YYYY-MM-DD format

      setEditedCadet({
        ...selectedCadet,
        startDate: formattedStartDate, // Pass the formatted date
      });
    } else {
      setEditedCadet({});
    }
  }, [selectedCadet]);

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditedCadet((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditCadet = async () => {
    if (!editedCadet.id) return;

    try {
      const cadetDocRef = doc(db, "Squadron Databases", squadronNumber.toString(), "Cadets", editedCadet.id); // Reference to the cadet's Firestore document
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

      // Refresh the cadets list
      const cadetsData = await fetchCollectionData("Squadron Databases", squadronNumber.toString(),"Cadets");
      setCadets(cadetsData); // Update the cadets state

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
        <h3>Are You Sure?</h3>
        <p>Do you really want to discharge this cadet?</p>
      </Popup>

      {/* Add Cadet Popup */}
      <Popup
        isOpen={isAddPopupOpen}
        onClose={() => setIsAddPopupOpen(false)}
        onConfirm={handleAddCadet}
      >
        <h2>Add Cadet</h2>
        <CadetForm
          newCadet={newCadet}
          handleInputChange={handleInputChange}
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
            <>
              <CadetForm
                newCadet={editedCadet} // Pass the edited cadet object
                handleInputChange={handleEditInputChange} // Handle input changes
                classificationMap={classificationMap}
                flightMap={flightMap}
                rankMap={rankMap}
              />
              {/* Display addedBy and createdAt at the bottom */}
              <div style={{ marginTop: "0px", fontSize: "0.9em", color: "#555" }}> {/* Reduced marginTop */}
                <p><strong>Added By:</strong> {editedCadet.addedBy || "Unknown"}</p>
                <p>
                  <strong>Created At:</strong>{" "}
                  {editedCadet.createdAt && editedCadet.createdAt.seconds
                    ? new Date(editedCadet.createdAt.seconds * 1000).toLocaleString()
                    : "Unknown"}
                </p>
              </div>
            </>
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