import React from "react";
import Form from "../Form";
import "../dashboardStyles.css";

const CadetForm = ({
  newCadet,
  handleInputChange,
  flightMap,
  rankMap,
}) => {
  const fields = [
    {
      id: "forename",
      name: "forename",
      type: "text",
      label: "Forename:",
      value: newCadet.forename,
    },
    {
      id: "surname",
      name: "surname",
      type: "text",
      label: "Surname:",
      value: newCadet.surname,
    },
    {
      id: "rank",
      name: "rank",
      type: "select",
      label: "Rank:",
      value: newCadet.rank,
      placeholder: "Select a rank",
      options: rankMap,
    },
    {
      id: "flight",
      name: "flight",
      type: "select",
      label: "Flight:",
      value: newCadet.flight,
      placeholder: "Select a flight",
      options: flightMap,
    },
    {
      id: "startDate",
      name: "startDate",
      type: "date",
      label: "Start Date:",
      value: newCadet.startDate,
    },
  ];

  return (
    <div className="cadet-form-container">
      <Form title="" fields={fields} handleInputChange={handleInputChange} />
      <div className="form-buttons-container">
        {/* Buttons will be rendered here by the parent Popup component */}
      </div>
    </div>
  );
};

export default CadetForm;