import React from "react";

const Form = ({ title, fields, handleInputChange }) => {
  return (
    <form className="form">
      {title && <h2 className="form-title">{title}</h2>}
      {fields.map((field, index) => (
        <div className="form-group" key={index}>
          <label className="form-label" htmlFor={field.id}>
            {field.label}
          </label>
          {field.type === "select" ? (
            <select
              id={field.id}
              name={field.name}
              value={field.value || ""}
              onChange={handleInputChange}
              className="form-select"
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
              className="form-input"
            />
          )}
        </div>
      ))}
    </form>
  );
};

export default Form;