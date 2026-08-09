import React from "react";
import Modal from "./Modal";
import "./Popup.css";

/**
 * A confirm/cancel prompt.
 *
 * Now a thin arrangement of buttons over Modal, which owns the dialog itself.
 * The markup it renders is unchanged, so both call sites and the tests that
 * query `.popup-content` are untouched -- what changed is that the dialog is a
 * real one: focus is trapped, Escape closes it, and it announces itself as a
 * dialog rather than as an anonymous div.
 */
const Popup = ({ isOpen, onClose, onConfirm, label = "Confirm", children }) => (
  <Modal isOpen={isOpen} onClose={onClose} label={label} size="sm">
    <span className="popup-close" onClick={onClose}>
      &times;
    </span>
    {children}
    <div className="popup-bottom-buttons">
      <button className="popup-button-red" onClick={onClose}>
        Cancel
      </button>
      <button className="popup-button-green" onClick={onConfirm}>
        Confirm
      </button>
    </div>
  </Modal>
);

export default Popup;
