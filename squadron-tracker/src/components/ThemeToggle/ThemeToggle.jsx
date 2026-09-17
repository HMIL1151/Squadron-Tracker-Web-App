import { useTheme } from "../../context/ThemeContext";
import styles from "./ThemeToggle.module.module.css";

/**
 * Switches between light and dark.
 *
 * A button rather than a checkbox or a three-way control. There is a third
 * state -- following the operating system, which is what a user gets before
 * they ever touch this -- but exposing it as a visible option costs a wider
 * control and a label to explain it, for a choice most people make once. Once
 * pressed, the choice is explicit and sticks; "follow the system" remains the
 * default rather than a setting.
 *
 * aria-pressed rather than a label change, so a screen reader announces the
 * state instead of relying on the icon, and the accessible name stays stable.
 *
 * Renders nothing at all when the active interface has no dark palette. A
 * disabled button would be worse: it advertises a control that cannot be made
 * to work from here, and the reason it is unavailable has nothing to do with
 * this user or their permissions. The preference underneath is untouched, so
 * it comes back exactly as it was when dark is available again.
 */
const ThemeToggle = () => {
  const { theme, toggleTheme, canChooseTheme } = useTheme();
  const isDark = theme === "dark";

  if (!canChooseTheme) return null;

  return (
    <button
      type="button"
      className={styles["theme-toggle"]}
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label="Dark mode"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
    </button>
  );
};

export default ThemeToggle;
