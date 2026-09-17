import { useState } from "react";
import { useUiVersion } from "../../../context/UiVersionContext";
import styles from "./InterfaceSetting.module.css";

/**
 * The interface kill switch.
 *
 * Changing this moves every user who has not made their own choice, on their
 * next load, with no deploy. It exists so that "the new interface is a problem"
 * is a thirty-second fix rather than a release.
 *
 * Deliberately plain: two options, what each one means, and what happens when
 * you pick it. The temptation with a control this powerful is to guard it with
 * a confirmation dialog, but the whole point is that it is reachable in a
 * hurry, and it is trivially reversible -- pressing the other one puts it back.
 *
 * Only system admins see this dashboard at all, and the Firestore rules refuse
 * the write for anyone else, so an attempt that somehow gets here fails safely
 * and says so rather than appearing to work.
 */

/*
 * Explicit map rather than building `styles["option-" + version]`. Scoped
 * class names do not survive string concatenation, and a missed lookup renders
 * class="undefined" instead of failing -- which is exactly what the afterEach
 * guard in setupTests.js is there to catch.
 */
const OPTION_STATE = {
  active: styles["option-active"],
  inactive: styles["option"],
};

const OPTIONS = [
  {
    version: "classic",
    name: "Classic",
    description:
      "The interface the app has always had. Dark mode works here.",
  },
  {
    version: "muster",
    name: "Muster",
    description:
      "The rebuilt interface. Light only for now, so the dark mode button is hidden while it is on.",
  },
];

const InterfaceSetting = () => {
  const { systemDefault, uiVersion, hasPreference, chooseSystemDefault } = useUiVersion();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  // systemDefault is null until the read comes back, and stays null if nobody
  // has ever set it. Both mean the same thing to a reader of this screen:
  // everyone is getting classic.
  const current = systemDefault ?? "classic";

  const handleChoose = async (version) => {
    if (version === current || busy) return;
    setBusy(true);
    setStatus(null);
    const saved = await chooseSystemDefault(version);
    setBusy(false);
    setStatus(
      saved
        ? { ok: true, text: `Everyone without their own choice now gets ${version === "muster" ? "Muster" : "Classic"}.` }
        : { ok: false, text: "That did not save. You may not have system admin rights any more." }
    );
  };

  return (
    <section className={styles["interface-setting"]}>
      <h2>Interface</h2>
      <p className={styles.lead}>
        Which interface everyone gets unless they have chosen one themselves.
        Takes effect on each user&rsquo;s next load.
      </p>

      <div className={styles.options}>
        {OPTIONS.map((option) => {
          const isCurrent = option.version === current;
          return (
            <button
              key={option.version}
              type="button"
              className={isCurrent ? OPTION_STATE.active : OPTION_STATE.inactive}
              onClick={() => handleChoose(option.version)}
              aria-pressed={isCurrent}
              disabled={busy}
            >
              <span className={styles["option-name"]}>{option.name}</span>
              <span className={styles["option-description"]}>{option.description}</span>
              {isCurrent && <span className={styles["option-badge"]}>Current default</span>}
            </button>
          );
        })}
      </div>

      {status && (
        <p className={status.ok ? styles["status-ok"] : styles["status-error"]} role="status">
          {status.text}
        </p>
      )}

      {hasPreference && (
        <p className={styles.note}>
          You have picked {uiVersion === "muster" ? "Muster" : "Classic"} for your own account, so
          changing the default here will not change what you see.
        </p>
      )}
    </section>
  );
};

export default InterfaceSetting;
