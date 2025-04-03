import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getAllCadetNames, getBadgeTypeList, getAllBadges } from "../../../firebase/firestoreUtils";
import { badgeLevel } from "../../../utils/examList";
import "./PTSTracker.css";

const PTSTracker = () => {
  const [cadetNames, setCadetNames] = useState([]);
  const [badgeData, setBadgeData] = useState([]);
  const [groupedBadgeColumns, setGroupedBadgeColumns] = useState({});
  const [expandedTabs, setExpandedTabs] = useState({});
  const [selectedButton, setSelectedButton] = useState([]); // State for selected buttons

  useEffect(() => {
    const fetchData = async () => {
      try {
        const names = await getAllCadetNames();
        setCadetNames(names);

        const badgeTypes = await getBadgeTypeList();
        const groupedColumns = badgeTypes.reduce((acc, type) => {
          acc[type] = badgeLevel.map((level) => `${level} ${type}`);
          return acc;
        }, {});
        setGroupedBadgeColumns(groupedColumns);

        const badges = await getAllBadges();
        setBadgeData(badges);

        const initialExpandedState = badgeTypes.reduce((acc, type) => {
          acc[type] = false;
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
      [type]: !prevState[type],
    }));
  };

  const handleButtonClick = (button) => {
    setSelectedButton((prevSelected) =>
      prevSelected.includes(button)
        ? prevSelected.filter((b) => b !== button) // Deselect if already selected
        : [...prevSelected, button] // Add to selected if not already selected
    );
  };

  const getColorHex = (color) => {
    switch (color) {
      case "Blue":
        return "#8EA9DB";
      case "Bronze":
        return "#d2a679";
      case "Silver":
        return "#c0c0c0";
      case "Gold":
        return "#ffd700";
      default:
        return "#000000"; // Fallback color
    }
  };

  return (
    <div className="PTSTracker">
      {/* Badge Colors Buttons */}
      <div className="PTSTracker-buttons">
        <button
          onClick={() => setSelectedButton(["Blue", "Bronze", "Silver", "Gold"])} // Select all colors
          className="PTSTracker-button show-all"
        >
          Show All
        </button>
        {["Blue", "Bronze", "Silver", "Gold"].map((color, index) => (
          <button
            key={color}
            onClick={() => handleButtonClick(color)}
            className={`PTSTracker-button ${selectedButton.includes(color) ? "selected" : ""}`}
            style={{
              borderColor: getColorHex(color),
              backgroundColor: selectedButton.includes(color) ? getColorHex(color) : "transparent",
              color: selectedButton.includes(color) ? "white" : getColorHex(color),
            }}
          >
            {color}
          </button>
        ))}
      </div>

      {/* Badge Types Tabs */}
      <div className="PTSTracker-tabs">
        <button
          onClick={() =>
            setExpandedTabs(
              Object.keys(groupedBadgeColumns).reduce((acc, type) => {
                acc[type] = true; // Expand all tabs
                return acc;
              }, {})
            )
          }
          className="PTSTracker-tab show-all"
        >
          Show All
        </button>
        {Object.keys(groupedBadgeColumns).map((type, index) => (
          <div
            key={`tab-${index}`}
            onClick={() => toggleTab(type)}
            className={`PTSTracker-tab ${expandedTabs[type] ? "expanded" : ""}`}
          >
            {type}
          </div>
        ))}
      </div>

      {/* Table */}
      <motion.div
        className="PTSTracker-table-container"
        style={{ textAlign: "left" }}
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.table
          initial={{ width: "auto" }}
          animate={{ width: "auto" }}
          transition={{ duration: 0.5 }}
          className="PTSTracker-table"
          style={{ borderCollapse: "collapse" }}
        >
          <thead>
            <tr>
              <th rowSpan="2" style={{ whiteSpace: "nowrap", padding: "8px" }}>
                Cadet<br /> Name
              </th>
              {Object.entries(groupedBadgeColumns).map(([type, levels], index) => {
                // Filter visible levels based on selected buttons
                const visibleLevels = levels.filter((level) => {
                  const levelName = level.split(" ")[0];
                  return selectedButton.includes(levelName);
                });

                // Only render the badge type header if there are visible levels
                return expandedTabs[type] && visibleLevels.length > 0 ? (
                  <motion.th
                    key={`type-${index}`}
                    colSpan={visibleLevels.length}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    style={{ minWidth: "90px", padding: "1px" }}
                  >
                    {type}
                  </motion.th>
                ) : null;
              })}
            </tr>
            <tr>
              {Object.entries(groupedBadgeColumns).flatMap(([type, levels]) =>
                expandedTabs[type]
                  ? levels.map((level, index) => {
                      const levelName = level.split(" ")[0];
                      // Only render the badge level header if it is selected
                      return selectedButton.includes(levelName) ? (
                        <motion.th
                          key={`level-${type}-${index}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                          style={{ minWidth: "90px", padding: "1px" }}
                          className={`badge-level-${levelName.toLowerCase()}`}
                        >
                          {levelName}
                        </motion.th>
                      ) : null;
                    })
                  : []
              )}
            </tr>
          </thead>
          <tbody>
            {cadetNames.map((name, rowIndex) => (
              <tr key={`cadet-${rowIndex}`}>
                <td style={{ whiteSpace: "nowrap", padding: "4px" }}>{name}</td>
                {Object.entries(groupedBadgeColumns).flatMap(([type, levels]) =>
                  expandedTabs[type]
                    ? levels.map((level, colIndex) => {
                        const levelName = level.split(" ")[0];
                        const badgeDate = getBadgeDate(name, level);
                        const badgeLevelClass = badgeDate ? `badge-level-${levelName.toLowerCase()}` : "";
                        // Only render the badge level cell if it is selected
                        return selectedButton.includes(levelName) ? (
                          <motion.td
                            key={`badge-${rowIndex}-${type}-${colIndex}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            style={{ minWidth: "90px", padding: "1px" }}
                            className={badgeLevelClass}
                          >
                            {badgeDate}
                          </motion.td>
                        ) : null;
                      })
                    : []
                )}
              </tr>
            ))}
          </tbody>
        </motion.table>
      </motion.div>
    </div>
  );
};

export default PTSTracker;
