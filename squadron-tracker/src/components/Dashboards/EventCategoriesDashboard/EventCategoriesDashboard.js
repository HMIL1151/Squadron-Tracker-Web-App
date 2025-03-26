import React, { useEffect, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore/lite";
import Table from "../../Table/Table";
import AddEntry from "./addEntry";
import "./EventCategoriesDashboard.css";

const EventCategoriesDashboard = () => {
  const [categories, setCategories] = useState([]);
  const [badges, setBadges] = useState([]); // State for badges
  const [specialAwards, setSpecialAwards] = useState([]); // State for special awards
  const [badgePoints, setBadgePoints] = useState([]); // State for badge points
  const [activeTab, setActiveTab] = useState("table"); // State to track active tab
  const eventCategoryColumns = ["Category", "Points"];
  const badgeColumns = ["Badge Types"]; // Columns for badges
  const specialAwardsColumns = ["Special Awards"]; // Columns for special awards
  const badgePointsColumns = ["Badge Types", "Points"]; // Columns for badge points
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);

  const fetchSpecialAwards = async () => {
    try {
      const db = getFirestore();
      const docRef = doc(db, "Flight Points", "Special Awards");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const specialAwardTypes = data["Special Awards"];
        if (Array.isArray(specialAwardTypes)) {
          // Transform the array into an array of objects
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
  };
  const fetchEventCategories = async () => {
    try {
      const db = getFirestore();
      const docRef = doc(db, "Flight Points", "Event Category Points");
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
  };

  const fetchBadgePoints = async () => {
    try {
      const db = getFirestore();
      const docRef = doc(db, "Flight Points", "Badge Points");
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
  };

  const fetchBadges = async () => {
    try {
      const db = getFirestore();
      const docRef = doc(db, "Flight Points", "Badges");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const badgeTypes = data["Badge Types"];
        if (Array.isArray(badgeTypes)) {
          // Transform the array into an array of objects
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
  };

  useEffect(() => {


    fetchSpecialAwards();
    fetchBadgePoints();
    fetchEventCategories();
    fetchBadges();
  }, []);

  return (
    <div className="event-categories-dashboard">
      {/* Horizontal Menu */}
      <div className="horizontal-menu">
        <button
          className={activeTab === "eventcategories" ? "active" : ""}
          onClick={() => setActiveTab("eventcategories")}
        >
          Event Categories
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
          <div>
            <Table columns={eventCategoryColumns} data={categories} disableHover={true} width="30%"/>
          </div>
        )}
        {activeTab === "badges" && (
          <div>
            <button className="add-entry-button" onClick={() => setIsAddEntryOpen(true)}>
              Add New Badge Type
            </button>
            <Table columns={badgeColumns} data={badges} disableHover={true} width="30%" />
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
          <div>
            <Table columns={badgePointsColumns} data={badgePoints} disableHover={true} width="30%"/>
          </div>
        )}
        {activeTab === "specialawards" && (
          <div>
            <button className="add-entry-button" onClick={() => setIsAddEntryOpen(true)}>
              Add New Special Award
            </button>
            <Table columns={specialAwardsColumns} data={specialAwards} disableHover={true} width="30%"/>
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
    </div>
  );
};

export default EventCategoriesDashboard;