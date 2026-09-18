import { useUiVersion } from "../../context/UiVersionContext";
import styles from "./UiToggle.module.css";

/**
 * Lets one user switch between the old interface and the new one.
 *
 * Separate from the system default on purpose. During a rollout the two jobs
 * are different: a system admin decides what everyone gets, and an individual
 * decides whether they are ready for it. Pressing this records a preference on
 * the account, which is what stops a later change to the default silently
 * dragging someone back into an interface they had already rejected.
 *
 * Hidden entirely when `?ui=` pinned the interface for this session. The
 * button would still write a preference, but the pin would keep overriding it
 * until the page was reloaded without the parameter -- a control that appears
 * to do nothing is worse than no control.
 *
 * Text rather than an icon. There is no established glyph for "different
 * interface", and this is a thing people press once.
 */
const UiToggle = () => {
  const { uiVersion, chooseUiVersion, isPinnedByUrl } = useUiVersion();

  if (isPinnedByUrl) return null;

  const isMuster = uiVersion === "muster";
  const next = isMuster ? "classic" : "muster";

  return (
    <button
      type="button"
      className={styles["ui-toggle"]}
      onClick={() => chooseUiVersion(next)}
      title={
        isMuster
          ? "Go back to the interface the app has always had"
          : "Try the rebuilt interface. You can switch back at any time."
      }
    >
      {isMuster ? "Use Classic View" : "Try New View"}
    </button>
  );
};

export default UiToggle;
