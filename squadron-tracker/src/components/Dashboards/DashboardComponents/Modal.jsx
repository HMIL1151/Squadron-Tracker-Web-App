import ReactModal from "react-modal";
import "./Modal.css";

/**
 * The dialog every popup in the app is built from.
 *
 * Built on react-modal, which was already a dependency and imported nowhere.
 * That matters for more than tidiness: none of the eight hand-rolled popups it
 * replaces had a focus trap, a role, an accessible name, Escape handling or
 * scroll locking. Each was a plain <div> with a click handler, so a keyboard or
 * screen-reader user could tab straight out of an open dialog into the page
 * behind it.
 *
 * The structure is fixed on purpose:
 *
 *   title    a heading, always in the same place, always the accessible name
 *   pane     optional secondary column, for dialogs that show a list beside
 *            the form -- adding exams is the case that needs it
 *   children the body
 *   footer   Cancel on the left, the confirming action on the right, and an
 *            optional third action between them
 *
 * Callers pass intent, not layout. Before this, every dialog decided for itself
 * where its buttons went and what they looked like, so Confirm was on the right
 * in one and the left in another, and two of them styled Cancel as the primary.
 * Passing `onConfirm` rather than a block of markup is what makes that
 * impossible rather than merely discouraged.
 *
 * `size` exists because the dialogs genuinely differ -- a short confirm prompt
 * and a tall scrolling event form are not the same thing -- and because those
 * differences used to be five competing definitions of .popup-content resolved
 * by whichever dashboard the user opened first. The size is now stated at the
 * call site. See Modal.css.
 *
 * The rendered class names are deliberately unchanged. react-modal prepends its
 * own ReactModal__Content/Overlay and keeps ours, so the styling here and the
 * tests that query `.popup-content` both keep working.
 */
const Modal = ({
  isOpen,
  onClose,
  label,
  title,
  size = "sm",
  variant,
  pane = null,
  closeOnOverlayClick = true,
  // Footer. Omitting onConfirm gives a dialog with no footer at all, which is
  // what the read-only ones want.
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDisabled = false,
  confirmTone = "action",
  extraAction = null,
  children,
}) => {
  // Resolved here rather than inline, so the className below contains class
  // names and nothing else -- a ternary on `confirmTone` inside className
  // reads as a class to anything scanning this file, including cssShape.
  const confirmClass = confirmTone === "danger" ? "popup-button-red" : "popup-button-green";

  return (
  <ReactModal
    isOpen={isOpen}
    onRequestClose={onClose}
    overlayClassName="popup-overlay"
    /*
     * `variant` is how a dialog claims its own content styling.
     *
     * Rules like `.popup-content h3 { ... }` sitting in a dashboard's
     * stylesheet used to restyle every OTHER dashboard's dialog as soon as that
     * dashboard had been visited, because .popup-content is one shared name.
     * Qualifying those rules with a variant instead keeps them where they
     * belong, without another wrapper element to disturb the layout.
     */
    className={["popup-content", `popup-${size}`, variant].filter(Boolean).join(" ")}
    contentLabel={label || title}
    shouldCloseOnOverlayClick={closeOnOverlayClick}
    /*
     * react-modal hides the rest of the app from assistive technology while a
     * dialog is open, which needs to know what "the rest of the app" is.
     * src/index.jsx names it for the running app and setupTests.js for the
     * suite; without either, react-modal warns on every render.
     */
    ariaHideApp
  >
    {title && <h3 className="modal-title">{title}</h3>}

    <div className={pane ? "modal-body modal-body-split" : "modal-body"}>
      <div className="modal-main">{children}</div>
      {pane && <div className="modal-pane">{pane}</div>}
    </div>

    {onConfirm && (
      <div className="popup-bottom-buttons">
        <button type="button" className="popup-button-red" onClick={onClose}>
          {cancelLabel}
        </button>
        {/*
          * The third action sits between the two fixed ones rather than at
          * either end, so that Cancel and Confirm never move when a dialog
          * gains or loses it.
          */}
        {extraAction ? <div className="modal-extra-action">{extraAction}</div> : <span />}
        <button
          type="button"
          className={confirmClass}
          onClick={onConfirm}
          disabled={confirmDisabled}
        >
          {confirmLabel}
        </button>
      </div>
    )}
  </ReactModal>
  );
};

export default Modal;
