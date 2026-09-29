import { useEffect, useRef } from "react";
import { MusterButton } from "./MusterControls";
import styles from "./MusterDialog.module.css";

/**
 * A Muster dialog.
 *
 * The app already has Modal and Popup, and both are kept -- every screen that
 * still falls back to its classic component opens them. This is the one the
 * Muster screens use for things they do themselves, and it differs in the ways
 * that were actually wrong with the old ones rather than in styling for its
 * own sake:
 *
 *   It closes on Escape and on a click outside. The classic popups close only
 *   on their own button, which is the single most common complaint about a
 *   modal anywhere.
 *
 *   Focus moves into it on open and the first field is focused, so a keyboard
 *   user is not left behind on the page underneath.
 *
 *   The actions are in a footer, in a fixed order, with the confirming one on
 *   the right. Classic puts them wherever the form happened to end.
 *
 * Deliberately not a focus TRAP. A real trap needs to handle shift-tab off the
 * first element, portals, and iframes, and getting it half-right is worse than
 * not claiming it -- so this moves focus in and restores it on close, and says
 * so rather than pretending to more.
 */
const MusterDialog = ({
  open,
  title,
  description,
  onClose,
  onConfirm,
  confirmLabel = "Save",
  confirmDisabled = false,
  error = null,
  children,
}) => {
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);

  /*
   * onClose through a ref, and the effect keyed on `open` alone.
   *
   * Callers pass an inline `() => setEditing(null)`, a new function every
   * render, and with onClose in the dependency list the effect re-ran on each
   * keystroke: its cleanup put focus back on the page, then it focused the
   * dialog's first focusable element -- the header's Close button. So after
   * one character everything else typed went to Close, and a space in
   * "Parade Night" shut the dialog and threw the form away.
   */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    returnFocusRef.current = document.activeElement;
    // A field first, as promised above; the header's Close button is only the
    // fallback for a dialog with nothing to fill in.
    const firstField =
      panelRef.current?.querySelector("input, select, textarea") ||
      panelRef.current?.querySelector("button");
    firstField?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Back where they were, so closing a dialog does not dump the user at
      // the top of the page.
      if (returnFocusRef.current instanceof HTMLElement) returnFocusRef.current.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={styles.scrim}
      /*
       * The scrim closes on a click that both started and ended on it. Using
       * onClick alone means a drag that begins inside the panel and releases
       * on the scrim -- selecting text, for instance -- closes the dialog and
       * loses what was typed.
       */
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={styles.panel}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>{title}</h2>
            {description && <p className={styles.description}>{description}</p>}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>

        <form
          className={styles.body}
          onSubmit={(event) => {
            event.preventDefault();
            if (!confirmDisabled) onConfirm();
          }}
        >
          {children}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <footer className={styles.footer}>
            <MusterButton onClick={onClose}>Cancel</MusterButton>
            <MusterButton kind="primary" type="submit" disabled={confirmDisabled}>
              {confirmLabel}
            </MusterButton>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default MusterDialog;
