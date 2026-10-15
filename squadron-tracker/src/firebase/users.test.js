/**
 * hasMembership's failure handling.
 *
 * The fake Firestore does not enforce rules, so it can never throw the
 * permission-denied a locked-out user actually gets. getDoc is replaced here
 * to produce one -- and a plain network failure, which must NOT count as "no
 * access", or a bad connection would turn into a lock-out message.
 */

import { vi } from "vitest";

const getDoc = vi.fn();
vi.mock("./db", async (importOriginal) => ({ ...(await importOriginal()), getDoc: (...args) => getDoc(...args) }));

const { hasMembership } = await import("./users");

const firebaseError = (code) => Object.assign(new Error(code), { code });

afterEach(() => getDoc.mockReset());

describe("hasMembership", () => {
  it("is true when the uid-keyed document exists", async () => {
    getDoc.mockResolvedValue({ exists: () => true });
    expect(await hasMembership(9999, "uid-x")).toBe(true);
  });

  it("is false when the document is missing", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    expect(await hasMembership(9999, "uid-x")).toBe(false);
  });

  it("is false when the rules refuse the read, which is what a locked-out user gets", async () => {
    getDoc.mockRejectedValue(firebaseError("permission-denied"));
    expect(await hasMembership(9999, "uid-x")).toBe(false);
  });

  it("is unknown, not false, on any other failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getDoc.mockRejectedValue(firebaseError("unavailable"));
    expect(await hasMembership(9999, "uid-x")).toBeNull();
  });
});
