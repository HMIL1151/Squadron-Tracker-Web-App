import React from "react";
// Its own styles, like ErrorMessage. Without this the toast rendered unstyled
// unless some other component on screen happened to have pulled the file in.
import "./dashboardStyles.css";

const SuccessMessage = ({ message }) => {
  if (!message) return null;

  return <div className="success-popup">{message}</div>;
};

export default SuccessMessage;