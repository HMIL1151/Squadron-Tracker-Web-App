import { useId } from "react";
import styles from "./MusterField.module.css";

/**
 * A labelled form field.
 *
 * Exists so that every input in a Muster dialog has a real `<label for>` and
 * the same shape, rather than each dialog deciding for itself. The classic
 * forms mix labelled inputs, placeholder-as-label and bare inputs, which is
 * why some of them are unusable with a screen reader.
 */
const MusterField = ({ label, hint, children }) => {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children(id)}
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
};

export default MusterField;
