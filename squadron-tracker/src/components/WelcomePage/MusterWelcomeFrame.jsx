import styles from "./MusterWelcomeFrame.module.css";

/**
 * The sign-in screen's Muster layout.
 *
 * A frame, not a fork. Every flow on the welcome page -- first login, entering
 * a squadron number, the "squadron not found" setup popup, requesting access
 * -- stays exactly where it was in WelcomePage; this only changes where those
 * things sit on the screen and what surrounds them.
 *
 * Which matters, because the sign-in page is the one screen with branching
 * state that has nothing to do with dashboards, and forking it would mean
 * maintaining two copies of a flow most people see once and staff see never.
 *
 * The classic page is a centred column: a title, a button, and a changelog box
 * with its own scrollbar taking up most of the screen. That ordering says the
 * release notes are the main event. Here the left is what the app is for, the
 * right is signing in, and the changelog sits under the sign-in button where
 * someone can read it if they want to.
 *
 * Note the interface cannot be resolved from the account yet -- SystemConfig
 * needs a signed-in user to read -- so a first-ever visit on a new device gets
 * the classic page whatever the system default says. See UiVersionContext.
 */
const MusterWelcomeFrame = ({ error, children, changelog }) => (
  <div className={styles.page}>
    <section className={styles.identity}>
      <div className={styles.brand}>
        {/*
         * Concentric rings rather than a roundel proper. Close enough to read
         * as air cadets at 40px, deliberately not close enough to pass as RAF
         * insignia -- this is not an official system and should not dress
         * itself as one.
         */}
        <svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r="22" fill="none" stroke="var(--muster-service-pale)" strokeWidth="1.5" />
          <circle cx="24" cy="24" r="16" fill="var(--flight-1)" />
          <circle cx="24" cy="24" r="10" fill="var(--color-identity-text)" />
          <circle cx="24" cy="24" r="4.5" fill="var(--flight-2)" />
        </svg>
        <span className={styles["brand-name"]}>Squadron Tracker</span>
      </div>

      <div className={styles.pitch}>
        <h1 className={styles.headline}>One record of every cadet.</h1>
        <p className={styles.lead}>
          Classifications, badges, attendance and flight points for your squadron, in one place,
          kept by the staff who were there on the night.
        </p>

        <dl className={styles.covers}>
          <div className={styles.cover}>
            <dt>Classifications</dt>
            <dd>Junior through to Master, worked out from the exams passed</dd>
          </div>
          <div className={styles.cover}>
            <dt>PTS badges</dt>
            <dd>Blue, bronze, silver and gold across every syllabus area</dd>
          </div>
          <div className={styles.cover}>
            <dt>The rest of it</dt>
            <dd>Attendance, flight points, certificates and a squadron backup</dd>
          </div>
        </dl>
      </div>

      <p className={styles.disclaimer}>Not an official RAF Air Cadets system.</p>
    </section>

    <section className={styles.panel}>
      <div className={styles.inner}>
        <h2 className={styles.title}>Sign In</h2>
        <p className={styles.blurb}>
          Use the Google account your squadron staff list holds. If your squadron is not set up
          yet, you can create it after signing in.
        </p>

        {error}

        <div className={styles.auth}>{children}</div>

        <p className={styles.privacy}>
          Cadet data stays inside your squadron. Staff at other squadrons cannot see it.
        </p>

        <div className={styles.changelog}>{changelog}</div>
      </div>
    </section>
  </div>
);

export default MusterWelcomeFrame;
