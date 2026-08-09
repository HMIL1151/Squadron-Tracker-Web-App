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
  <Modal isOpen={isOpen} onClose={onClose} label={label} size="sm" onConfirm={onConfirm}>
    {children}
  </Modal>
);

export default Popup;
