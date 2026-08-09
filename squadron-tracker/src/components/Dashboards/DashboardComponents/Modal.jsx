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
 * `size` exists because the popups genuinely differed -- a short confirm prompt
 * and a tall scrolling event form are not the same dialog -- and because those
 * differences used to be expressed as five competing definitions of
 * .popup-content, resolved by whichever dashboard the user opened first. The
 * size is now stated at the call site. See Modal.css.
 *
 * The rendered class names are deliberately unchanged. react-modal prepends its
 * own ReactModal__Content/Overlay and keeps ours, so the styling here and the
 * tests that query `.popup-content` both keep working through the change.
 */
const Modal = ({
  isOpen,
  onClose,
  label,
  size = "sm",
  variant,
  closeOnOverlayClick = true,
  children,
}) => (
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
    contentLabel={label}
    shouldCloseOnOverlayClick={closeOnOverlayClick}
    /*
     * react-modal hides the rest of the app from assistive technology while a
     * dialog is open, which needs to know what "the rest of the app" is.
     * src/index.jsx names it for the running app and setupTests.js for the
     * suite; without either, react-modal warns on every render.
     */
    ariaHideApp
  >
    {children}
  </ReactModal>
);

export default Modal;
