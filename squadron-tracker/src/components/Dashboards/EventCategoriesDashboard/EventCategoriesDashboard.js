import React, { useEffect, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore/lite";
import Table from "../../Table/Table";
import "./EventCategoriesDashboard.css";

const EventCategoriesDashboard = () => {
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState("table"); // State to track active tab
  const columns = ["Category", "Points"];

  useEffect(() => {
    const fetchEventCategories = async () => {
      try {
        const db = getFirestore();
        const docRef = doc(db, "Flight Points", "Event Category Points");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const formattedData = Object.entries(data).map(([category, points]) => ({
            Category: category,
            Points: points,
          }));
          setCategories(formattedData);
        } else {
          console.error("No such document!");
        }
      } catch (error) {
        console.error("Error fetching event categories:", error);
      }
    };

    fetchEventCategories();
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
            <h2>Event Categories</h2>
            <Table columns={columns} data={categories} disableHover={true} />
          </div>
        )}
        {activeTab === "badges" && (
          <div>
            <h2>Badges</h2>
            <p>List of PTS Badges (maybe brassard interface?).</p>
          </div>
        )}
        {activeTab === "badgepoints" && (
          <div>
            <h2>Badge Points</h2>
            <p>Points associated with different badge colours/special awards</p>
          </div>
        )}
        {activeTab === "specialawards" && (
          <div>
            <h2>Special Awards</h2>
            <p>List of special awards and points</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventCategoriesDashboard;