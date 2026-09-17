//TODO: Mass add Events from old tracker/from CSV file
//TODO: check that added entry is actually saved into firestore by returning the doc name for the entry then checking that the entry is in there

import React from "react";
import Table from "../../Table/Table";
import AddEventPopup from "./AddEventPopup";
import EventDetailsPopup from "./EventDetailsPopup"; // Import the new popup
import LoadingPopup from "../DashboardComponents/LoadingPopup"; // Import the new LoadingPopup component
import shared from "../DashboardComponents/dashboardStyles.module.css";
import SuccessMessage from "../DashboardComponents/SuccessMessage";
import ErrorMessage from "../DashboardComponents/ErrorMessage";
import useMassEventLog from "./useMassEventLog";
import table from "../../Table/Table.module.css";

/**
 * The classic event log.
 *
 * All of the behaviour moved to useMassEventLog when the Muster interface
 * needed the same thing; what is left is this screen's markup, unchanged. The
 * snapshot is the evidence that the extraction moved nothing.
 */
const MassEventLog = ({ user }) => {
  const log = useMassEventLog(user);

  const columns = ["Name", "Record", "Date", "Points"];

  return (
    <div className={table["table-dashboard-container"]}>
      {log.loading && <LoadingPopup />} {/* Show loading popup while loading */}
      <div className={shared["button-container"]}>
        <button className={shared["button-green"]} onClick={log.openPopup}>
          Add New Record
        </button>
      </div>
      <Table
        columns={columns}
        data={log.events}
        disableHover={false}
        width="80%"
        onRowClick={log.handleRowClick} // Add row click handler
      />
      <AddEventPopup
        isPopupOpen={log.isPopupOpen}
        inputValue={log.inputValue}
        filteredNames={log.filteredNames}
        badgeTypes={log.badgeTypes}
        eventCategories={log.eventCategories}
        specialAwards={log.specialAwards}
        highlightedIndex={log.highlightedIndex}
        selectedNames={log.selectedNames}
        handleInputChange={log.handleInputChange}
        handleKeyDown={log.handleKeyDown}
        handleNameSelect={log.handleNameSelect}
        handleRemoveName={log.handleRemoveName}
        handleAddEvent={log.handleAddEvent}
        closePopup={log.closePopup}
        eventDate={log.eventDate}
        handleDateChange={log.handleDateChange}
        onButtonSelect={log.handleButtonSelect}
      />
      <EventDetailsPopup
        isOpen={log.isEventPopupOpen}
        eventData={log.selectedEvent}
        onClose={log.closeEventPopup}
        onRemove={log.handleRemoveEvent}
      />
      <SuccessMessage message={log.successMessage} />
      <ErrorMessage message={log.errorMessage} />
    </div>
  );
};

export default MassEventLog;
