import React, { useState, useEffect } from "react";
import { getAllCadetNames, getBadgeTypeList, getAllBadges } from "../../../firebase/firestoreUtils";
import { badgeLevel } from "../../../utils/examList";
import "./PTSTracker.css";

const PTSTracker = () => {
  const [cadetNames, setCadetNames] = useState([]);
  const [badgeData, setBadgeData] = useState([]);
  const [groupedBadgeColumns, setGroupedBadgeColumns] = useState({});
  const [expandedTabs, setExpandedTabs] = useState({}); // Tracks expanded state for each badge type

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch cadet names
        const names = await getAllCadetNames();
        setCadetNames(names);

        // Fetch badge types and generate grouped badge columns
        const badgeTypes = await getBadgeTypeList();
        const groupedColumns = badgeTypes.reduce((acc, type) => {
          acc[type] = badgeLevel.map((level) => `${level} ${type}`);
          return acc;
        }, {});
        setGroupedBadgeColumns(groupedColumns);

        // Fetch all badges data
        const badges = await getAllBadges();
        setBadgeData(badges);

        // Initialize expanded state for each badge type
        const initialExpandedState = badgeTypes.reduce((acc, type) => {
          acc[type] = false; // All badge types start collapsed
          return acc;
        }, {});
        setExpandedTabs(initialExpandedState);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  const getBadgeDate = (cadetName, badge) => {
    const badgeEntry = badgeData.find(
      (entry) => entry.cadetName === cadetName && entry.badge === badge
    );
    return badgeEntry ? badgeEntry.date : "";
  };

  const toggleTab = (type) => {
    setExpandedTabs((prevState) => ({
      ...prevState,
      [type]: !prevState[type], // Toggle the expanded state for the clicked badge type
    }));
  };

  return (
    <div className="PTSTracker">
      <h1>PTS Tracker</h1>
      {/* Tabs for badge types */}
      <div className="PTSTracker-tabs">
        {Object.keys(groupedBadgeColumns).map((type, index) => (
          <div
            key={`tab-${index}`}
            onClick={() => toggleTab(type)}
            className={`PTSTracker-tab ${expandedTabs[type] ? "expanded" : ""}`}
          >
            {type} {expandedTabs[type] ? "(-)" : "(+)"}
          </div>
        ))}
      </div>

      {/* Scrollable Table Container */}
      <div className="PTSTracker-table-container">
        <table className="PTSTracker-table">
          <thead>
            <tr>
              <th rowSpan="2">Cadet Name</th>
              {Object.keys(groupedBadgeColumns).map((type, index) =>
                expandedTabs[type] ? (
                  <th key={`type-${index}`} colSpan={badgeLevel.length}>
                    {type}
                  </th>
                ) : null
              )}
            </tr>
            <tr>
              {Object.entries(groupedBadgeColumns).flatMap(([type, levels]) =>
                expandedTabs[type]
                  ? levels.map((level, index) => (
                      <th key={`level-${type}-${index}`}>
                        {level.split(" ")[0]}
                      </th>
                    ))
                  : []
              )}
            </tr>
          </thead>
          <tbody>
            {cadetNames.map((name, rowIndex) => (
              <tr key={`cadet-${rowIndex}`}>
                <td>{name}</td>
                {Object.entries(groupedBadgeColumns).flatMap(([type, levels]) =>
                  expandedTabs[type]
                    ? levels.map((level, colIndex) => (
                        <td key={`badge-${rowIndex}-${type}-${colIndex}`}>
                          {getBadgeDate(name, level)}
                        </td>
                      ))
                    : []
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PTSTracker;