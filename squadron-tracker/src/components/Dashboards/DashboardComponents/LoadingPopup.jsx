import React from "react";
import styles from "./LoadingPopup.module.css";

const LoadingPopup = () => {
  return (
    <div className={styles["loading-popup"]}>
      <div className={styles["loading-spinner"]}></div>
      <p>Loading, please wait...</p>
    </div>
  );
};

export default LoadingPopup;