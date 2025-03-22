import React, { useState, useEffect } from "react";
import { fetchCollectionData } from "./firestoreUtils";
import Table from "./Table";
import "./TableDashboard.css";

const CadetsDashboard = () => {
  const [cadets, setCadets] = useState([]);

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
        <button className="table-button-red">Discharge Cadet</button>
        <button className="table-button">Add Cadet</button>
      </div>
      <Table columns={cadetListColumns} data={formattedCadets} />
    </div>
  );
  
  
  
  
};

export default CadetsDashboard;