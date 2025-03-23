import React from "react";

const CadetForm = ({ newCadet, handleInputChange, classificationMap, flightMap, rankMap }) => {
  return (
    <>
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
    </>
  );
};

export default CadetForm;