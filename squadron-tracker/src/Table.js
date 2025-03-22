import React, { useState } from "react";
import { rankMap, flightMap, classificationMap } from "./mappings"; // Import the mappings
import "./Table.css";

const Table = ({ columns, data }) => {
  const [filters, setFilters] = useState({});
  const [sortOrder, setSortOrder] = useState({});
  const [hoverbox, setHoverbox] = useState({ visible: false, content: "", position: { x: 0, y: 0 } });

  const handleFilterChange = (col, value) => {
    setFilters((prev) => ({
      ...prev,
      [col]: value.toLowerCase(),
    }));
  };

  const handleSortChange = (col) => {
    setSortOrder((prev) => ({
      ...prev,
      [col]: prev[col] === "asc" ? "desc" : "asc",
    }));
  };

  const getMappedValue = (col, value) => {
    if (col === "Rank") {
      return rankMap[value] || value;
    }
    if (col === "Flight") {
      return flightMap[value] || value;
    }
    if (col === "Classification") {
      return classificationMap[value] || value;
    }
    return value;
  };

  const filteredData = data.filter((row) =>
    columns.every((col) => {
      const filter = filters[col];
      if (filter) {
        const cellValue = String(row[col]).toLowerCase();
        return cellValue.includes(filter);
      }
      return true;
    })
  );

  const sortedData = filteredData.sort((a, b) => {
    return columns.reduce((acc, col) => {
      if (sortOrder[col]) {
        const valA = a[col];
        const valB = b[col];
        if (typeof valA === "string" && typeof valB === "string") {
          return sortOrder[col] === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (typeof valA === "number" && typeof valB === "number") {
          return sortOrder[col] === "asc" ? valA - valB : valB - valA;
        }
      }
      return acc;
    }, 0);
  });

  // Hoverbox Event Handlers
  const handleMouseEnter = (row, e) => {
    const addedBy = row["AddedBy"]; // Access AddedBy by column name
    const createdAtTimestamp = row["CreatedAt"]; // Access CreatedAt by column name
  
    // Convert Firestore Timestamp to JavaScript Date object
    const createdAtDate = createdAtTimestamp.toDate(); // toDate() converts Firestore Timestamp to Date
  
    // Format the date as DD-MM-YYYY HH:MM
    const formattedCreatedAt = createdAtDate.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false, // Use 24-hour format
    });
  
    setHoverbox({
      visible: true,
      content: `Added by ${addedBy} at ${formattedCreatedAt}`,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleMouseMove = (e) => {
    setHoverbox((prev) => ({
      ...prev,
      position: { x: e.clientX, y: e.clientY },
    }));
  };

  const handleMouseLeave = () => {
    setHoverbox({ visible: false, content: "", position: { x: 0, y: 0 } });
  };

  return (
    <div className="table-container">
      <table className="custom-table">
        <thead>
          <tr>
            {columns.map((col, index) => (
              <th key={index}>
                {col}
                <br />
                <input
                  type="text"
                  placeholder="Filter"
                  onChange={(e) => handleFilterChange(col, e.target.value)}
                />
                <button onClick={() => handleSortChange(col)}>Sort</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onMouseEnter={(e) => handleMouseEnter(row, e)} // Pass the row to handleMouseEnter
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {columns.map((col, colIndex) => (
                <td key={colIndex}>
                  {getMappedValue(col, row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Hoverbox rendering */}
      {hoverbox.visible && (
        <div
          className="hoverbox"
          style={{
            position: 'absolute',
            top: hoverbox.position.y + 10, // 10px offset
            left: hoverbox.position.x + 20, // 10px offset
            backgroundColor: 'white',
            padding: '5px',
            border: '1px solid gray',
            borderRadius: '15px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
          }}
        >
          {hoverbox.content}
        </div>
      )}
    </div>
  );
};

export default Table;
