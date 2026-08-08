import React, { useState } from "react";
import { rankMap, classificationMap } from "../../utils/mappings"; // Import the mappings
import { useSquadron } from "../../context/SquadronContext";
import "./Table.css";

const Table = ({ columns, data, onRowClick, onRowHover, disableHover = false, width = "90%", hoveredCadet, rowColors = [] }) => {
  const [filters, setFilters] = useState({});
  const [sortOrder, setSortOrder] = useState({});
  // Flight names come from context so a rename re-renders the table. They used
  // to come from a module-level object, which did not.
  const { flightMap } = useSquadron();

  const handleFilterChange = (col, value) => {
    setFilters((prev) => ({
      ...prev,
      [col]: value.toLowerCase(),
    }));
  };

  const handleSortChange = (col) => {
    setSortOrder((prev) => {
      const newSortOrder = { [col]: prev[col] === "asc" ? "desc" : "asc" }; // Toggle sort order for the selected column
      return newSortOrder;
    });
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
        const cellValue = String(getMappedValue(col, row[col])).toLowerCase(); // Use mapped value for filtering
        return cellValue.includes(filter);
      }
      return true;
    })
  );

  const sortedData = [...filteredData].sort((a, b) => {
    const activeColumn = Object.keys(sortOrder)[0]; // Get the currently active column
    if (!activeColumn) return 0; // If no column is active, return the original order
  
    let valA = getMappedValue(activeColumn, a[activeColumn]);
    let valB = getMappedValue(activeColumn, b[activeColumn]);
  
    // Convert Rank and Classification names back to their numerical values for sorting
    if (activeColumn === "Rank") {
      valA = parseInt(Object.keys(rankMap).find((key) => rankMap[key] === valA)) || 0;
      valB = parseInt(Object.keys(rankMap).find((key) => rankMap[key] === valB)) || 0;
    } else if (activeColumn === "Classification") {
      valA = parseInt(Object.keys(classificationMap).find((key) => classificationMap[key] === valA)) || 0;
      valB = parseInt(Object.keys(classificationMap).find((key) => classificationMap[key] === valB)) || 0;
    } else if (activeColumn === "Points" || activeColumn === "Points Earned") {
      valA = parseInt(valA);
      valB = parseInt(valB);
    } else {
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
    }
  
    if (valA < valB) {
      return sortOrder[activeColumn] === "asc" ? -1 : 1;
    }
    if (valA > valB) {
      return sortOrder[activeColumn] === "asc" ? 1 : -1;
    }
    return 0; // If values are equal, maintain original order
  });

  const getRowColor = (row) => {
    const colorMapping = rowColors.find((mapping) => mapping.row === row.Name); // Assuming "Name" uniquely identifies a row
    return colorMapping ? colorMapping.color : "white"; // Default to white if no color is specified
  };

  return (
    <div className="table-container">
      <table className="custom-table" style={{ width }}>
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
              onMouseEnter={() => onRowHover && onRowHover(row.Name)} // Trigger hover
              onMouseLeave={() => onRowHover && onRowHover(null)} // Clear hover
              onClick={() => onRowClick && onRowClick(row)} // Trigger onRowClick if provided
              className={`${
                hoveredCadet && hoveredCadet.includes(row.Name) ? "highlighted-row" : ""
              } ${onRowClick ? "clickable-row" : ""}`}
              style={{
                backgroundColor:
                  hoveredCadet && hoveredCadet.includes(row.Name)
                    ? "#ffff99" // Highlighted row color
                    : getRowColor(row), // Use rowColors mapping
              }}
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
    </div>
  );
};

export default Table;
