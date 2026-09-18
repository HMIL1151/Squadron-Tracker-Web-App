import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { fetchUiPreference, saveUiPreference } from "../firebase/preferences";
import {
  DEFAULT_UI_VERSION,
  fetchSystemUiVersion,
  isUiVersion,
  saveSystemUiVersion,
} from "../firebase/systemConfig";

/**
 * Which interface the app is showing, and who gets to decide.
 *
 * Three layers, highest first:
 *
 *   The URL (`?ui=muster`, `?ui=classic`). Session-scoped and beats everything,
 *   including the account. It is the escape hatch: if the new interface breaks
 *   in a way that stops someone reaching the control that would switch it off,
 *   this still gets them out, and it is how QA and the screenshot suite pin a
 *   version without touching anyone's stored preference.
 *
 *   The user's own choice, in UserPreferences/{uid}. Follows them across
 *   devices. Null means "no opinion", which is NOT the same as "classic" -- a
 *   user who explicitly picked classic must stay on classic after the system
 *   default moves, or the rollout silently re-opts in people who opted out.
 *
 *   The system default, in SystemConfig/ui, set by a system admin. This is the
 *   kill switch: one field, no deploy, everyone without a personal preference
 *   is back on the old interface on their next load.
 *
 * The same localStorage/Firestore split as ThemeContext, for the same reason:
 * localStorage is the only store readable synchronously, so it is what the
 * pre-paint script in index.html uses to avoid rendering one interface and
 * then swapping to the other. Firestore is authoritative for the account but
 * cannot inform first paint. So they reconcile rather than compete -- the
 * cache paints, the account corrects it once a uid arrives.
 *
 * Note the sign-in screen can only ever use the cache: SystemConfig requires a
 * signed-in user to read (see firestore.rules), so a first-ever visit on a new
 * device shows the classic welcome page whatever the system default says. Every
 * load after that is correct. Widening that rule to public read would fix it at
 * the cost of the ruleset's "no anonymous access" invariant, which did not seem
 * worth it for one string.
 */

const STORAGE_KEY = "squadron-tracker:ui";
const URL_PARAM = "ui";

const UiVersionContext = createContext(null);

/** An explicit `?ui=` on this load, or null. Not persisted to the account. */
const readUrlOverride = () => {
  if (typeof window === "undefined") return null;
  try {
    const value = new URLSearchParams(window.location.search).get(URL_PARAM);
    return isUiVersion(value) ? value : null;
  } catch {
    return null;
  }
};

const readStored = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isUiVersion(value) ? value : null;
  } catch {
    // Private browsing can make localStorage throw. No cached choice is a
    // normal state, not a failure.
    return null;
  }
};

const writeStored = (version) => {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // The choice still applies for this session; it just will not survive a
    // reload. Better than refusing to switch.
  }
};

/** What the pre-paint script decided, so the provider starts in agreement. */
const readInitialVersion = () => {
  if (typeof document === "undefined") return DEFAULT_UI_VERSION;
  const applied = document.documentElement.getAttribute("data-ui");
  if (isUiVersion(applied)) return applied;
  return readUrlOverride() ?? readStored() ?? DEFAULT_UI_VERSION;
};

export const UiVersionProvider = ({
  children,
  uid: uidProp = null,
  initialVersion = null,
}) => {
  // Captured once. Re-reading it per render would let a later history change
  // silently move the user between interfaces mid-session.
  const [urlOverride] = useState(readUrlOverride);

  const [uiVersion, setUiVersion] = useState(
    () => initialVersion ?? urlOverride ?? readInitialVersion()
  );
  const [systemDefault, setSystemDefault] = useState(null);
  const [hasPreference, setHasPreference] = useState(() => readStored() !== null);
  const [authUid, setAuthUid] = useState(null);

  /*
   * The provider finds the signed-in user itself rather than taking it as a
   * prop, for the same reason ThemeProvider does: it sits above App, where the
   * user state lives, and taking a prop would mean either plumbing a setter
   * upwards or moving the provider inside App and losing the setting on the
   * sign-in screen.
   */
  useEffect(() => {
    if (uidProp) return undefined;
    const unsubscribe = onAuthStateChanged(auth, (current) => {
      setAuthUid(current?.uid ?? null);
    });
    return () => unsubscribe?.();
  }, [uidProp]);

  const uid = uidProp ?? authUid;

  /*
   * The attribute is what the stylesheets and the shell key off, so it is set
   * here rather than left to whoever changed the state. Always present, unlike
   * data-theme -- there is no "follow the operating system" case for this, so
   * there is no reason to leave it unset.
   */
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-ui", uiVersion);
  }, [uiVersion]);

  /*
   * Reconcile with the account once a uid exists.
   *
   * Two things skip it. A URL override is meant to win for the session, and
   * letting the account correct it a moment later would defeat the escape
   * hatch. An explicit `initialVersion` is a pin for the same reason: it is
   * what tests and the screenshot suite use to say "render THIS interface",
   * and a reconcile that quietly swapped it a tick later would make every
   * such test render one interface, assert against it, and sometimes finish
   * before the swap and sometimes not. The app itself never passes it.
   */
  useEffect(() => {
    if (!uid || urlOverride || initialVersion) return undefined;
    let cancelled = false;

    (async () => {
      const [preference, systemValue] = await Promise.all([
        fetchUiPreference(uid),
        fetchSystemUiVersion(),
      ]);
      if (cancelled) return;

      const resolved = preference ?? systemValue ?? DEFAULT_UI_VERSION;

      /*
       * Functional updates that return the previous value when nothing moved.
       * React bails out of the re-render in that case, which matters here
       * because this effect fires on every sign-in: without it, the common
       * path -- account agrees with the cache -- still queued three state
       * updates and a repaint, and in tests produced an act() warning for a
       * render that never needed to happen.
       */
      setSystemDefault((prev) => (prev === systemValue ? prev : systemValue));
      setHasPreference((prev) => (prev === (preference !== null) ? prev : preference !== null));
      setUiVersion((prev) => (prev === resolved ? prev : resolved));
      writeStored(resolved);
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, urlOverride, initialVersion]);

  /** This user's own choice, from here on, on every device they sign in on. */
  const chooseUiVersion = useCallback(
    (next) => {
      if (!isUiVersion(next)) return;
      setUiVersion(next);
      setHasPreference(true);
      writeStored(next);
      if (uid) saveUiPreference(uid, next);
    },
    [uid]
  );

  /**
   * Change what everyone without a personal choice gets. System admins only;
   * the rules reject it for anyone else, which is why this reports success
   * rather than assuming it.
   *
   * The caller's own view follows, because an admin who flips the default and
   * sees nothing change will reasonably conclude it did not work.
   */
  const chooseSystemDefault = useCallback(
    async (next) => {
      if (!isUiVersion(next)) return false;
      const saved = await saveSystemUiVersion(next);
      if (!saved) return false;
      setSystemDefault(next);
      if (!hasPreference) {
        setUiVersion(next);
        writeStored(next);
      }
      return true;
    },
    [hasPreference]
  );

  /** Drop this user's own choice and follow the system default again. */
  const clearUiPreference = useCallback(() => {
    setHasPreference(false);
    const resolved = systemDefault ?? DEFAULT_UI_VERSION;
    setUiVersion(resolved);
    writeStored(resolved);
    if (uid) saveUiPreference(uid, resolved);
  }, [systemDefault, uid]);

  return (
    <UiVersionContext.Provider
      value={{
        uiVersion,
        isMuster: uiVersion === "muster",
        systemDefault,
        hasPreference,
        isPinnedByUrl: urlOverride !== null,
        chooseUiVersion,
        chooseSystemDefault,
        clearUiPreference,
      }}
    >
      {children}
    </UiVersionContext.Provider>
  );
};

export const useUiVersion = () => {
  const value = useContext(UiVersionContext);
  if (!value) throw new Error("useUiVersion must be used inside a UiVersionProvider");
  return value;
};

/**
 * The interface, for code that must work with or without the provider.
 *
 * ThemeProvider needs this: it has to know whether to offer dark mode, but it
 * is also rendered on its own in tests that predate this context and have no
 * business knowing about it.
 */
export const useUiVersionOrDefault = () => {
  const value = useContext(UiVersionContext);
  return value?.uiVersion ?? DEFAULT_UI_VERSION;
};

export default UiVersionContext;
