import React from "react";

const CadetForm = ({
  newCadet,
  handleInputChange,
  classificationMap,
  flightMap,
  rankMap,
}) => {
  return (
    <form className="add-cadet-form">
      <div className="form-group">
        <label className="form-label" htmlFor="forename">Forename:</label>
        <input
          id="forename"
          type="text"
          name="forename"
          value={newCadet.forename || ""}
          onChange={handleInputChange}
          className="form-input"
        />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="surname">Surname:</label>
        <input
          id="surname"
          type="text"
          name="surname"
          value={newCadet.surname || ""}
          onChange={handleInputChange}
          className="form-input"
        />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="rank">Rank:</label>
        <select
          id="rank"
          name="rank"
          value={newCadet.rank || ""}
          onChange={handleInputChange}
          className="form-select"
        >
          {Object.entries(rankMap).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="flight">Flight:</label>
        <select
          id="flight"
          name="flight"
          value={newCadet.flight || ""}
          onChange={handleInputChange}
          className="form-select"
        >
          {Object.entries(flightMap).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="classification">Classification:</label>
        <select
          id="classification"
          name="classification"
          value={newCadet.classification || ""}
          onChange={handleInputChange}
          className="form-select"
        >
          {Object.entries(classificationMap).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="startDate">Start Date:</label>
        <input
          id="startDate"
          type="date"
          name="startDate"
          value={newCadet.startDate || ""}
          onChange={handleInputChange}
          className="form-input"
        />
      </div>
    </form>
  );
};

export default CadetForm;