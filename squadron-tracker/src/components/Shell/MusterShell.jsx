import { Suspense } from "react";
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
 * The rail does not collapse. The classic one does, because it had to -- the
 * content area was narrow and the menu was competing with it. At 252px against
 * a table that now uses the full remaining width, hiding it buys little and
 * costs the persistent sense of place that is most of the reason for a rail.
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

  return (
    <div className={styles.shell}>
      <nav className={styles.rail} aria-label="Squadron Tracker">
        <div className={styles.identity}>
          <div className={styles["identity-number"]}>{user.squadronNumber}</div>
          <div className={styles["identity-name"]}>
            {user.squadronName} Squadron
            <br />
            Air Training Corps
          </div>
        </div>

        <div className={styles.groups}>
          {DASHBOARD_GROUPS.map((group) => {
            const items = dashboards.filter((dashboard) => dashboard.group === group.key);
            if (items.length === 0) return null;
            return (
              <div key={group.key} className={styles.group}>
                <h2 className={styles["group-title"]}>{group.title}</h2>
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
                        >
                          <NavIcon name={dashboard.key} />
                          {titleFor(dashboard, "muster")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className={styles.account}>
          <div className={styles.avatar} aria-hidden="true">{initialsOf(user.displayName)}</div>
          <div className={styles["account-detail"]}>
            <div className={styles["account-name"]}>{user.displayName}</div>
            <div className={styles["account-role"]}>
              {isAdmin ? "Squadron admin" : "Squadron staff"} &middot; {version}
            </div>
          </div>
        </div>
        <div className={styles["account-actions"]}>
          <UiToggle />
          <button type="button" className={styles["sign-out"]} onClick={onLogout}>
            Sign out
          </button>
        </div>
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
