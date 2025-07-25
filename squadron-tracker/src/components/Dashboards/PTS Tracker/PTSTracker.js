import React, { useState, useEffect, useContext } from "react";
import { motion } from "framer-motion";
import { badgeLevel } from "../../../utils/examList";
import "./PTSTracker.css";
import { DataContext } from "../../../context/DataContext"; // Import DataContext
import { useSaveEvent } from "../../../databaseTools/databaseTools"; // Import saveEvent 

const PTSTracker = ({ user }) => {
  const [cadetNames, setCadetNames] = useState([]);
  const [badgeData, setBadgeData] = useState([]);
  const [groupedBadgeColumns, setGroupedBadgeColumns] = useState({});
  const [expandedTabs, setExpandedTabs] = useState({});
  const [selectedButton, setSelectedButton] = useState(["Blue", "Bronze", "Silver", "Gold"]); // Default state: all selected
  const [startMonth, setStartMonth] = useState("01");
  const [startYear, setStartYear] = useState("");
  const [endMonth, setEndMonth] = useState("12");
  const [endYear, setEndYear] = useState("");
  const [dateMode, setDateMode] = useState("all"); // "all" or "range"
  const { data } = useContext(DataContext); // Access data and setData from DataContext

  const [popupData, setPopupData] = useState(null); // State to track popup data
  const saveEvent = useSaveEvent(); // Call the custom hook at the top level

  useEffect(() => {
    const fetchData = () => {
      try {
        // Extract cadet names from DataContext
        const names = data.cadets.map((cadet) => `${cadet.forename} ${cadet.surname}`);
        setCadetNames(names);

        // Extract badge types from DataContext
        const badgeTypes = data.flightPoints.Badges?.["Badge Types"] || [];
        const groupedColumns = badgeTypes.reduce((acc, type) => {
          acc[type] = badgeLevel.map((level) => `${level} ${type}`);
          return acc;
        }, {});
        setGroupedBadgeColumns(groupedColumns);

        // Extract badge data from DataContext
        const badges = data.events
          .filter((event) => event.badgeLevel && event.badgeCategory) // Filter only badge events
          .map((event) => ({
            cadetName: event.cadetName,
            badge: `${event.badgeLevel} ${event.badgeCategory}`,
            date: event.date,
          }));
        setBadgeData(badges);

        // Initialize expanded state for badge types (set all to true by default)
        const initialExpandedState = badgeTypes.reduce((acc, type) => {
          acc[type] = true; // Set all badge types to expanded
          return acc;
        }, {});
        setExpandedTabs(initialExpandedState);
      } catch (error) {
        console.error("Error processing data from DataContext:", error);
      }
    };

    fetchData();
  }, [data, user.squadronNumber]); // Fetch data when data or user.squadronNumber changes

  // Get all years present in badgeData for dropdown
  const badgeYears = Array.from(
    new Set(badgeData.map((entry) => entry.date && entry.date.slice(0, 4)).filter(Boolean))
  ).sort((a, b) => b - a); // Descending order

  // Set default years if not set
  useEffect(() => {
    if (badgeYears.length > 0) {
      if (!startYear) setStartYear(badgeYears[badgeYears.length - 1]);
      if (!endYear) setEndYear(badgeYears[0]);
    }
  }, [badgeYears, startYear, endYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const months = [
    { value: "01", label: "Jan" },
    { value: "02", label: "Feb" },
    { value: "03", label: "Mar" },
    { value: "04", label: "Apr" },
    { value: "05", label: "May" },
    { value: "06", label: "Jun" },
    { value: "07", label: "Jul" },
    { value: "08", label: "Aug" },
    { value: "09", label: "Sep" },
    { value: "10", label: "Oct" },
    { value: "11", label: "Nov" },
    { value: "12", label: "Dec" },
  ];

  // Filtered badgeData for selected date range or all time
  const filteredBadgeData = badgeData.filter((entry) => {
    if (!entry.date) return false;
    if (dateMode === "all") return true;
    if (!startYear || !endYear) return true;
    const entryDate = entry.date.replace(/-/g, ""); // YYYYMMDD
    const start = `${startYear}${startMonth}01`;
    const end = `${endYear}${endMonth}31`;
    return entryDate >= start && entryDate <= end;
  });

  const getBadgeDate = (cadetName, badge) => {
    const badgeEntry = filteredBadgeData.find(
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

  const handleCellClick = (cadetName, badge) => {
    setPopupData({ cadetName, badge }); // Set popup data
  };

  const closePopup = () => {
    setPopupData(null); // Close the popup
  };

  const handleConfirm = async (e) => {
    if (e) e.preventDefault();
    const currentDate = new Date();
    const selectedDate = new Date(popupData.date);

    // Calculate the date range
    const eightYearsAgo = new Date();
    eightYearsAgo.setFullYear(currentDate.getFullYear() - 8);

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(currentDate.getDate() + 7);

    // Validate the selected date
    if (selectedDate < eightYearsAgo || selectedDate > sevenDaysFromNow) {
      alert("The date must be no more than 8 years in the past or 7 days in the future.");
      return; // Prevent closing the popup
    }

    // Split the badge into level and category
    const badgeParts = popupData.badge.split(" ");
    const badgeLevel = badgeParts[0]; // First word is the level
    const badgeCategory = badgeParts.slice(1).join(" "); // Remaining words form the category

    const eventDetails = {
      createdAt: new Date(), // Current timestamp
      addedBy: user.displayName, // Replace with the actual user object
      cadetName: [popupData.cadetName],
      badgeLevel, // Extracted badge level
      badgeCategory, // Extracted badge category
      date: popupData.date, // Date entered by the user
      eventCategory: "", // Example category
      eventName: "", // Example event name
      examName: "", // Leave empty if not applicable
      specialAward: "", // Leave empty if not applicable
    };

    try {
      await saveEvent(eventDetails); // Use the saveEvent function
    } catch (error) {
      console.error("Error saving event:", error);
    }

    // Do NOT reset filters here, just close the popup
    closePopup(); // Close the popup
  };

  return (
    <div className="PTSTracker">
      {/* All Time / Date Range Toggle */}
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          className="PTSTracker-button show-all"
          style={{ minWidth: 140 }}
          onClick={() => setDateMode(dateMode === "all" ? "range" : "all")}
        >
          {dateMode === "all" ? "Switch to Date Range" : "Show All Time"}
        </button>
        {dateMode === "range" && (
          <div className="PTSTracker-year-filter" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontWeight: "bold", marginRight: 8 }}>Date Range:</label>
            <select value={startMonth} onChange={e => setStartMonth(e.target.value)} style={{ padding: "6px 8px", borderRadius: 4, fontSize: 16 }}>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={startYear} onChange={e => setStartYear(e.target.value)} style={{ padding: "6px 8px", borderRadius: 4, fontSize: 16 }}>
              {badgeYears.slice().reverse().map(year => <option key={year} value={year}>{year}</option>)}
            </select>
            <span style={{ margin: "0 8px" }}>to</span>
            <select value={endMonth} onChange={e => setEndMonth(e.target.value)} style={{ padding: "6px 8px", borderRadius: 4, fontSize: 16 }}>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={endYear} onChange={e => setEndYear(e.target.value)} style={{ padding: "6px 8px", borderRadius: 4, fontSize: 16 }}>
              {badgeYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
        )}
      </div>
      {/* Badge Colors Buttons */}
      <div className="PTSTracker-buttons">
        <button
          onClick={() =>
            setSelectedButton(
              selectedButton.length === 4 ? [] : ["Blue", "Bronze", "Silver", "Gold"]
            ) // Toggle between selecting all and deselecting all
          }
          className="PTSTracker-button show-all"
        >
          {selectedButton.length === 4 ? "Hide All Badge Levels" : "Show All Badge Levels"}
        </button>
        {["Blue", "Bronze", "Silver", "Gold"].map((color) => (
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
                acc[type] = !Object.values(expandedTabs).every((isExpanded) => isExpanded); // Toggle between expanding all and collapsing all
                return acc;
              }, {})
            )
          }
          className="PTSTracker-tab show-all"
        >
          {Object.values(expandedTabs).every((isExpanded) => isExpanded)
            ? "Hide All Badge Types"
            : "Show All Badge Types"}
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
                            style={{
                              minWidth: "90px",
                              padding: "1px",
                              cursor: badgeDate ? "default" : "pointer", // Pointer only for empty cells
                              border: "1px solid #ccc", // Default border
                            }}
                            className={badgeLevelClass}
                            onMouseEnter={(e) => {
                              if (!badgeDate) {
                                e.target.style.border = "2px solid #007bff"; // Highlight border on hover
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.border = "1px solid #ccc"; // Reset border on hover out
                            }}
                            onClick={() => {
                              if (!badgeDate) {
                                handleCellClick(name, level); // Open popup only for empty cells
                              }
                            }}
                          >
                            {badgeDate}
                          </motion.td>
                        ) : null;
                      })
                    : []
                )}
              </tr>
            ))}
            {/* Totals Row */}
            <tr>
              <td style={{ fontWeight: "bold", background: "#f0f0f0" }}>Total</td>
              {Object.entries(groupedBadgeColumns).flatMap(([type, levels]) =>
                expandedTabs[type]
                  ? levels.map((level) => {
                      const levelName = level.split(" ")[0];
                      // Only count if badge level is selected
                      if (!selectedButton.includes(levelName)) return null;
                      // Count how many cadets have a badge for this column
                      const count = cadetNames.reduce((acc, cadetName) => {
                        return getBadgeDate(cadetName, level) ? acc + 1 : acc;
                      }, 0);
                      return (
                        <td
                          key={`total-${type}-${level}`}
                          style={{ fontWeight: "bold", background: "#f0f0f0" }}
                        >
                          {count}
                        </td>
                      );
                    })
                  : []
              )}
            </tr>
          </tbody>
        </motion.table>
        {/* Popup */}
        {popupData && (
          <div className="popup-overlay" onClick={closePopup}>
            <div
              className="popup-contents"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  document.getElementById("confirm-button").click(); // Trigger the confirm button on Enter
                }
              }}
              tabIndex={0} // Make the div focusable to capture key events
            >
              <h3>Add New Badge</h3>
              <p><strong>Cadet Name:</strong> {popupData.cadetName}</p>
              <p><strong>Badge:</strong> {popupData.badge}</p>
              
              {/* Date Input Field */}
              <label htmlFor="event-date"><strong>Date:</strong></label>
              <input  
                type="date"
                id="event-date"
                autoFocus // Autofocus the date input
                style={{ display: "block", margin: "10px 0", padding: "5px", width: "100%" }}
                value={popupData.date || ""} // Bind the date value
                onChange={(e) =>
                  setPopupData((prevData) => ({ ...prevData, date: e.target.value })) // Update date in popupData
                }
              />

              {/* Confirm and Close Buttons */}
              <div className="popup-bottom-buttons">
                <button
                  className="popup-button-red" // Use the red button style
                  onClick={closePopup}
                >
                  Close
                </button>

                <button
                  id="confirm-button" // Add an ID to the confirm button
                  className="popup-button-green" // Use the green button style
                  onClick={handleConfirm} // Use the handleConfirm function
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default PTSTracker;
