import styles from "./MusterPage.module.css";

/**
 * The frame every Muster screen sits in: a header strip, then the content.
 *
 * Exists so the ten screens cannot drift apart on the things people navigate
 * by -- where the title is, where the primary action is, how much air there is
 * before the first row. In the classic interface each dashboard laid itself
 * out, which is why the Add button is in a different place on almost every one
 * of them.
 *
 * The description is not decoration. Several of these screens are showing a
 * number that was derived rather than entered, and one line saying so is the
 * difference between a staff member trusting the screen and quietly keeping a
 * spreadsheet alongside it.
 */
const MusterPage = ({ title, description, actions, children }) => (
  <div className={styles.page}>
    <header className={styles.header}>
      <div className={styles.heading}>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
    <div className={styles.body}>{children}</div>
  </div>
);

export default MusterPage;
