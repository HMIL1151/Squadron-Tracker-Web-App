import React, { useEffect, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore/lite";
import Table from "../../Table/Table";

const EventCategoriesDashboard = () => {
  const [categories, setCategories] = useState([]);
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
    <div>
      <h2>Event Categories Dashboard</h2>
      <Table columns={columns} data={categories} disableHover={true} />
    </div>
  );
};

export default EventCategoriesDashboard;