import { useState } from "react";
import { findLegacyMemberships, repairLegacyMembership } from "../../../firebase/accessRepair";
import styles from "./AccessRepair.module.css";

/**
 * Finds and repairs users who are signed in but locked out of their squadron.
 *
 * See src/firebase/accessRepair.js for what "legacy membership" means and why
 * it locks people out. This panel is the console fix from docs/deploy-rules.md
 * step 3a, done for every squadron at once.
 *
 * The check is a button rather than something that runs on load. It reads
 * every squadron's member list, which is a lot of reads to spend each time a
 * system admin opens this screen for some other reason, and it means nothing
 * here can fail before anyone has asked it to.
 *
 * Repairing shows exactly what will change before it changes it, because the
 * "leftover" rows delete a document -- that is the right outcome, but it should
 * never be a surprise.
 */

const ACTION_TEXT = {
  rekey: "Restore access",
  leftover: "Remove old record",
};

/*
 * Explicit map rather than building the class name from the action. Scoped
 * class names do not survive string concatenation; see Modal.jsx.
 */
const ACTION_CLASS = {
  rekey: styles["access-repair-tag-rekey"],
  leftover: styles["access-repair-tag-leftover"],
};

const explain = (finding) => {
  if (finding.action === "rekey") {
    return "Saved under their access request instead of their account, so they see an empty tracker.";
  }
  if (finding.progress !== "granted") {
    return `Their access was ${finding.progress || "changed"} later, but this old record was left behind. Removing it does not give them access.`;
  }
  return "They already have a correct record. This one is a duplicate.";
};

const AccessRepair = () => {
  const [findings, setFindings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const scan = async () => {
    setBusy(true);
    setStatus(null);
    try {
      setFindings(await findLegacyMemberships());
    } catch (error) {
      console.error("Could not check squadron access:", error);
      setStatus({ ok: false, text: "The check did not complete. You may not have system admin rights any more." });
    } finally {
      setBusy(false);
    }
  };

  const repairAll = async () => {
    setBusy(true);
    setStatus(null);
    let repaired = 0;
    const failed = [];
    for (const finding of findings) {
      try {
        await repairLegacyMembership(finding);
        repaired += 1;
      } catch (error) {
        console.error("Could not repair access for", finding.email || finding.uid, error);
        failed.push(finding);
      }
    }
    setFindings(failed);
    setBusy(false);
    setStatus(
      failed.length === 0
        ? { ok: true, text: `Repaired ${repaired} record${repaired === 1 ? "" : "s"}. Affected users should sign out and back in.` }
        : { ok: false, text: `Repaired ${repaired}; ${failed.length} did not save and are still listed.` }
    );
  };

  return (
    <section className={styles["access-repair"]}>
      <h2>Locked-out users</h2>
      <p className={styles["access-repair-lead"]}>
        Users granted access before August 2026 may have been saved in a way the security
        rules no longer recognise. They can sign in, but their tracker is empty. This checks
        every squadron for them.
      </p>

      <button
        type="button"
        className={styles["access-repair-button"]}
        onClick={scan}
        disabled={busy}
      >
        {findings === null ? "Check all squadrons" : "Check again"}
      </button>

      {findings !== null && findings.length === 0 && !status && (
        <p className={styles["access-repair-status-ok"]} role="status">
          No locked-out users found.
        </p>
      )}

      {findings !== null && findings.length > 0 && (
        <>
          <ul className={styles["access-repair-list"]} aria-label="Records to repair">
            {findings.map((finding) => (
              <li key={`${finding.squadronNumber}/${finding.legacyId}`} className={styles["access-repair-item"]}>
                <div className={styles["access-repair-who"]}>
                  <strong>{finding.displayName || "Unnamed user"}</strong>
                  {finding.email && <span> ({finding.email})</span>}
                  <span className={ACTION_CLASS[finding.action]}>{ACTION_TEXT[finding.action]}</span>
                </div>
                <div className={styles["access-repair-where"]}>
                  {finding.squadronNumber} {finding.squadronName} &middot; {finding.role}
                </div>
                <div className={styles["access-repair-why"]}>{explain(finding)}</div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={styles["access-repair-button"]}
            onClick={repairAll}
            disabled={busy}
          >
            Repair {findings.length} record{findings.length === 1 ? "" : "s"}
          </button>
        </>
      )}

      {status && (
        <p className={status.ok ? styles["access-repair-status-ok"] : styles["access-repair-status-error"]} role="status">
          {status.text}
        </p>
      )}

      <p className={styles["access-repair-note"]}>
        Only members who joined through an access request can be checked. If someone with no
        request on file is locked out, fix their record in the Firebase console.
      </p>
    </section>
  );
};

export default AccessRepair;
