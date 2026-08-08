/**
 * The data layer's boundaries.
 *
 * Two properties worth enforcing rather than trusting:
 *   - no module outside src/firebase/ imports the Firestore SDK directly
 *   - the in-memory fake and the dummy squadrons cannot reach a user
 */

import fs from "fs";
import path from "path";

const SRC = path.resolve(__dirname, "..");

/** Every .js file under src/, excluding tests and the test helpers. */
const sourceFiles = (dir = SRC, found = []) => {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "test" || entry.name === "__snapshots__") return;
      sourceFiles(full, found);
      return;
    }
    if (!entry.name.endsWith(".js")) return;
    if (entry.name.endsWith(".test.js")) return;
    found.push(full);
  });
  return found;
};

const relative = (file) => path.relative(SRC, file).replace(/\\/g, "/");

describe("only the data layer talks to the SDK", () => {
  it("has exactly one module importing firebase/firestore", () => {
    // db.js exists so the SDK choice and the offline switch live in one place.
    // Sixteen files used to import it directly, across two different SDKs.
    const importers = sourceFiles()
      .filter((file) => /from ["']firebase\/firestore/.test(fs.readFileSync(file, "utf8")))
      .map(relative);

    expect(importers).toEqual(["firebase/db.js"]);
  });

  it("uses only the lite SDK", () => {
    // The full SDK is only needed for realtime listeners, and there are none.
    // Importing both shipped both.
    const full = sourceFiles()
      .filter((file) => /from ["']firebase\/firestore["']/.test(fs.readFileSync(file, "utf8")))
      .map(relative);

    expect(full).toEqual([]);
  });

  it("has no component calling getFirestore", () => {
    const callers = sourceFiles()
      .filter((file) => relative(file).startsWith("components/"))
      .filter((file) => /getFirestore\s*\(/.test(fs.readFileSync(file, "utf8")))
      .map(relative);

    expect(callers).toEqual([]);
  });
});

describe("test fixtures cannot reach production", () => {
  const dbSource = fs.readFileSync(path.join(SRC, "firebase", "db.js"), "utf8");
  const viteConfig = fs.readFileSync(path.resolve(SRC, "..", "vite.config.js"), "utf8");

  /** Import and require statements only -- comments may mention anything. */
  const moduleRefs = (source) => [
    ...source.matchAll(/(?:from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/g),
  ].map((m) => m[1]);

  it("never imports the fake in application code", () => {
    // The swap happens in resolution, not in code: vite.config.js aliases
    // firebase/firestore/lite to the fake when the flag is set. A production
    // build therefore has no reference to eliminate.
    //
    // This replaced a runtime `useFake ? require(...) : liteSdk`, which webpack
    // did NOT eliminate -- the fake and both dummy squadrons shipped to users.
    expect(moduleRefs(dbSource).filter((r) => r.includes("fakeFirestore"))).toEqual([]);
    expect(dbSource).toMatch(/from ["']firebase\/firestore\/lite["']/);
  });

  it("does the offline swap by alias in the build config", () => {
    expect(viteConfig).toMatch(/REACT_APP_USE_FAKE_DB/);
    expect(viteConfig).toMatch(/fakeFirestore/);
    expect(viteConfig).toMatch(/alias/);
  });

  it("guards the dummy-data seed behind a PROD check Vite can fold away", () => {
    // Only the seeding remains in db.js, and it must stay inside a branch the
    // bundler can prove dead.
    expect(dbSource).toMatch(/!import\.meta\.env\.PROD/);

    const guardIndex = dbSource.indexOf("import.meta.env.PROD");
    const seedIndex = dbSource.indexOf('import("../test/dummyData")');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(seedIndex).toBeGreaterThan(guardIndex);
  });

  it("imports the dummy data only dynamically, never statically", () => {
    // A top-level import is unconditional and would always be bundled.
    expect(dbSource).not.toMatch(/^import .*dummyData/m);
  });

  it("has no other source file importing the fake or the dummy data", () => {
    // setupTests.js is allowed: only the test runner loads it, so it cannot
    // pull the fixtures into a bundle. db.js is allowed exactly one reference,
    // the guarded dynamic import of the dummy data, asserted above.
    const ALLOWED = ["setupTests.js", "firebase/db.js"];

    const offenders = sourceFiles()
      .filter((file) => !ALLOWED.includes(relative(file)))
      .filter((file) =>
        moduleRefs(fs.readFileSync(file, "utf8")).some(
          (ref) => ref.includes("fakeFirestore") || ref.includes("dummyData")
        )
      )
      .map(relative);

    expect(offenders).toEqual([]);
  });
});

describe("offline mode", () => {
  it("is off unless the flag is set", async () => {
    const { isOfflineMode } = await import("./db");
    expect(isOfflineMode).toBe(false);
  });
});
