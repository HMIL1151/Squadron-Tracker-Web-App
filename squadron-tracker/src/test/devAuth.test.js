/**
 * The offline-mode auth stub.
 *
 * These tests exist because the personas are coupled to dummyData in two ways
 * that are invisible at the call site and fail silently rather than loudly:
 *
 *   1. uid -> MassUserList decides which squadron you land in.
 *   2. displayName -> AuthorisedUsers decides whether you are an admin, because
 *      WelcomePage looks that document up by displayName rather than by uid.
 *
 * Rename a fixture user and nothing throws: you simply arrive as a non-admin in
 * an app that looks fine, and the Flights screen you were trying to reach is
 * missing from the menu. So the coupling is asserted directly.
 */

import { dummyData, UIDS } from "./dummyData";
import {
  DEFAULT_PERSONA,
  PERSONAS,
  personaUser,
  resolvePersonaKey,
} from "./devAuth";

const docsIn = (prefix) =>
  Object.entries(dummyData)
    .filter(([path]) => path.startsWith(prefix))
    .map(([path, data]) => ({ id: path.split("/").pop(), ...data }));

const squadronOf = (uid) =>
  docsIn("MassUserList/").find((row) => row.UID === uid) ?? null;

describe("persona selection", () => {
  it("defaults to the Faketon admin when no ?as= is given", () => {
    expect(resolvePersonaKey("")).toBe(DEFAULT_PERSONA);
    expect(PERSONAS[DEFAULT_PERSONA].uid).toBe(UIDS.faketonAdmin);
  });

  it.each(Object.keys(PERSONAS))("resolves ?as=%s", (key) => {
    expect(resolvePersonaKey(`?as=${key}`)).toBe(key);
  });

  it("falls back to the default rather than throwing on an unknown persona", () => {
    // A typo in the URL should still give a usable app, with a console warning.
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolvePersonaKey("?as=nonsense")).toBe(DEFAULT_PERSONA);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("ignores other query parameters", () => {
    expect(resolvePersonaKey("?foo=bar&as=legacy&baz=1")).toBe("legacy");
  });
});

describe("every persona is backed by the fixture", () => {
  it.each(Object.entries(PERSONAS))(
    "%s exists in MassUserList or is deliberately unauthorised",
    (key, persona) => {
      const row = squadronOf(persona.uid);

      if (key === "new") {
        // The point of this one is to be absent -- it drives the first-login flow.
        expect(row).toBeNull();
        return;
      }

      expect(row).not.toBeNull();
    }
  );

  it.each([
    ["admin", 9999],
    ["user", 9999],
    ["legacy", 9998],
  ])("%s lands in squadron %i", (key, expected) => {
    expect(squadronOf(PERSONAS[key].uid).Squadron).toBe(expected);
  });

  it("sysadmin is flagged as a system admin", () => {
    expect(squadronOf(PERSONAS.sysadmin.uid).systemAdmin).toBe(true);
  });
});

describe("displayName matches AuthorisedUsers", () => {
  // The silent-failure guard. WelcomePage.navigateToMainContent queries
  // AuthorisedUsers `where("displayName", "==", displayName)`, so a mismatch
  // here demotes the persona to non-admin with no error anywhere.
  it.each([
    ["admin", 9999, "admin"],
    ["user", 9999, "user"],
    ["legacy", 9998, "admin"],
  ])("%s resolves in squadron %i to role %s", (key, squadron, expectedRole) => {
    const authorised = docsIn(`SquadronDatabases/${squadron}/AuthorisedUsers/`);
    const match = authorised.filter(
      (u) => u.displayName === PERSONAS[key].displayName
    );

    // Exactly one, because the lookup takes docs[0] -- two matching documents
    // would make the resolved role depend on document order.
    expect(match).toHaveLength(1);
    expect(match[0].role).toBe(expectedRole);
    expect(match[0].id).toBe(PERSONAS[key].uid);
  });
});

describe("the user handed to the app", () => {
  it("carries the three fields the login path reads", () => {
    const user = personaUser("admin");
    expect(user).toMatchObject({
      uid: UIDS.faketonAdmin,
      displayName: "Admin User",
      email: "admin@faketon.test",
    });
  });
});
