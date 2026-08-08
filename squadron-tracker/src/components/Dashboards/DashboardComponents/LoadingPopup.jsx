import React from "react";
import "./LoadingPopup.css";

const LoadingPopup = () => {
  return (
    <div className="loading-popup">
      <div className="loading-spinner"></div>
      <p>Loading, please wait...</p>
    </div>
  );
};

export default LoadingPopup;