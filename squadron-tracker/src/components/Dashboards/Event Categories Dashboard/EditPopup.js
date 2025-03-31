import React, { useState, useEffect } from "react";
import "../Dashboard Components/dashboardStyles.css";

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

  if (!isOpen) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-content">
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
        <div className="popup-bottom-buttons">
          <button className="popup-button-red" onClick={onClose}>
            Cancel
          </button>
          <button className="popup-button-green" onClick={handleSubmit}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPopup;