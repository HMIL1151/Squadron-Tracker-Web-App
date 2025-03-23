import { getFirestore, collection, addDoc } from "firebase/firestore/lite";
import { fetchCollectionData } from "./firestoreUtils";
import React, { useState } from "react";
import Popup from "./Popup";

const AddCadet = ({
  user,
  setSuccessMessage,
  setCadets,
  classificationMap,
  flightMap,
  rankMap,
}) => {
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [newCadet, setNewCadet] = useState({
    forename: "",
    surname: "",
    startDate: "",
    classification: "",
    flight: "",
    rank: "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewCadet((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddCadet = async () => {
    try {
      const db = getFirestore();

      if (!user) {
        alert("User information is missing.");
        return;
      }

      const { forename, surname, startDate, classification, flight, rank } =
        newCadet;

      if (
        !forename ||
        !surname ||
        !startDate ||
        classification === "" ||
        flight === "" ||
        rank === ""
      ) {
        alert("Please fill in all fields.");
        return;
      }

      // Add the cadet to Firestore
      await addDoc(collection(db, "Cadets"), {
        addedBy: user.displayName,
        classification: parseInt(classification, 10),
        createdAt: new Date(),
        flight: parseInt(flight, 10),
        forename,
        rank: parseInt(rank, 10),
        startDate,
        surname,
      });

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
        classification: "",
        flight: "",
        rank: "",
      });

      // Refresh the cadets list
      const cadetsData = await fetchCollectionData("Cadets");
      setCadets(cadetsData);
    } catch (error) {
      console.error("Error adding cadet:", error);
      alert("An error occurred while adding the cadet.");
    }
  };

  return (
    <>
      {/* Button to open the Add Cadet popup */}
      <button className="table-button" onClick={() => setIsAddPopupOpen(true)}>
        Add Cadet
      </button>

      {/* Add Cadet Popup */}
      <Popup
        isOpen={isAddPopupOpen}
        onClose={() => setIsAddPopupOpen(false)}
        onConfirm={handleAddCadet}
      >
        <h3>Add Cadet</h3>
        <input
          type="text"
          name="forename"
          placeholder="Forename"
          value={newCadet.forename}
          onChange={handleInputChange}
        />
        <input
          type="text"
          name="surname"
          placeholder="Surname"
          value={newCadet.surname}
          onChange={handleInputChange}
        />
        <input
          type="date"
          name="startDate"
          placeholder="Start Date"
          value={newCadet.startDate}
          onChange={handleInputChange}
        />
        <select
          name="classification"
          value={newCadet.classification}
          onChange={handleInputChange}
        >
          <option value="">-- Select Classification --</option>
          {Object.entries(classificationMap).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </select>
        <select
          name="flight"
          value={newCadet.flight}
          onChange={handleInputChange}
        >
          <option value="">-- Select Flight --</option>
          {Object.entries(flightMap).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </select>
        <select
          name="rank"
          value={newCadet.rank}
          onChange={handleInputChange}
        >
          <option value="">-- Select Rank --</option>
          {Object.entries(rankMap).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </select>
      </Popup>
    </>
  );
};

export default AddCadet;