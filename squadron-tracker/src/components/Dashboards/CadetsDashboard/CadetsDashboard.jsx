//TODO: Mass add Cadets from old tracker/from CSV file

import React from "react";
import { rankMap, classificationMap } from "../../../utils/mappings";
import Table from "../../Table/Table";
import PopupManager from "./CadetsDashboardPopupManager";
import SuccessMessage from "../DashboardComponents/SuccessMessage";
import ErrorMessage from "../DashboardComponents/ErrorMessage";
import shared from "../DashboardComponents/dashboardStyles.module.css";
import useCadetList from "./useCadetList";
/*
 * Imported for its position in the module graph, not for a class name.
 *
 * This file referenced `styles` until the writes moved to useCadetList.
 * CadetForm imports the same stylesheet, so the rules still arrive without
 * this line -- but they arrive LATER, and several of them compete with rules
 * in other dashboards' stylesheets, where the winner is decided by load order
 * (docs/styling-cascade.md).
 *
 * Keeping the import holds the order exactly as it was rather than betting
 * that nothing depended on it. Safe to remove once the collisions listed in
 * src/test/cssShape.test.js are gone.
 */
import "./CadetsDashboard.module.css";
import table from "../../Table/Table.module.css";

/**
 * The classic cadet list.
 *
 * The writes moved to useCadetList when the Muster interface needed them; what
 * is left here is this screen's own markup and its row formatting. The
 * snapshot is the evidence that the extraction moved nothing.
 */
const CadetsDashboard = ({ user }) => {
  const {
    data,
    isAddPopupOpen,
    setIsAddPopupOpen,
    isPopupOpen,
    setIsPopupOpen,
    isConfirmationOpen,
    setIsConfirmationOpen,
    isEditPopupOpen,
    setIsEditPopupOpen,
    successMessage,
    errorMessage,
    selectedCadet,
    setSelectedCadet,
    newCadet,
    handleDischarge,
    handleAddCadet,
    handleInputChange,
    handleRowClick,
  } = useCadetList(user);

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

  const formattedCadets = data.cadets.map((cadet) => {

    const serviceLength = (() => {
      if (!cadet.startDate) return "N/A";

      const [year, month, day] = cadet.startDate.split("-").map(Number);
      const startDate = new Date(year, month - 1, day);
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

    // Calculate classification dynamically
    const matchingEvents = data.events.filter(
      (event) =>
        event.cadetName === `${cadet.forename} ${cadet.surname}` &&
        event.examName !== ""
    );

    let classificationCount = matchingEvents.length + 1;

    if (classificationCount > 12) {
      classificationCount = 12; // Cap at 13
    }
    
    return {
      ...Object.keys(cadetListColumnMapping).reduce((acc, key) => {
        acc[key] = cadet[cadetListColumnMapping[key]];
        return acc;
      }, {}),
      Classification: classificationMap[classificationCount] || classificationCount, // Map classification to its label or use the count
      "Service Length": serviceLength,
      id: cadet.id,
    };
  });


  return (
    <div className={table["table-dashboard-container"]}>
      <div className={shared["button-container"]}>
        <button className={shared["button-red"]} onClick={() => setIsPopupOpen(true)}>
          Discharge Cadet
        </button>
        <button className={shared["button-green"]} onClick={() => setIsAddPopupOpen(true)}>
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
      {/* Add text below the table to display the number of cadets */}
      <div className={"cadet-count"}>
        <p>Total Cadets: {formattedCadets.length}</p>
      </div>
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
        cadets={data.cadets}
        setCadets={() => {}} // No need to update cadets directly
        selectedCadet={selectedCadet}
        setSelectedCadet={setSelectedCadet}
        newCadet={newCadet}
        handleInputChange={handleInputChange}
        classificationMap={classificationMap}
        rankMap={rankMap}
      />
      <SuccessMessage message={successMessage} />
      <ErrorMessage message={errorMessage} />
    </div>
  );
};

export default CadetsDashboard;