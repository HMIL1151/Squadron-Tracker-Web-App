import React from "react";
import Form from "../Form";

const CadetForm = ({
  newCadet,
  handleInputChange,
  classificationMap,
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
      id: "classification",
      name: "classification",
      type: "select",
      label: "Classification:",
      value: newCadet.classification,
      placeholder: "Select a classification",
      options: classificationMap,
    },
    {
      id: "startDate",
      name: "startDate",
      type: "date",
      label: "Start Date:",
      value: newCadet.startDate,
    },
  ];

  return <Form title="" fields={fields} handleInputChange={handleInputChange} />;
};

export default CadetForm;