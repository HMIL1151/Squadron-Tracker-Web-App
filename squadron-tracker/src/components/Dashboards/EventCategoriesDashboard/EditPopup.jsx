import React, { useState, useEffect } from "react";
import Modal from "../DashboardComponents/Modal";
import shared from "../DashboardComponents/dashboardStyles.module.css";
// .edit-popup is scoped by the dashboard's module, so the class has to be
// read from there -- a name defined in one module does not match another.
import styles from "./EventCategoriesDashboard.module.css";

const EditPopup = ({ isOpen, onClose, onConfirm, data, type }) => {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (data) {
      setFormData(data); // Initialize formData with the current data
    }
  }, [data]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = () => {
    onConfirm(formData);
    onClose();
  };
  /*
   * Still an early return, even though Modal takes isOpen.
   *
   * JSX children are built before Modal can decide not to show them, so
   * without this the closed state evaluates markup that reads props which
   * are only populated while open, and throws.
   */
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Entry"
      size="sm"
      variant={styles["edit-popup"]}
      onConfirm={handleSubmit}
    >
      <h3>
    {type === "eventcategories"
        ? "Edit Event Category"
        : type === "badgepoints"
        ? "Edit Badge Points"
        : type === "badges"
        ? "Edit Badge Type"
        : "Edit Special Award"}
    </h3>
        {type === "eventcategories" || type === "badgepoints" ? (
          <>
            <label>
              Name:
              <input
                type="text"
                name="Category"
                value={formData.Category || formData["Badge Types"] || ""}
                onChange={handleChange}
              />
            </label>
            <label>
              Points:
              <input
                type="number"
                name="Points"
                value={formData.Points || ""}
                onChange={handleChange}
              />
            </label>
          </>
        ) : (
          <label>
            Name:
            <input
              type="text"
              name={type === "badges" ? "Badge Types" : "Special Awards"}
              value={formData["Badge Types"] || formData["Special Awards"] || ""}
              onChange={handleChange}
            />
          </label>
        )}
    </Modal>
  );
};

export default EditPopup;