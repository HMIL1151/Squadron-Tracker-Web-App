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

  it("guards the fake behind a NODE_ENV check webpack can fold away", () => {
    // Load-bearing: written as a ternary instead, the require is not
    // eliminated and the fake plus both dummy squadrons ship to users. That
    // happened once and was caught by grepping the built bundle.
    expect(dbSource).toMatch(/process\.env\.NODE_ENV !== ["']production["']/);

    const guardIndex = dbSource.indexOf("process.env.NODE_ENV");
    const fakeIndex = dbSource.indexOf('require("../test/fakeFirestore")');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(fakeIndex).toBeGreaterThan(guardIndex);
  });

  it("imports the fake and the dummy data only via require, never a static import", () => {
    // A top-level `import` is unconditional and would always be bundled.
    expect(dbSource).not.toMatch(/^import .*fakeFirestore/m);
    expect(dbSource).not.toMatch(/^import .*dummyData/m);
  });

  it("has no other source file importing the fake or the dummy data", () => {
    // setupTests.js is allowed: Jest loads it, webpack never does, so it
    // cannot pull the fixtures into a bundle.
    const ALLOWED = ["firebase/db.js", "setupTests.js"];

    const offenders = sourceFiles()
      .filter((file) => !ALLOWED.includes(relative(file)))
      .filter((file) => /(fakeFirestore|dummyData)/.test(fs.readFileSync(file, "utf8")))
      .map(relative);

    expect(offenders).toEqual([]);
  });
});

describe("offline mode", () => {
  it("is off unless the flag is set", () => {
    // eslint-disable-next-line global-require
    const { isOfflineMode } = require("./db");
    expect(isOfflineMode).toBe(false);
  });
});
