import React, { useState, useEffect } from "react";
import { fetchCollectionData } from "../../../firebase/firestoreUtils";
import { getFirestore, collection, addDoc, doc, deleteDoc, query, where, getDocs } from "firebase/firestore/lite";
import { rankMap, flightMap, classificationMap } from "../../../utils/mappings";
import Table from "../../Table/Table";
import PopupManager from "./CadetsDashboardPopupManager";
import SuccessMessage from "../SuccessMessage";
import "./CadetsDashboard.css";

const CadetsDashboard = ({ user }) => {
  const [cadets, setCadets] = useState([]);
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isEditPopupOpen, setIsEditPopupOpen] = useState(false); // New state for edit popup
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedCadet, setSelectedCadet] = useState("");
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

      // Format the startDate to "DD-MM-YYYY"
      const date = new Date(startDate);
      const formattedStartDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;


      // Query Firestore to check if a cadet with the same forename and surname exists
      const cadetsRef = collection(db, "Cadets");
      const q = query(cadetsRef, where("forename", "==", forename), where("surname", "==", surname));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        alert("A cadet with this name already exists.");
        return;
      }

      await addDoc(collection(db, "Cadets"), {
        addedBy: user.displayName,
        classification: parseInt(classification, 10),
        createdAt: new Date(),
        flight: parseInt(flight, 10),
        forename,
        rank: parseInt(rank, 10),
        startDate: formattedStartDate, // Use the formatted date here
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

  const handleRowClick = (cadetId) => {
    const cadet = cadets.find((c) => c.id === cadetId); // Find the selected cadet
    setSelectedCadet(cadet); // Set the selected cadet's data
    setIsEditPopupOpen(true); // Open the edit popup
  };

  const formattedCadets = cadets.map((cadet) => {
    const serviceLength = (() => {
      if (!cadet.startDate) return "N/A";

            // Parse the startDate in "YYYY-MM-DD" format
      const [year, month, day] = cadet.startDate.split("-").map(Number);
      const startDate = new Date(year, month - 1, day); // Create a valid Date object
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
      id: cadet.id, // Include the cadet ID for row click handling
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
      <Table
        columns={cadetListColumns}
        data={formattedCadets}
        onRowClick={(row) => handleRowClick(row.id)}
        disableHover={false} // Pass the row click handler
        width="95%"
      />
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
        cadets={cadets}
        setCadets={setCadets} // Pass setCadets to PopupManager
        selectedCadet={selectedCadet}
        setSelectedCadet={setSelectedCadet}
        newCadet={newCadet}
        handleInputChange={handleInputChange}
        classificationMap={classificationMap}
        flightMap={flightMap}
        rankMap={rankMap}
      />
      <SuccessMessage message={successMessage} />
    </div>
  );
};

export default CadetsDashboard;