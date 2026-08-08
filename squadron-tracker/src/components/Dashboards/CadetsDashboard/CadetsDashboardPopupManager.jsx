import React, { useState, useContext } from "react";
import Popup from "../DashboardComponents/Popup";
import SuccessMessage from "../DashboardComponents/SuccessMessage"; // Import SuccessMessage
import ErrorMessage from "../DashboardComponents/ErrorMessage";
import CadetForm from "./CadetForm";
import { updateCadet } from "../../../firebase/cadets";
import { renameEventCadet } from "../../../firebase/events";
import { useSquadron } from "../../../context/SquadronContext";
import { DataContext } from "../../../context/DataContext"; // Import DataContext

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
  rankMap,
}) => {
  const [editedCadet, setEditedCadet] = useState(selectedCadet || {});
  const [successMessage, setSuccessMessage] = useState(""); // State for success message
  const [errorMessage, setErrorMessage] = useState("");
  const { squadronNumber } = useSquadron(); // Access the squadron number from context
  const { setData } = useContext(DataContext); // Access setData from DataContext

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
    try {
        if (!editedCadet || !editedCadet.id) {
            setErrorMessage("Invalid cadet data. Cannot edit.");
            return;
        }

        // Construct the old cadet name from the selectedCadet (before editing)
        const oldCadetName = `${selectedCadet.forename} ${selectedCadet.surname}`;

        // Construct the new cadet name from the editedCadet (after editing)
        const newCadetName = `${editedCadet.forename} ${editedCadet.surname}`;

        // Update events in the DataContext where cadetName matches the old cadet name
        setData((prevData) => {

            // Update only the identified events
            const updatedEvents = prevData.events.map((event) => {
                if (event.cadetName === oldCadetName) {
                  renameEventCadet(squadronNumber, event.id, newCadetName);
                    return { ...event, cadetName: newCadetName }; // Update cadetName
                }
                return event; // Leave other events unchanged
            });

            return {
                ...prevData,
                events: updatedEvents, // Update the events array in the DataContext
            };
        });

        
        // Exclude the `createdAt` field from the update
        const { id, createdAt, ...cadetData } = editedCadet; // Exclude `id` and `createdAt`

        await updateCadet(squadronNumber, editedCadet.id, cadetData);

        // Update the DataContext's cadets
        setData((prevData) => ({
            ...prevData,
            cadets: prevData.cadets.map((cadet) =>
                cadet.id === editedCadet.id ? { ...cadet, ...cadetData } : cadet
            ),
        }));

        // Trigger the success message
        setSuccessMessage(`${editedCadet.forename} ${editedCadet.surname} successfully updated.`);
        setTimeout(() => setSuccessMessage(""), 1000); // Automatically hide after 1 second

        // Close the edit popup
        setIsEditPopupOpen(false);
        setSelectedCadet(""); // Clear the selected cadet
    } catch (error) {
        console.error("Error editing cadet:", error); // Debugging: Log any errors
        setErrorMessage("An error occurred while editing the cadet.");
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
      <ErrorMessage message={errorMessage} />
    </>
  );
};

export default PopupManager;