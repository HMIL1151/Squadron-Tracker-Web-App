/**
 * Per-user interface preferences.
 *
 * UserPreferences/{uid} is its own top-level collection rather than a field on
 * MassUserList, because that collection's rules deliberately prevent a user
 * writing their own document -- checkUserRole treats `systemAdmin: true` on any
 * row there as system-admin status, so a self-write would be privilege
 * escalation. Preferences need exactly the opposite permission, so they get
 * their own space where self-write is safe. See firestore.rules.
 *
 * Both functions swallow their errors on purpose. A preference is a nicety: if
 * Firestore is unreachable, or the rules reject the read, the app should carry
 * on with whatever localStorage said rather than fail to render.
 */

import { db, doc, getDoc, setDoc } from "./db";
import { isUiVersion } from "./systemConfig";

const THEMES = ["light", "dark"];

/** The saved theme for a user, or null if they have never chosen one. */
export const fetchThemePreference = async (uid) => {
  if (!uid) return null;
  try {
    const snapshot = await getDoc(doc(db(), "UserPreferences", uid));
    const theme = snapshot.exists() ? snapshot.data().theme : null;
    return THEMES.includes(theme) ? theme : null;
  } catch (error) {
    console.warn("Could not read theme preference:", error);
    return null;
  }
};

/** Record a theme choice against the account, so it follows the user. */
export const saveThemePreference = async (uid, theme) => {
  if (!uid || !THEMES.includes(theme)) return;
  try {
    // merge, so this never clobbers a preference some later feature adds.
    await setDoc(doc(db(), "UserPreferences", uid), { theme }, { merge: true });
  } catch (error) {
    console.warn("Could not save theme preference:", error);
  }
};

/**
 * The interface this user has chosen, or null if they have never chosen.
 *
 * Null is not the same as "classic": a user with no preference follows the
 * system default, and one who has explicitly picked classic stays on classic
 * even after the default moves. Collapsing the two would silently re-opt
 * people into an interface they had already rejected.
 */
export const fetchUiPreference = async (uid) => {
  if (!uid) return null;
  try {
    const snapshot = await getDoc(doc(db(), "UserPreferences", uid));
    const version = snapshot.exists() ? snapshot.data().uiVersion : null;
    return isUiVersion(version) ? version : null;
  } catch (error) {
    console.warn("Could not read interface preference:", error);
    return null;
  }
};

/** Record an interface choice against the account, so it follows the user. */
export const saveUiPreference = async (uid, version) => {
  if (!uid || !isUiVersion(version)) return;
  try {
    await setDoc(doc(db(), "UserPreferences", uid), { uiVersion: version }, { merge: true });
  } catch (error) {
    console.warn("Could not save interface preference:", error);
  }
};
