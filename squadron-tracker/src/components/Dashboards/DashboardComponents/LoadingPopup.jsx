import React from "react";
import styles from "./LoadingPopup.module.css";

/**
 * The spinner shown while something slow is happening.
 *
 * `message` is optional and defaults to the text this has always shown, so
 * every existing caller renders exactly what it did before. It exists because
 * generating a zip of certificates takes one jsPDF render per cadet, and a
 * spinner that says "Loading, please wait..." for thirty seconds is
 * indistinguishable from one that has hung -- whereas "Generating certificate
 * for Amelia Hart... (3/10)" is visibly making progress.
 */
const LoadingPopup = ({ message }) => {
  return (
    <div className={styles["loading-popup"]}>
      <div className={styles["loading-spinner"]}></div>
      <p>{message || "Loading, please wait..."}</p>
    </div>
  );
};

export default LoadingPopup;
