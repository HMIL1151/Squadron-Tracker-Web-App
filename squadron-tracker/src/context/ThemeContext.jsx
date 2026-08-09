import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { fetchThemePreference, saveThemePreference } from "../firebase/preferences";

/**
 * Which theme the app is showing, and how to change it.
 *
 * Two stores, with different jobs, because neither can do both:
 *
 *   localStorage is authoritative for PAINT. It is the only one readable
 *   synchronously, and the inline script in index.html uses it to set
 *   data-theme before the first frame. Without that the page renders light and
 *   then flips, which on a dark-mode device is a full-screen white flash on
 *   every load.
 *
 *   Firestore is authoritative for the ACCOUNT, so the choice follows the user
 *   to another device. It cannot inform the first paint: the read is async and
 *   needs auth to have resolved, which happens well after render.
 *
 * So the two reconcile rather than compete. localStorage paints, Firestore is
 * consulted once a uid arrives, and if they disagree the account wins and the
 * cache is corrected. The visible consequence is that signing in on a new
 * device can flip the theme a moment after login -- which is the behaviour
 * "follow me across devices" actually means.
 */

const STORAGE_KEY = "squadron-tracker:theme";
const THEMES = ["light", "dark"];

const ThemeContext = createContext(null);

/** What the pre-paint script decided, so the provider starts in agreement. */
const readInitialTheme = () => {
  if (typeof document === "undefined") return "light";
  const applied = document.documentElement.getAttribute("data-theme");
  if (THEMES.includes(applied)) return applied;
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const readStored = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(value) ? value : null;
  } catch {
    // Private browsing can make localStorage throw. Not having a cached
    // preference is a normal state, not a failure.
    return null;
  }
};

export const ThemeProvider = ({ children, uid: uidProp = null, initialTheme = null }) => {
  const [theme, setTheme] = useState(initialTheme ?? readInitialTheme);
  const [authUid, setAuthUid] = useState(null);

  /*
   * The provider finds the signed-in user itself rather than taking it as a
   * prop. It sits above App, where the user state lives, so a prop would mean
   * either plumbing a setter back upwards or moving the provider inside App and
   * losing the theme on the sign-in screen. Subscribing here keeps it whole.
   *
   * `uid` as a prop still wins when given, which is what tests use to exercise
   * the account path without an auth stub.
   */
  useEffect(() => {
    if (uidProp) return undefined;
    const unsubscribe = onAuthStateChanged(auth, (current) => {
      setAuthUid(current?.uid ?? null);
    });
    return () => unsubscribe?.();
  }, [uidProp]);

  const uid = uidProp ?? authUid;

  // Whether the user has ever chosen, as opposed to following the OS. Only an
  // explicit choice is worth writing anywhere.
  const [isExplicit, setIsExplicit] = useState(() => readStored() !== null);

  /*
   * The attribute is what the stylesheet keys off, so it is set here rather
   * than left to whoever changed the state. Setting it unconditionally -- even
   * when following the OS -- would defeat the prefers-color-scheme default,
   * which is why it is removed when no explicit choice exists.
   */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (isExplicit) {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }

    // The browser-chrome colour cannot follow a media query once the user has
    // overridden it, so it is updated directly.
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#16181d" : "#282c34");
  }, [theme, isExplicit]);

  /*
   * Reconcile with the account once a uid exists. Runs on sign-in rather than
   * on mount, because before that there is nothing to reconcile with.
   */
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    fetchThemePreference(uid).then((saved) => {
      if (cancelled || !saved) return;
      setTheme(saved);
      setIsExplicit(true);
      try {
        localStorage.setItem(STORAGE_KEY, saved);
      } catch {
        // Nothing to do: the theme still applies for this session.
      }
    });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  const chooseTheme = useCallback(
    (next) => {
      if (!THEMES.includes(next)) return;
      setTheme(next);
      setIsExplicit(true);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // The choice still applies to this session; it just will not survive
        // a reload. Better than refusing to switch.
      }
      if (uid) saveThemePreference(uid, next);
    },
    [uid]
  );

  const toggleTheme = useCallback(
    () => chooseTheme(theme === "dark" ? "light" : "dark"),
    [chooseTheme, theme]
  );

  return (
    <ThemeContext.Provider value={{ theme, isExplicit, chooseTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside a ThemeProvider");
  return value;
};

export default ThemeContext;
