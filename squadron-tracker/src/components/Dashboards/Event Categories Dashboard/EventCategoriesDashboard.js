import React, { useEffect, useState, useCallback } from "react";
import { getFirestore, doc, getDoc, updateDoc, deleteField } from "firebase/firestore/lite";
import Table from "../../Table/Table";
import AddEntry from "./addEntry";
import AddCategory from "./AddCategory"; // Import the new AddCategory component
import AddBadgePoints from "./AddBadgePoints"; // Import the new AddBadgePoints component
import EditPopup from "./EditPopup";
import DeletePopup from "./DeletePopup"; // Import the DeletePopup component
import "./EventCategoriesDashboard.css";
import "../Dashboard Components/dashboardStyles.css";
import { useSquadron } from "../../../context/SquadronContext";

const EventCategoriesDashboard = () => {
  const [categories, setCategories] = useState([]);
  const [badges, setBadges] = useState([]); // State for badges
  const [specialAwards, setSpecialAwards] = useState([]); // State for special awards
  const [badgePoints, setBadgePoints] = useState([]); // State for badge points
  const [activeTab, setActiveTab] = useState("eventcategories"); // Default to "Event Categories"
  const eventCategoryColumns = ["Category", "Points"];
  const badgeColumns = ["Badge Types"]; // Columns for badges
  const specialAwardsColumns = ["Special Awards"]; // Columns for special awards
  const badgePointsColumns = ["Badge Types", "Points"]; // Columns for badge points
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false); // State for AddCategory popup
  const [isAddBadgePointsOpen, setIsAddBadgePointsOpen] = useState(false); // State for AddBadgePoints popup
  const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
  const [editData, setEditData] = useState(null); // Holds the data of the row being edited
  const [editType, setEditType] = useState(""); // Tracks the type of table being edited
  const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
  const [deleteOptions, setDeleteOptions] = useState([]);
  const [deleteType, setDeleteType] = useState("");
  const { squadronNumber } = useSquadron(); // Access the squadron number from context

  const fetchSpecialAwards = useCallback(async () => {
    try {
      const db = getFirestore();
      const docRef = doc(db, "Squadron Databases", squadronNumber.toString(), "Flight Points", "Special Awards");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const specialAwardTypes = data["Special Awards"];
        if (Array.isArray(specialAwardTypes)) {
          const formattedSpecialAwards = specialAwardTypes.map((special) => ({
            "Special Awards": special,
          }));
          setSpecialAwards(formattedSpecialAwards);
        } else {
          console.error("Special Awards data is not an array:", specialAwardTypes);
        }
      } else {
        console.error("No such document!");
      }
    } catch (error) {
      console.error("Error fetching special awards:", error);
    }
  }, [squadronNumber]);

  const fetchEventCategories = useCallback(async () => {
    try {
      const db = getFirestore();
      const docRef = doc(db, "Squadron Databases", squadronNumber.toString(), "Flight Points", "Event Category Points");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const eventCategoriesPoints = Object.entries(data).map(([category, points]) => ({
          Category: category,
          Points: points,
        }));
        setCategories(eventCategoriesPoints);
      } else {
        console.error("No such document!");
      }
    } catch (error) {
      console.error("Error fetching event categories:", error);
    }
  }, [squadronNumber]);

  const fetchBadgePoints = useCallback(async () => {
    try {
      const db = getFirestore();
      const docRef = doc(db, "Squadron Databases", squadronNumber.toString(), "Flight Points", "Badge Points");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const badgePoints = Object.entries(data).map(([badgeName, points]) => ({
          "Badge Types": badgeName,
          Points: points,
        }));
        setBadgePoints(badgePoints);
      } else {
        console.error("No such document!");
      }
    } catch (error) {
      console.error("Error fetching badge points:", error);
    }
  }, [squadronNumber]);

  const fetchBadges = useCallback(async () => {
    try {
      const db = getFirestore();
      const docRef = doc(db, "Squadron Databases", squadronNumber.toString(), "Flight Points", "Badges");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const badgeTypes = data["Badge Types"];
        if (Array.isArray(badgeTypes)) {
          const formattedBadges = badgeTypes.map((badge) => ({ "Badge Types": badge }));
          setBadges(formattedBadges);
        } else {
          console.error("Badge data is not an array:", badgeTypes);
        }
      } else {
        console.error("No such document!");
      }
    } catch (error) {
      console.error("Error fetching badges:", error);
    }
  }, [squadronNumber]);

  const handleRowClick = (rowData, type) => {
    setEditData(rowData);
    setEditType(type);
    setIsEditPopupOpen(true);
  };

  const handleDeleteClick = (type) => {
    setDeleteType(type);
    if (type === "eventcategories") {
      setDeleteOptions(categories);
    } else if (type === "badges") {
      setDeleteOptions(badges);
    } else if (type === "badgepoints") {
      setDeleteOptions(badgePoints);
    } else if (type === "specialawards") {
      setDeleteOptions(specialAwards);
    }
    setIsDeletePopupOpen(true);
  };

  const handleDeleteConfirm = async (selectedItem) => {
    const db = getFirestore();
    const docRef = doc(
      db, "Squadron Databases", squadronNumber.toString(), 
      "Flight Points",
      deleteType === "eventcategories"
        ? "Event Category Points"
        : deleteType === "badgepoints"
        ? "Badge Points"
        : deleteType === "badges"
        ? "Badges"
        : "Special Awards"
    );

    try {
      if (deleteType === "eventcategories" || deleteType === "badgepoints") {
        // Delete key-value pair
        await updateDoc(docRef, { [selectedItem]: deleteField() });
      } else {
        // Delete from array
        const arrayName =
          deleteType === "badges" ? "Badge Types" : "Special Awards";
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const updatedArray = data[arrayName].filter(
            (item) => item !== selectedItem
          );
          await updateDoc(docRef, { [arrayName]: updatedArray });
        }
      }

      // Refresh the table data
      if (deleteType === "eventcategories") {
        fetchEventCategories();
      } else if (deleteType === "badgepoints") {
        fetchBadgePoints();
      } else if (deleteType === "badges") {
        fetchBadges();
      } else if (deleteType === "specialawards") {
        fetchSpecialAwards();
      }
    } catch (error) {
      console.error("Error deleting item:", error);
    }

    setIsDeletePopupOpen(false);
  };

  useEffect(() => {
    fetchSpecialAwards();
    fetchBadgePoints();
    fetchEventCategories();
    fetchBadges();
  }, [fetchSpecialAwards, fetchBadgePoints, fetchEventCategories, fetchBadges]); // Add the memoized functions as dependencies

  return (
    <div className="event-categories-dashboard">
      {/* Horizontal Menu */}
      <div className="horizontal-menu">
        <button
          className={activeTab === "eventcategories" ? "active" : ""}
          onClick={() => setActiveTab("eventcategories")}
        >
          Record Categories
        </button>
        <button
          className={activeTab === "badges" ? "active" : ""}
          onClick={() => setActiveTab("badges")}
        >
          Badges
        </button>
        <button
          className={activeTab === "badgepoints" ? "active" : ""}
          onClick={() => setActiveTab("badgepoints")}
        >
          Badge Points
        </button>
        <button
          className={activeTab === "specialawards" ? "active" : ""}
          onClick={() => setActiveTab("specialawards")}
        >
          Special Awards
        </button>
      </div>

      {/* Content Area */}
      <div className="content-area">
        {activeTab === "eventcategories" && (
          <div style={{ textAlign: "center" }}>
            <div className="button-container">
              <button
                className="button-green"
                onClick={() => setIsAddCategoryOpen(true)}
              >
                Add New Category
              </button>
              <button
                className="button-red"
                onClick={() => handleDeleteClick("eventcategories")}
              >
                Delete Category
              </button>
            </div>
            <Table
              columns={eventCategoryColumns}
              data={categories}
              disableHover={true}
              width="30%"
              onRowClick={(rowData) => handleRowClick(rowData, "eventcategories")}
            />
            <AddCategory
              isOpen={isAddCategoryOpen}
              onClose={() => setIsAddCategoryOpen(false)}
              onConfirm={() => {
                fetchEventCategories(); // Refresh the table data after adding a category
              }}
            />
          </div>
        )}
        {activeTab === "badges" && (
          <div style={{ textAlign: "center" }}>
            <div className="button-container">
              <button className="button-green" onClick={() => setIsAddEntryOpen(true)}>
                Add New Badge
              </button>
              <button
                className="button-red"
                onClick={() => handleDeleteClick("badges")}
              >
                Delete Badge
              </button>
            </div>
            <Table
              columns={badgeColumns}
              data={badges}
              disableHover={true}
              width="30%"
              onRowClick={(rowData) => handleRowClick(rowData, "badges")}
            />
            <AddEntry
              isOpen={isAddEntryOpen}
              onClose={() => setIsAddEntryOpen(false)}
              onConfirm={() => {
                fetchBadges(); // Refresh the table data after adding an entry
              }}
              collection="Flight Points" // Specify the Firestore collection
              document="Badges" // Specify the Firestore document
              arrayName="Badge Types" // Specify the array name within the document
            />
          </div>
        )}
        {activeTab === "badgepoints" && (
          <div style={{ textAlign: "center" }}>
            <div className="button-container">
              <button
                className="button-green"
                onClick={() => setIsAddBadgePointsOpen(true)}
              >
                Add Badge Type
              </button>
              <button
                className="button-red"
                onClick={() => handleDeleteClick("badgepoints")}
              >
                Delete Badge Type
              </button>
            </div>
            <Table
              columns={badgePointsColumns}
              data={badgePoints}
              disableHover={true}
              width="30%"
              onRowClick={(rowData) => handleRowClick(rowData, "badgepoints")}
            />
            <AddBadgePoints
              isOpen={isAddBadgePointsOpen}
              onClose={() => setIsAddBadgePointsOpen(false)}
              onConfirm={() => {
                fetchBadgePoints(); // Refresh the table data after adding badge points
              }}
            />
          </div>
        )}
        {activeTab === "specialawards" && (
          <div style={{ textAlign: "center" }}>
            <div className="button-container">
              <button className="button-green" onClick={() => setIsAddEntryOpen(true)}>
                Add New Special Award
              </button>
              <button className="button-red" onClick={() => handleDeleteClick("specialawards")}>
                Delete Special Award
              </button>
            </div>
            <Table
              columns={specialAwardsColumns}
              data={specialAwards}
              disableHover={true}
              width="30%"
              onRowClick={(rowData) => handleRowClick(rowData, "specialawards")}
            />
            <AddEntry
              isOpen={isAddEntryOpen}
              onClose={() => setIsAddEntryOpen(false)}
              onConfirm={() => {
                fetchSpecialAwards(); // Refresh the table data after adding an entry
              }}
              collection="Flight Points" // Specify the Firestore collection
              document="Special Awards" // Specify the Firestore document
              arrayName="Special Awards" // Specify the array name within the document
            />
          </div>
        )}
      </div>
      {editData && (
        <EditPopup
          isOpen={isEditPopupOpen}
          onClose={() => setIsEditPopupOpen(false)}
          onConfirm={async (updatedData) => {
            const db = getFirestore();
            const docRef = doc(
              db,
              "Flight Points",
              editType === "eventcategories"
                ? "Event Category Points"
                : editType === "badgepoints"
                ? "Badge Points"
                : editType === "badges"
                ? "Badges"
                : "Special Awards"
            );

            if (editType === "eventcategories" || editType === "badgepoints") {
              // Handle key-value pair updates
              const oldKey = editData.Category || editData["Badge Types"];
              const newKey = updatedData.Category || updatedData["Badge Types"];
              const newValue = updatedData.Points;

              try {
                // Delete the old field if the key has changed
                if (oldKey !== newKey) {
                  await updateDoc(docRef, { [oldKey]: deleteField() });
                }

                // Add the new field with the updated key and value
                await updateDoc(docRef, { [newKey]: newValue });

                // Refresh the table
                if (editType === "eventcategories") {
                  fetchEventCategories();
                } else {
                  fetchBadgePoints();
                }
              } catch (error) {
                console.error("Error updating document:", error);
              }
            } else {
              // Handle array updates for badges and special awards
              const arrayName = editType === "badges" ? "Badge Types" : "Special Awards";
              try {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                  const data = docSnap.data();
                  const updatedArray = data[arrayName].map((item) =>
                    item === editData[arrayName] ? updatedData[arrayName] : item
                  );
                  await updateDoc(docRef, { [arrayName]: updatedArray });

                  // Refresh the table
                  if (editType === "badges") {
                    fetchBadges();
                  } else {
                    fetchSpecialAwards();
                  }
                }
              } catch (error) {
                console.error("Error updating array:", error);
              }
            }
          }}
          data={editData}
          type={editType}
        />
      )}
      <DeletePopup
        isOpen={isDeletePopupOpen}
        onClose={() => setIsDeletePopupOpen(false)}
        onConfirm={handleDeleteConfirm}
        options={deleteOptions}
        labelKey={
          deleteType === "eventcategories"
            ? "Category"
            : deleteType === "badgepoints"
            ? "Badge Types"
            : deleteType === "badges"
            ? "Badge Types"
            : "Special Awards"
        }
        className="add-entry-modal" // Use the same class as AddEntry for consistent styling
      />
    </div>
  );
};

export default EventCategoriesDashboard;