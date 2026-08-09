import React, { useState } from "react";
import { rankMap, classificationMap } from "../../utils/mappings"; // Import the mappings
import { useSquadron } from "../../context/SquadronContext";
import styles from "./Table.module.css";

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

  /*
   * Undefined rather than "white" when the caller has no opinion.
   *
   * A literal white here overrode the table's own themed surface, which showed
   * up as pale text on a white row the moment a dark theme existed. Returning
   * nothing lets --row-bg stay unset, so the `transparent` fallback in
   * Table.css applies and the table's background shows through.
   */
  const getRowColor = (row) => {
    const colorMapping = rowColors.find((mapping) => mapping.row === row.Name); // Assuming "Name" uniquely identifies a row
    return colorMapping ? colorMapping.color : undefined;
  };

  return (
    <div className={styles["table-container"]}>
      <table className={styles["custom-table"]} style={{ width }}>
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
              className={[
                hoveredCadet && hoveredCadet.includes(row.Name) ? styles["highlighted-row"] : ""
              , onRowClick ? styles["clickable-row"] : ""].filter(Boolean).join(" ")}
              /*
               * The caller's colour goes in as a custom property rather than as
               * backgroundColor. An inline background beats any class, which is
               * why .highlighted-row in Table.css was dead and the highlight had
               * to be re-implemented here as a hardcoded #ffff99. Handing the
               * value to CSS instead lets the stylesheet decide precedence, so
               * the highlight is expressed once, in the place that styles it.
               */
              style={{ "--row-bg": getRowColor(row) }}
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
