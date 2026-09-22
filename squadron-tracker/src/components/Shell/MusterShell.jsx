import { Suspense, useState } from "react";
import { DASHBOARD_GROUPS, dashboardsFor, titleFor } from "../Dashboards/DashboardComponents/dashboardList";
import UiToggle from "../UiToggle/UiToggle";
import NavIcon from "./NavIcon";
import styles from "./MusterShell.module.css";

/**
 * The Muster frame: a navigation rail down the left, content filling the rest.
 *
 * Three things differ from the classic shell, and all three are the point
 * rather than decoration.
 *
 * The dark top bar is gone. It carried the squadron name, the signed-in user
 * and two buttons across the full width of a screen whose real content is
 * tables that want that width. The squadron identity moved to the top of the
 * rail, where it doubles as the "which squadron am I in" answer that staff who
 * help at more than one squadron actually need; the user and their controls
 * moved to the foot of the rail.
 *
 * The menu is grouped. Ten flat items get learned by position rather than
 * read; three short groups get read. See DASHBOARD_GROUPS.
 *
 * The rail collapses to icons, not to nothing. This file used to argue it
 * should not collapse at all, on the grounds that 252px against a
 * full-width table buys little. That was wrong about the widest screens here:
 * the PTS board in its Every Level view is 3,500px of columns, and on a
 * laptop those 252px are four more badge columns. What the argument got right
 * is that a rail you cannot see is a rail you have to remember, so collapsing
 * leaves a 64px strip of icons rather than an empty edge -- every screen is
 * still one click away, and the squadron number stays on it.
 *
 * The choice is remembered in localStorage, wrapped in try/catch: it is a
 * per-viewer convenience, not data, and a private window that throws on read
 * should open the rail rather than break the shell.
 */

/*
 * Explicit map rather than building `styles["nav-link-" + state]`. Scoped
 * class names do not survive string concatenation, and a missed lookup renders
 * class="undefined" instead of failing -- which is what the afterEach guard in
 * setupTests.js exists to catch.
 */
const NAV_STATE = {
  active: styles["nav-link-active"],
  inactive: styles["nav-link"],
};

const RAIL_STATE = {
  open: styles.rail,
  shut: styles["rail-shut"],
};

const SHELL_STATE = {
  open: styles.shell,
  shut: styles["shell-shut"],
};

const STORAGE_KEY = "muster.rail.collapsed";

/** localStorage, or nothing at all. Never a thrown error out of a render. */
const storedCollapsed = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const rememberCollapsed = (value) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* Private window, blocked storage: the rail still works for this session. */
  }
};

/** Initials for the avatar, from whatever the display name turns out to be. */
const initialsOf = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

const MusterShell = ({
  user,
  isAdmin,
  version,
  activeMenu,
  setActiveMenu,
  onLogout,
  children,
}) => {
  const dashboards = dashboardsFor({ uiVersion: "muster", isAdmin, user });
  const [collapsed, setCollapsed] = useState(storedCollapsed);

  const toggleRail = () => {
    setCollapsed((current) => {
      rememberCollapsed(!current);
      return !current;
    });
  };

  return (
    <div className={collapsed ? SHELL_STATE.shut : SHELL_STATE.open}>
      <nav
        className={collapsed ? RAIL_STATE.shut : RAIL_STATE.open}
        aria-label="Squadron Tracker"
      >
        <div className={styles.identity}>
          <div className={styles["identity-number"]}>{user.squadronNumber}</div>
          {/*
            * Hidden by CSS when the rail is shut rather than dropped from the
            * DOM. Below 800px the rail is a bar across the top and collapsing
            * means nothing, so the narrow layout puts this back -- which it
            * cannot do for something JavaScript declined to render.
            */}
          <div className={styles["identity-name"]}>
            {user.squadronName} Squadron
            <br />
            Air Training Corps
          </div>
        </div>

        <button
          type="button"
          className={styles["rail-toggle"]}
          onClick={toggleRail}
          aria-expanded={!collapsed}
          /*
           * An explicit name, because the visible label is "Collapse" when
           * open and nothing at all when shut. The button's name should not
           * change meaning with the width of the thing it controls.
           */
          aria-label={collapsed ? "Expand the menu" : "Collapse the menu"}
          title={collapsed ? "Expand the menu" : "Collapse the menu"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {collapsed ? <path d="M4.5 2.5 8 6l-3.5 3.5" /> : <path d="M7.5 2.5 4 6l3.5 3.5" />}
          </svg>
          <span className={collapsed ? styles["visually-hidden"] : undefined}>
            {collapsed ? "Expand the menu" : "Collapse"}
          </span>
        </button>

        <div className={styles.groups}>
          {DASHBOARD_GROUPS.map((group) => {
            const items = dashboards.filter((dashboard) => dashboard.group === group.key);
            if (items.length === 0) return null;
            return (
              <div key={group.key} className={styles.group}>
                <h2
                  className={collapsed ? styles["visually-hidden"] : styles["group-title"]}
                >
                  {group.title}
                </h2>
                <ul className={styles["nav-list"]}>
                  {items.map((dashboard) => {
                    const isActive = dashboard.key === activeMenu;
                    return (
                      <li key={dashboard.key}>
                        <button
                          type="button"
                          className={isActive ? NAV_STATE.active : NAV_STATE.inactive}
                          onClick={() => setActiveMenu(dashboard.key)}
                          aria-current={isActive ? "page" : undefined}
                          /*
                           * The title is the tooltip when only the icon shows.
                           * The label itself stays in the DOM either way --
                           * hidden, not removed -- so the accessible name of
                           * the button never depends on the rail's width.
                           */
                          title={collapsed ? titleFor(dashboard, "muster") : undefined}
                        >
                          <NavIcon name={dashboard.key} />
                          <span className={collapsed ? styles["visually-hidden"] : undefined}>
                            {titleFor(dashboard, "muster")}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className={styles.account} title={collapsed ? user.displayName : undefined}>
          <div className={styles.avatar} aria-hidden="true">{initialsOf(user.displayName)}</div>
          <div className={styles["account-detail"]}>
            <div className={styles["account-name"]}>{user.displayName}</div>
            <div className={styles["account-role"]}>
              {isAdmin ? "Squadron admin" : "Squadron staff"} &middot; {version}
            </div>
          </div>
        </div>
        {!collapsed && (
          <div className={styles["account-actions"]}>
            <UiToggle />
            <button type="button" className={styles["sign-out"]} onClick={onLogout}>
              Sign Out
            </button>
          </div>
        )}
        {collapsed && (
          <div className={styles["account-actions-shut"]}>
            <button
              type="button"
              className={styles["sign-out-shut"]}
              onClick={onLogout}
              title="Sign Out"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2H6" />
                <path d="M10.5 11 14 8l-3.5-3" />
                <path d="M14 8H6" />
              </svg>
              <span className={styles["visually-hidden"]}>Sign Out</span>
            </button>
          </div>
        )}
      </nav>

      <main className={styles.main}>
        {/* Dashboards are lazy-loaded (see dashboardList.js), so a boundary is
            required while the chunk downloads. */}
        <Suspense fallback={<p className={styles.loading}>Loading&hellip;</p>}>{children}</Suspense>
      </main>
    </div>
  );
};

export default MusterShell;
