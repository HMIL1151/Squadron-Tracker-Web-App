import React from "react";
import shared from "./dashboardStyles.module.css";

// Error counterpart of SuccessMessage: a fixed toast in the same position,
// red instead of green. Replaces the window.alert() calls that used to carry
// validation and failure messages.
const ErrorMessage = ({ message }) => {
  if (!message) return null;

  return <div className={shared["error-popup"]}>{message}</div>;
};

export default ErrorMessage;
