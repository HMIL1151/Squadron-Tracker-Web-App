import React, { useState, useEffect } from "react";
import { fetchCollectionData } from "../../../firebase/firestoreUtils";
import { getFirestore, collection, addDoc, deleteDoc, doc } from "firebase/firestore/lite";
import { rankMap, flightMap, classificationMap } from "../../../utils/mappings";
import Table from "../../Table/Table";
import Popup from "./Popup";
import "./CadetsDashboard.css";

const CadetsDashboard = ({ user }) => {
  const [cadets, setCadets] = useState([]);
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedCadet, setSelectedCadet] = useState(""); // Store the selected cadet's ID
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
    "Service Length"
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


  const handleAddCadet = async () => {
    try {
      const db = getFirestore();
      if (!user) {
        alert("User information is missing.");
        return;
      }
      const { forename, surname, startDate, classification, flight, rank } = newCadet;

      if (!forename || !surname || !startDate || classification === "" || flight === "" || rank === "") {
        alert("Please fill in all fields.");
        return;
      }

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewCadet((prev) => ({ ...prev, [name]: value }));
  };


  const formattedCadets = cadets.map((cadet) => {
    const serviceLength = (() => {
      if (!cadet.startDate) return "N/A";
      const startDate = new Date(cadet.startDate);
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

    return {
      ...Object.keys(cadetListColumnMapping).reduce((acc, key) => {
      acc[key] = cadet[cadetListColumnMapping[key]];
      return acc;
    }, {}),
    "Service Length": serviceLength, // Add the calculated service length
  };
  });

  return (
    <div className="table-dashboard-container">
      <div className="button-container">
        <button className="table-button-red" onClick={() => setIsPopupOpen(true)}>
          Discharge Cadet
        </button>
        <button className="table-button" onClick={() => setIsAddPopupOpen(true)}>
          Add Cadet
        </button>
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