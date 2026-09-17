import { useId } from "react";
import { flightColour } from "../../utils/flights";
import styles from "./MusterControls.module.css";

/**
 * The small, repeated parts of the Muster interface.
 *
 * Together in one module because they are each a handful of lines and they are
 * always used together -- a toolbar is a search box, two or three chips and a
 * count. Ten separate files would be ten imports on every screen and no more
 * clarity.
 */

/*
 * Explicit maps rather than building class names from a prop. Scoped class
 * names do not survive string concatenation, and a missed lookup renders
 * class="undefined" instead of failing, which the afterEach guard in
 * setupTests.js catches.
 */
const BUTTON_KIND = {
  primary: styles["button-primary"],
  secondary: styles["button-secondary"],
  danger: styles["button-danger"],
};

const CHIP_STATE = {
  on: styles["chip-on"],
  off: styles.chip,
};

/**
 * A button.
 *
 * `type="button"` by default because almost every one of these sits inside
 * something that is, or will become, a form, and a button that defaults to
 * submit is a page reload waiting to happen.
 */
export const MusterButton = ({ kind = "secondary", icon = null, children, ...rest }) => (
  <button type="button" className={BUTTON_KIND[kind] || BUTTON_KIND.secondary} {...rest}>
    {icon}
    {children}
  </button>
);

/**
 * A filter chip.
 *
 * aria-pressed rather than a class alone, so the state is announced rather
 * than only shown. Filters are the one thing on these screens that changes
 * what the numbers mean, so a screen reader user finding out which are active
 * matters more here than on an ordinary toggle.
 */
export const MusterChip = ({ active = false, children, ...rest }) => (
  <button
    type="button"
    className={active ? CHIP_STATE.on : CHIP_STATE.off}
    aria-pressed={active}
    {...rest}
  >
    {children}
  </button>
);

/** A labelled search box. The label is visually hidden, not absent. */
export const MusterSearch = ({ label = "Search", value, onChange, placeholder, width = "240px" }) => {
  const id = useId();
  return (
    <div className={styles.search} style={{ width }}>
      <label htmlFor={id} className={styles["visually-hidden"]}>
        {label}
      </label>
      <svg
        className={styles["search-icon"]}
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="7.1" cy="7.1" r="4.3" />
        <path d="M10.4 10.4 13.4 13.4" />
      </svg>
      <input
        id={id}
        type="search"
        className={styles["search-input"]}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
};

/** A labelled dropdown, for the year pickers these screens all have. */
export const MusterSelect = ({ label, value, onChange, options, width = "auto" }) => {
  const id = useId();
  return (
    <div className={styles.field} style={{ width }}>
      <label htmlFor={id} className={styles["field-label"]}>
        {label}
      </label>
      <select
        id={id}
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

/**
 * The 3px colour bar that marks which flight a row belongs to.
 *
 * aria-hidden with the flight name alongside it, always. The colour is a
 * shortcut for people scanning, never the only carrier of the information --
 * a flight identified by hue alone is a flight some of your staff cannot read.
 */
export const FlightMark = ({ flight }) => (
  <span
    className={styles["flight-mark"]}
    style={{ backgroundColor: flightColour(flight) }}
    aria-hidden="true"
  />
);

/** The four-across strip of headline numbers at the top of a screen. */
export const SummaryStrip = ({ items }) => (
  <div className={styles.summary}>
    {items.map((item) => (
      <div key={item.label} className={styles["summary-tile"]}>
        <div className={styles["summary-label"]}>{item.label}</div>
        <div className={styles["summary-value"]}>{item.value}</div>
        {item.note && <div className={styles["summary-note"]}>{item.note}</div>}
      </div>
    ))}
  </div>
);

/**
 * What a screen shows when there is nothing to show.
 *
 * Always an invitation rather than a statement. "No records" tells someone
 * their filter is wrong or the squadron is new, and leaves them to work out
 * which; an empty state that names the next action does not.
 */
export const MusterEmpty = ({ title, children, action = null }) => (
  <div className={styles.empty}>
    <p className={styles["empty-title"]}>{title}</p>
    {children && <p className={styles["empty-body"]}>{children}</p>}
    {action}
  </div>
);

/** A small pill for a category or a level. */
export const MusterTag = ({ children, tone = null }) => (
  <span className={styles.tag} style={tone ? { backgroundColor: tone.bg, color: tone.fg } : undefined}>
    {children}
  </span>
);

/** A horizontal proportion bar, used for points and attendance. */
export const MusterBar = ({ value, max, colour, width = "100%" }) => {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.max(0, Math.min(100, Math.round((value / safeMax) * 100)));
  return (
    <span className={styles.bar} style={{ width }}>
      <span
        className={styles["bar-fill"]}
        style={{ width: `${pct}%`, backgroundColor: colour || "var(--color-accent)" }}
      />
    </span>
  );
};
