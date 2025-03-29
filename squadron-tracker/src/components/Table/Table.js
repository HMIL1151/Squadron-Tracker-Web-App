import React, { useState, useEffect, useCallback } from "react";
import { rankMap, flightMap, classificationMap } from "../../utils/mappings"; // Import the mappings
import "./Table.css";

const Table = ({ columns, data, onRowClick, onRowHover, disableHover = false, width = "90%", hoveredCadet, rowColors = [] }) => {
  const [filters, setFilters] = useState({});
  const [sortOrder, setSortOrder] = useState({});
  const [hoverbox, setHoverbox] = useState({ visible: false, content: "", position: { x: 0, y: 0 } });

  const handleMouseMove = useCallback((e) => {
    if (disableHover) return;
    setHoverbox((prev) => ({
      ...prev,
      position: { x: e.clientX, y: e.clientY },
    }));
  }, [disableHover]);

  useEffect(() => {
    if (!disableHover) {
      document.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      if (!disableHover) {
        document.removeEventListener("mousemove", handleMouseMove);
      }
    };
  }, [disableHover, handleMouseMove]);

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
    } else if (activeColumn === "Points") {
      valA = parseInt(valA);
      valB = parseInt(valB);
    } else {
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
    }
  
    //console.log(`Comparing ${valA} and ${valB} for column ${activeColumn} in ${sortOrder[activeColumn]} order`);
  
    if (valA < valB) {
      return sortOrder[activeColumn] === "asc" ? -1 : 1;
    }
    if (valA > valB) {
      return sortOrder[activeColumn] === "asc" ? 1 : -1;
    }
    return 0; // If values are equal, maintain original order
  });
  
  

  // Hoverbox Event Handlers
  const handleMouseEnter = (row, e) => {
    if (disableHover) return;
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

  const handleMouseLeave = () => {
    if (disableHover) return;
    setHoverbox({ visible: false, content: "", position: { x: 0, y: 0 } });
  };

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
              onMouseMove={handleMouseMove}
              onMouseLeave={() => onRowHover && onRowHover(null)} // Clear hover
              onClick={() => onRowClick && onRowClick(row)} // Trigger onRowClick if provided
              className={`${
                hoveredCadet && hoveredCadet === row.Name ? "highlighted-row" : ""
              } ${onRowClick ? "clickable-row" : ""}`}
              style={{
                backgroundColor:
                  hoveredCadet && hoveredCadet === row.Name
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

      {/* Hoverbox rendering */}
      {hoverbox.visible && (
        <div
          className="hoverbox"
          style={{
            position: 'absolute',
            top: hoverbox.position.y - 50, // 10px offset
            left: hoverbox.position.x - 180, // 10px offset
            backgroundColor: "white",
            padding: "5px",
            border: "1px solid gray",
            borderRadius: "10px",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
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
