//TODO: Cadet Profile Page

import React from "react";
import Form from "../DashboardComponents/Form";
import { useSquadron } from "../../../context/SquadronContext";
import { getAssignableFlights } from "../../../utils/flights";
import "../DashboardComponents/dashboardStyles.css";

const CadetForm = ({
  newCadet,
  handleInputChange,
  rankMap,
}) => {
  // Flight names are squadron state, not a constant, so they come from
  // context rather than being threaded down as a prop.
  const { flightMap, flights } = useSquadron();

  /*
   * Archived flights are not offered for new assignments, but a cadet already
   * in one must still see it selected -- otherwise editing them would silently
   * blank their flight. So the archived flight they are in is added back.
   */
  const assignable = getAssignableFlights(flights).reduce((map, flight) => {
    map[flight.index] = flight.name;
    return map;
  }, {});

  const currentFlight = newCadet.flight;
  if (currentFlight && !assignable[currentFlight] && flightMap[currentFlight]) {
    assignable[currentFlight] = `${flightMap[currentFlight]} (archived)`;
  }
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
      options: assignable,
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