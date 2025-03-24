import React from "react";
import Popup from "./Popup";
import CadetForm from "./CadetForm";

const PopupManager = ({
  isPopupOpen,
  isConfirmationOpen,
  isAddPopupOpen,
  isEditPopupOpen, // New prop for edit popup
  setIsPopupOpen,
  setIsConfirmationOpen,
  setIsAddPopupOpen,
  setIsEditPopupOpen, // Setter for edit popup
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
        <Popup isOpen={isEditPopupOpen} onClose={() => setIsEditPopupOpen(false)}>
          <h2>Edit Cadet</h2>
          {selectedCadet ? (
            <div>
              <p><strong>Forename:</strong> {selectedCadet.forename}</p>
              <p><strong>Surname:</strong> {selectedCadet.surname}</p>
              <p><strong>Rank:</strong> {rankMap[selectedCadet.rank]}</p>
              <p><strong>Flight:</strong> {flightMap[selectedCadet.flight]}</p>
              <p><strong>Classification:</strong> {classificationMap[selectedCadet.classification]}</p>
              <p><strong>Start Date:</strong> {selectedCadet.startDate}</p>
            </div>
          ) : (
            <p>No cadet selected.</p>
          )}
        </Popup>
      )}
    </>
  );
};

export default PopupManager;