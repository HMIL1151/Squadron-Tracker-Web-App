import React, { useState, useEffect } from "react";
import { fetchCollectionData } from "./firestoreUtils";
import { rankMap, flightMap, classificationMap } from "./mappings";
import Table from "./Table";
import DischargeCadet from "./dischargeCadet"; // Import the DischargeCadet component
import AddCadet from "./addCadet"; // Import the AddCadet component
import "./TableDashboard.css";

const CadetsDashboard = ({ user }) => {
  const [cadets, setCadets] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");

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
      id: cadet.id, // Include the cadet's ID for discharge functionality
      "Service Length": serviceLength, // Add the calculated service length
    };
  });

  return (
    <div className="table-dashboard-container">
      <div className="button-container">
        <span className="dashboard-table-title">Cadets List</span>
        <DischargeCadet
          cadets={cadets}
          setCadets={setCadets}
          setSuccessMessage={setSuccessMessage}
        />
        <AddCadet
          user={user}
          setSuccessMessage={setSuccessMessage}
          setCadets={setCadets}
          classificationMap={classificationMap}
          flightMap={flightMap}
          rankMap={rankMap}
        />
      </div>
      <Table columns={cadetListColumns} data={formattedCadets} />

      {/* Success Message */}
      {successMessage && <div className="success-popup">{successMessage}</div>}
    </div>
  );
};

export default CadetsDashboard;