import React from "react";
import shared from "./dashboardStyles.module.css";

const Form = ({ title, fields, handleInputChange }) => {
  return (
    <form className={"form"}>
      {title && <h2 className={"form-title"}>{title}</h2>}
      {fields.map((field, index) => (
        <div className={shared["form-group"]} key={index}>
          <label className={shared["form-label"]} htmlFor={field.id}>
            {field.label}
          </label>
          {field.type === "select" ? (
            <select
              id={field.id}
              name={field.name}
              value={field.value || ""}
              onChange={handleInputChange}
              className={shared["form-select"]}
            >
              <option value="" disabled>
                {field.placeholder}
              </option>
              {Object.entries(field.options || {}).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={field.id}
              type={field.type}
              name={field.name}
              value={field.value || ""}
              onChange={handleInputChange}
              className={shared["form-input"]}
            />
          )}
        </div>
      ))}
    </form>
  );
};

export default Form;