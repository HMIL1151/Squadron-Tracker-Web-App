import React from "react";

const SuccessMessage = ({ message }) => {
  if (!message) return null;

  return <div className="success-popup">{message}</div>;
};

export default SuccessMessage;