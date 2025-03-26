import React, { useState, useEffect } from "react";
import { fetchCollectionData } from "../../../firebase/firestoreUtils";
import Table from "../../Table/Table";
import "./MassEventLog.css";

const MassEventLog = ({ user }) => {
  const [events, setEvents] = useState([]);

  const columns = ["Name", "Event", "Date", "Points"];

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventData = await fetchCollectionData("Event Log");
        const formattedEvents = eventData.map((event) => {
          const { badgeCategory, badgeLevel, examName, eventName, specialAward } = event;

          let eventDescription = "";
          if (badgeCategory) {
            eventDescription = `${badgeLevel} ${badgeCategory}`;
          } else if (examName) {
            eventDescription = `${examName} Exam`;
          } else if (eventName) {
            eventDescription = eventName;
          } else if (specialAward) {
            eventDescription = specialAward;
          } else {
            throw new Error("Invalid event data: Missing required fields for event description.");
          }

          return {
            Name: event.cadetName,
            Event: eventDescription,
            Date: event.date,
            Points: Math.floor(Math.random() * 10) + 1, // Random number between 1-10
            AddedBy: event.addedBy,
            CreatedAt: event.createdAt,
            id: event.id, // Add the event ID
          };
        });

        setEvents(formattedEvents);
      } catch (error) {
        console.error("Error fetching events:", error);
      }
    };

    fetchEvents();
  }, []);

  return (
    <div className="table-dashboard-container">
      <div className="button-container">
        <button className="table-button">
          Add New Event
        </button>
      </div>
      <Table columns={columns} data={events} disableHover={false} width="80%" />
    </div>
  );
};

export default MassEventLog;