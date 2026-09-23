import styles from "./MusterChangelog.module.css";

/**
 * Release notes on the sign-in screen.
 *
 * The classic page renders these as a grey card holding a white card, with a
 * fixed height and its own scrollbar, taking the middle of the screen. That
 * ordering says the release notes are the main event on a page whose job is a
 * sign-in button, and the inner scrollbar means the entry you are reading
 * stops mid-sentence.
 *
 * Here the newest release is simply open -- squadron staff who sign in on a
 * parade night want to know what changed since last week, and that is one
 * short read -- and everything older sits behind a disclosure. No box, no
 * nested card, no scrollbar inside a scrollbar: hairline rules and space, the
 * same way the tables in the app are built.
 *
 * `content` is newline-separated paragraphs in changelog.json. The classic
 * page pushes it through dangerouslySetInnerHTML to turn those into <br><br>;
 * splitting into real paragraphs says the same thing without handing the file
 * the ability to inject markup into the sign-in page.
 */

const paragraphsOf = (content) =>
  String(content || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const Release = ({ entry }) => (
  <article className={styles.release}>
    <h3 className={styles["release-head"]}>
      <span className={styles.version}>{entry.version}</span>
      <span className={styles.date}>{entry.date}</span>
    </h3>
    {paragraphsOf(entry.content).map((line) => (
      <p key={line.slice(0, 40)} className={styles.note}>
        {line}
      </p>
    ))}
  </article>
);

const MusterChangelog = ({ entries = [] }) => {
  if (entries.length === 0) {
    return (
      <section className={styles.changelog} aria-label="What's new">
        <h2 className={styles.title}>What&rsquo;s new</h2>
        <p className={styles.empty}>Release notes are loading.</p>
      </section>
    );
  }

  const [latest, ...earlier] = entries;

  return (
    <section className={styles.changelog} aria-label="What's new">
      <h2 className={styles.title}>What&rsquo;s new</h2>
      <Release entry={latest} />

      {earlier.length > 0 && (
        <details className={styles.earlier}>
          <summary className={styles.summary}>
            Earlier releases
            <span className={styles.count}>{earlier.length}</span>
          </summary>
          <div className={styles["earlier-list"]}>
            {earlier.map((entry) => (
              <Release key={entry.version} entry={entry} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
};

export default MusterChangelog;
