/**
 * Runs the security-rules tests against a Firestore emulator that this script
 * starts and stops itself.
 *
 * Why not `firebase emulators:exec`: JDK 16+ on Windows builds its NIO wakeup
 * pipes over AF_UNIX sockets, and this environment refuses those connections
 * ("Invalid argument: connect" -- endpoint security, most likely), so Netty
 * inside the emulator dies with "failed to create a child event loop" under
 * the system JDK 24 -- and under JDK 21, which was tried and failed the same
 * way. JDK 11 predates the AF_UNIX pipe entirely (TCP loopback) and is the
 * emulator's minimum supported version, so a portable Temurin 11 lives in
 * tools/ (git-ignored) and is preferred here. The CLI wrapper also swallowed
 * the emulator's stderr; running the jar ourselves keeps failures visible.
 *
 * If tools/ is missing (fresh clone), the system `java` is used -- correct on
 * Linux/CI and on machines where AF_UNIX works. Re-create tools/ with:
 *
 *   curl -L -o t.zip "https://api.adoptium.net/v3/binary/latest/11/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk"
 *   unzip t.zip -d tools && rm t.zip
 *
 * The rules themselves are loaded by initializeTestEnvironment() in the test
 * file via the emulator's REST API, so the jar needs no --rules flag.
 */
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = 8080; // matches firebase.json so either launch style works

/** Prefer the bundled AF_UNIX-free JDK; fall back to whatever `java` is. */
const findJava = () => {
  const tools = path.join(__dirname, "..", "tools");
  if (fs.existsSync(tools)) {
    const jdk = fs.readdirSync(tools).find((d) => d.startsWith("jdk-"));
    if (jdk) {
      const exe = path.join(tools, jdk, "bin", process.platform === "win32" ? "java.exe" : "java");
      if (fs.existsSync(exe)) return exe;
    }
  }
  return "java";
};

const findJar = () => {
  const dir = path.join(os.homedir(), ".cache", "firebase", "emulators");
  const jars = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.startsWith("cloud-firestore-emulator") && f.endsWith(".jar"))
    : [];
  if (!jars.length) {
    console.error(
      "No Firestore emulator jar found. Run once:\n  npx firebase setup:emulators:firestore"
    );
    process.exit(1);
  }
  return path.join(dir, jars.sort().pop());
};

const waitForReady = async (timeoutMs = 60000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://${HOST}:${PORT}/`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Firestore emulator did not become ready on ${HOST}:${PORT}`);
};

/**
 * The rules test files, each run against its own freshly-started emulator.
 *
 * They are NOT run together. The emulator degrades measurably within a single
 * process: the 36-test file passes in about 6 seconds, but the 7-test file
 * that runs after it then takes two minutes and times out -- while passing in
 * about 2 seconds on its own. Restarting between files costs a few seconds
 * and removes the problem entirely.
 */
const RULES_SUITES = ["firestoreRules.test.js", "firestoreRulesSquadronList.test.js"];

/** Runs one test file against a fresh emulator. Returns its exit status. */
const runSuite = async (java, testFile) => {
  const javaArgs = ["-Duser.language=en", "-jar", findJar(), "--host", HOST, "--port", String(PORT)];

  console.log(`\n--- ${testFile} ---`);
  console.log(`Starting Firestore emulator on ${HOST}:${PORT} ...`);
  const emulator = spawn(java, javaArgs, { stdio: ["ignore", "pipe", "pipe"] });
  emulator.stdout.on("data", () => {}); // drain
  emulator.stderr.on("data", (d) => process.stderr.write(d));

  let emulatorExited = false;
  emulator.on("exit", () => {
    emulatorExited = true;
  });

  try {
    await waitForReady();
    console.log("Emulator ready.");

    const result = spawnSync(
      "npx",
      [
        "--no-install",
        "vitest",
        "run",
        "--no-file-parallelism",
        // vite.config.js excludes these from the default run because they need
        // an emulator, so each is named explicitly here.
        `src/test/${testFile}`,
      ],
      {
        stdio: "inherit",
        shell: true,
        env: { ...process.env, FIRESTORE_EMULATOR_HOST: `${HOST}:${PORT}`, CI: "true" },
      }
    );
    return result.status === null ? 1 : result.status;
  } finally {
    if (!emulatorExited) emulator.kill();
    // Give the port time to free before the next emulator claims it.
    await new Promise((r) => setTimeout(r, 1500));
  }
};

const main = async () => {
  const java = findJava();
  console.log(`java: ${java}`);

  let failed = 0;
  for (const suite of RULES_SUITES) {
    // eslint-disable-next-line no-await-in-loop
    const status = await runSuite(java, suite);
    if (status !== 0) failed += 1;
  }

  if (failed) {
    console.error(`\n${failed} of ${RULES_SUITES.length} rules suites failed.`);
  } else {
    console.log(`\nAll ${RULES_SUITES.length} rules suites passed.`);
  }
  process.exitCode = failed ? 1 : 0;
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
