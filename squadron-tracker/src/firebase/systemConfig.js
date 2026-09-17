/**
 * Application-wide settings, as opposed to per-user ones.
 *
 * Only one setting so far: which interface the app shows by default. It lives
 * in Firestore rather than in an environment variable or the bundle because
 * the point of it is to be changeable WITHOUT a deploy. If the new interface
 * turns out to be wrong for people, a system admin flips this field and every
 * user is back on the old one on their next load.
 *
 * SystemConfig/ui is readable by any signed-in user -- it has to be, since the
 * answer decides what they are shown, and it is needed before membership of a
 * squadron is known. Writes are system-admin only; see firestore.rules.
 *
 * Both functions swallow read errors and fall back to "classic". A settings
 * lookup that fails should leave people on the interface that has been in
 * production longest, not on the new one and not on an error screen.
 */

import { db, doc, getDoc, setDoc } from "./db";

/**
 * The interfaces that exist.
 *
 * Exported because three layers need to agree on these strings -- the
 * pre-paint script in index.html, this module, and UiVersionContext -- and a
 * typo in any of them is a silent fallback rather than an error.
 */
export const UI_VERSIONS = ["classic", "muster"];

/** What a user gets when nothing anywhere has an opinion. */
export const DEFAULT_UI_VERSION = "classic";

const CONFIG_DOC = "ui";

export const isUiVersion = (value) => UI_VERSIONS.includes(value);

/**
 * The interface every user gets unless they have chosen otherwise.
 *
 * Returns null rather than the default when there is no answer, so the caller
 * can tell "nobody has set this" apart from "somebody set it to classic". The
 * distinction matters: only the second should override a user's own choice.
 */
export const fetchSystemUiVersion = async () => {
  try {
    const snapshot = await getDoc(doc(db(), "SystemConfig", CONFIG_DOC));
    const version = snapshot.exists() ? snapshot.data().defaultVersion : null;
    return isUiVersion(version) ? version : null;
  } catch (error) {
    console.warn("Could not read the system interface setting:", error);
    return null;
  }
};

/**
 * Change the interface everyone gets. System admins only -- the rules enforce
 * it, and this will reject for anyone else.
 *
 * merge, so this never clobbers a setting some later feature adds alongside.
 */
export const saveSystemUiVersion = async (version) => {
  if (!isUiVersion(version)) return false;
  try {
    await setDoc(
      doc(db(), "SystemConfig", CONFIG_DOC),
      { defaultVersion: version },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.warn("Could not save the system interface setting:", error);
    return false;
  }
};
