/**
 * Tests for the test harness.
 *
 * Everything downstream assumes the clock is frozen, Firestore is faked, and the
 * providers seed correctly. If any of that quietly stops working, the suite
 * would keep passing while testing the wrong thing -- so it gets asserted
 * directly rather than taken on trust.
 */

import React from "react";
import { screen } from "@testing-library/react";

import * as fullSdk from "firebase/firestore";
import * as liteSdk from "firebase/firestore/lite";
import * as auth from "firebase/auth";

import CadetsDashboard from "../components/Dashboards/Cadets Dashboard/CadetsDashboard";
import { renderWithProviders } from "./renderWithProviders";
import { SQUADRONS, dataContextFor } from "./dummyData";

describe("frozen clock", () => {
  it("pins new Date() to the frozen instant", () => {
    expect(new Date().toISOString()).toBe("2025-06-15T12:00:00.000Z");
  });

  it("pins Date.now()", () => {
    expect(Date.now()).toBe(Date.parse("2025-06-15T12:00:00.000Z"));
  });

  it("does not change over the course of a test", async () => {
    const first = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(Date.now()).toBe(first);
  });

  it("leaves explicit dates alone", () => {
    expect(new Date("2024-03-01T00:00:00Z").toISOString()).toBe("2024-03-01T00:00:00.000Z");
    expect(new Date(0).toISOString()).toBe("1970-01-01T00:00:00.000Z");
  });

  it("keeps Date arithmetic and parsing working", () => {
    expect(new Date("2025-06-15") - new Date("2025-06-14")).toBe(86400000);
    expect(new Date().getFullYear()).toBe(2025);
  });

  it("leaves real timers running, so waitFor and user-event still work", async () => {
    // jest.useFakeTimers() would have replaced setTimeout too, which breaks
    // Testing Library's async helpers on Jest 27 (no doNotFake option).
    const ran = await new Promise((resolve) => setTimeout(() => resolve(true), 1));
    expect(ran).toBe(true);
  });
});

describe("module substitution", () => {
  it("routes the full Firestore SDK to the fake", () => {
    expect(typeof fullSdk.__seed).toBe("function");
  });

  it("routes the lite Firestore SDK to the fake", () => {
    // Nine source files import the lite SDK and seven the full one. Missing
    // either would let real Firestore through for those files.
    expect(typeof liteSdk.__seed).toBe("function");
  });

  it("gives both SDK entry points the same store", async () => {
    await fullSdk.setDoc(fullSdk.doc(fullSdk.getFirestore(), "A", "one"), { n: 1 });
    const snap = await liteSdk.getDoc(liteSdk.doc(liteSdk.getFirestore(), "A", "one"));
    expect(snap.data()).toEqual({ n: 1 });
  });

  it("routes Firebase Auth to the stub", () => {
    expect(typeof auth.__setNextUser).toBe("function");
  });

  it("imports src/firebase/firebase.js without throwing", () => {
    // getAuth() there throws auth/invalid-api-key when the key is missing, and
    // the module runs on any import. .env.test supplies a well-formed fake key.
    // eslint-disable-next-line global-require
    expect(() => require("../firebase/firebase")).not.toThrow();
  });
});

describe("jest-dom", () => {
  it("has its matchers loaded", () => {
    // The old src/misc/setupTests.js was never loaded by CRA, so these were
    // silently unavailable.
    document.body.innerHTML = '<button id="b">Go</button>';
    expect(document.getElementById("b")).toBeInTheDocument();
    expect(document.getElementById("b")).toHaveTextContent("Go");
  });
});

describe("state resets between tests", () => {
  // These two run in order and would fail if the reset in setupTests stopped
  // working, catching leakage that otherwise shows up as order-dependent flakes.
  it("writes a document in the first test", async () => {
    await fullSdk.setDoc(fullSdk.doc(fullSdk.getFirestore(), "Leak", "one"), { n: 1 });
    expect(fullSdk.__store()["Leak/one"]).toEqual({ n: 1 });
  });

  it("does not see it in the second", () => {
    expect(fullSdk.__store()["Leak/one"]).toBeUndefined();
  });
});

describe("renderWithProviders", () => {
  it("renders a real dashboard against the dummy squadron", () => {
    renderWithProviders(<CadetsDashboard />, { squadron: SQUADRONS.FAKETON });

    // Names come from the seeded DataContext, not from Firestore.
    expect(screen.getByText("Amelia")).toBeInTheDocument();
    expect(screen.getByText("Blythe-Jones")).toBeInTheDocument();
  });

  it("seeds the fake Firestore with the dummy data", () => {
    const { store } = renderWithProviders(<CadetsDashboard />);
    expect(store()["SquadronDatabases/9999/FlightPoints/Badge Points"]).toMatchObject({
      "Gold Badge": 20,
    });
  });

  it("resolves flight names for the squadron under test", () => {
    // Mirrors App.js handleUserChange. Without it the hardcoded defaults in
    // mappings.js would render instead of Faketon's real flight names.
    renderWithProviders(<CadetsDashboard />, { squadron: SQUADRONS.FAKETON });
    expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
  });

  it("switches cleanly to the other squadron", () => {
    renderWithProviders(<CadetsDashboard />, { squadron: SQUADRONS.TESTWOOD });
    expect(screen.getAllByText("Lawson").length).toBeGreaterThan(0);
    expect(screen.queryByText("Blythe-Jones")).toBeNull();
    // Testwood's legacy string[] flights must resolve too.
    expect(screen.getAllByText("Atlas").length).toBeGreaterThan(0);
  });

  it("accepts an explicit data override", () => {
    const only = dataContextFor(SQUADRONS.FAKETON);
    renderWithProviders(<CadetsDashboard />, {
      data: { ...only, cadets: only.cadets.slice(0, 1) },
    });
    expect(screen.getByText("Total Cadets: 1")).toBeInTheDocument();
  });

  it("exposes a userEvent session", () => {
    const { user } = renderWithProviders(<CadetsDashboard />);
    expect(typeof user.click).toBe("function");
  });
});
