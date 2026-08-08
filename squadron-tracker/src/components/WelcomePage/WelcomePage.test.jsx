/**
 * CHARACTERIZATION -- WelcomePage.
 *
 * The login and squadron-selection flow, previously 0% covered. Sign-in runs
 * end to end against the fakes: the auth stub scripts who signs in, and
 * checkUserRole/doesSquadronAccountExist read the seeded fake Firestore.
 *
 * The new-squadron setup form is pinned here in its current three-flight
 * hardcoded shape -- Phase 9 makes it dynamic, and these tests are what make
 * that change visible.
 */

import React from "react";
import { screen, waitFor } from "@testing-library/react";

import WelcomePage from "./WelcomePage";
import { renderWithProviders } from "../../test/renderWithProviders";
import { UIDS } from "../../test/dummyData";
import { __setNextUser } from "firebase/auth";

const CHANGELOG = [
  { version: "v0.9.1", date: "09/04/2025", content: "First entry" },
  { version: "v0.10.0", date: "01/05/2025", content: "Newest entry" },
  { version: "v0.9.2", date: "10/04/2025", content: "Second entry" },
];

const ADMIN = { uid: UIDS.faketonAdmin, email: "admin@faketon.test", displayName: "Admin User" };
const STRANGER = { uid: UIDS.stranger, email: "new@person.test", displayName: "New Person" };
const SYS_ADMIN = { uid: UIDS.systemAdmin, email: "sys@admin.test", displayName: "System Admin" };

beforeEach(() => {
  // WelcomePage fetches /changelog.json on mount; jsdom has no fetch.
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => CHANGELOG });
});

afterEach(() => {
  delete global.fetch;
});

const renderPage = () => {
  const onUserChange = jest.fn();
  return { onUserChange, ...renderWithProviders(<WelcomePage onUserChange={onUserChange} />) };
};

const signInAs = async (result, user) => {
  __setNextUser(user);
  await result.user.click(screen.getByRole("button", { name: "Sign in with Google" }));
};

const enterSquadronNumber = async (result, number) => {
  await result.user.type(screen.getByPlaceholderText("Enter Squadron Number"), String(number));
  await result.user.click(screen.getByRole("button", { name: "Submit" }));
};

describe("logged out", () => {
  it("offers Google sign-in and nothing else", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeInTheDocument();
    expect(screen.queryByText(/Please enter your Squadron number/)).toBeNull();
  });

  it("shows the changelog sorted newest version first", async () => {
    // Two implementations of this sort exist (here and App.js). This pins the
    // WelcomePage one: numeric-aware, so v0.10.0 outranks v0.9.2.
    renderPage();
    const headings = await screen.findAllByRole("heading", { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "v0.10.0 - 01/05/2025",
      "v0.9.2 - 10/04/2025",
      "v0.9.1 - 09/04/2025",
    ]);
  });
});

describe("signing in as an existing squadron user", () => {
  it("resolves the squadron and hands over to the app without further input", async () => {
    // checkUserRole finds Admin User's MassUserList row -> Squadron 9999, so
    // no squadron prompt is shown; WelcomePage goes straight to onUserChange.
    const result = renderPage();
    await signInAs(result, ADMIN);

    await waitFor(() => expect(result.onUserChange).toHaveBeenCalled());
    const [userArg, isAdmin] = result.onUserChange.mock.calls[0];
    expect(userArg).toMatchObject({
      displayName: "Admin User",
      uid: UIDS.faketonAdmin,
      squadronName: "Faketon",
      squadronNumber: 9999,
      role: "admin",
    });
    expect(isAdmin).toBe(true);
  });

  it("passes the SquadronList document id through to the app", async () => {
    // Without this the Flights screen cannot save: SquadronList documents have
    // auto-generated ids but are only findable by their Number field, so the
    // id has to travel with the login. A break here would be silent -- the
    // screen would render fine and refuse to save.
    const result = renderPage();
    await signInAs(result, ADMIN);

    await waitFor(() => expect(result.onUserChange).toHaveBeenCalled());
    const [userArg] = result.onUserChange.mock.calls[0];
    expect(userArg.squadronDocId).toBe("sqnlist-faketon");
  });

  it("passes the squadron's flight list through to the app", async () => {
    const result = renderPage();
    await signInAs(result, ADMIN);

    await waitFor(() => expect(result.onUserChange).toHaveBeenCalled());
    const [userArg] = result.onUserChange.mock.calls[0];
    // Faketon's flights are the new object shape; they arrive as stored.
    expect(userArg.flightNames.map((f) => f.name ?? f)).toEqual([
      "Staff Team",
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
  });

  it("hands a plain user over without admin rights", async () => {
    const result = renderPage();
    await signInAs(result, {
      uid: UIDS.faketonUser,
      email: "user@faketon.test",
      displayName: "Plain User",
    });

    await waitFor(() => expect(result.onUserChange).toHaveBeenCalled());
    const [userArg, isAdmin] = result.onUserChange.mock.calls[0];
    expect(userArg.role).toBe("user");
    expect(isAdmin).toBe(false);
  });
});

describe("signing in for the first time", () => {
  it("asks for a squadron number instead of handing over", async () => {
    const result = renderPage();
    await signInAs(result, STRANGER);

    expect(await screen.findByText("Please enter your Squadron number:")).toBeInTheDocument();
    expect(result.onUserChange).not.toHaveBeenCalled();
  });

  it("files an access request against an existing squadron", async () => {
    const result = renderPage();
    await signInAs(result, STRANGER);
    await screen.findByText("Please enter your Squadron number:");
    await enterSquadronNumber(result, 9999);

    await screen.findByText(/pending approval/);

    const request = result
      .writes()
      .find((w) => w.path.startsWith("SquadronDatabases/9999/UserRequests/"));
    expect(request.data).toMatchObject({
      displayName: "New Person",
      email: "new@person.test",
      uid: UIDS.stranger,
      progress: "pending",
    });
  });

  it("offers to create the squadron when the number is unknown", async () => {
    const result = renderPage();
    await signInAs(result, STRANGER);
    await screen.findByText("Please enter your Squadron number:");
    await enterSquadronNumber(result, 7777);

    expect(
      await screen.findByText(/Squadron does not exist. Would you like to set up/)
    ).toBeInTheDocument();
  });
});

describe("new squadron setup form", () => {
  const openSetupForm = async (result, number = 7777) => {
    await signInAs(result, STRANGER);
    await screen.findByText("Please enter your Squadron number:");
    await enterSquadronNumber(result, number);
    await screen.findByText(/Squadron does not exist/);
    await result.user.click(screen.getByRole("button", { name: "Set Up" }));
    await screen.findByText("New Squadron Setup");
  };

  it("starts with a staff flight and one competing flight", async () => {
    // Phase 9: was fixed at exactly three, so a four-flight squadron could not
    // be created at all. Now it starts minimal and grows.
    const result = renderPage();
    await openSetupForm(result);

    expect(screen.getByPlaceholderText("Staff Team/Training Flight")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Flight 1 Name")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Flight 2 Name")).toBeNull();
  });

  it("adds as many flights as the squadron needs", async () => {
    const result = renderPage();
    await openSetupForm(result);

    await result.user.click(screen.getByRole("button", { name: "+ Add another flight" }));
    expect(screen.getByPlaceholderText("Flight 2 Name")).toBeInTheDocument();

    await result.user.click(screen.getByRole("button", { name: "+ Add another flight" }));
    expect(screen.getByPlaceholderText("Flight 3 Name")).toBeInTheDocument();
  });

  it("removes an added flight again", async () => {
    const result = renderPage();
    await openSetupForm(result);
    await result.user.click(screen.getByRole("button", { name: "+ Add another flight" }));
    await result.user.click(screen.getByRole("button", { name: "Remove flight 2" }));

    expect(screen.queryByPlaceholderText("Flight 2 Name")).toBeNull();
  });

  it("does not allow removing the staff flight or the first competing flight", async () => {
    // A squadron needs at least one of each; those two rows have no remove
    // button.
    const result = renderPage();
    await openSetupForm(result);

    expect(screen.queryByRole("button", { name: "Remove flight 0" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove flight 1" })).toBeNull();
  });

  it("locks the squadron number to what was entered", async () => {
    // The original entry input is still mounted behind the popup with the same
    // value, so pick out the readonly one.
    const result = renderPage();
    await openSetupForm(result, 7777);
    const locked = screen.getAllByDisplayValue("7777").filter((el) => el.readOnly);
    expect(locked).toHaveLength(1);
  });

  it("keeps Confirm disabled until name, both flights, and the admin box are set", async () => {
    const result = renderPage();
    await openSetupForm(result);
    const confirm = () => screen.getByRole("button", { name: "Confirm" });

    expect(confirm()).toBeDisabled();

    await result.user.type(screen.getByPlaceholderText("Enter Squadron Name"), "Newtown");
    expect(confirm()).toBeDisabled();

    await result.user.type(screen.getByPlaceholderText("Flight 1 Name"), "Vulcan");
    expect(confirm()).toBeDisabled(); // admin box still unticked

    await result.user.click(screen.getByRole("checkbox"));
    expect(confirm()).toBeEnabled();
  });

  it("does not require the staff flight name", async () => {
    // Validation checks flightNames.slice(1) only; the first defaults to
    // "Training Flight" at save time.
    const result = renderPage();
    await openSetupForm(result);
    await result.user.type(screen.getByPlaceholderText("Enter Squadron Name"), "Newtown");
    await result.user.type(screen.getByPlaceholderText("Flight 1 Name"), "Vulcan");
    await result.user.click(screen.getByRole("checkbox"));

    expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
  });

  it("files a NewAccountRequest carrying a flights array", async () => {
    // Phase 9: the request now carries `flights`. The flat flight1Name..3Name
    // fields are still written so a System Admin on an older build can read it.
    const result = renderPage();
    await openSetupForm(result);
    await result.user.type(screen.getByPlaceholderText("Enter Squadron Name"), "Newtown");
    await result.user.type(screen.getByPlaceholderText("Flight 1 Name"), "Vulcan");
    await result.user.click(screen.getByRole("button", { name: "+ Add another flight" }));
    await result.user.type(screen.getByPlaceholderText("Flight 2 Name"), "Lightning");
    await result.user.click(screen.getByRole("button", { name: "+ Add another flight" }));
    await result.user.type(screen.getByPlaceholderText("Flight 3 Name"), "Spitfire");
    await result.user.click(screen.getByRole("checkbox"));
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    await screen.findByText(/submitted for review by a System Admin/);

    const request = result.writes().find((w) => w.path.startsWith("NewAccountRequests/"));
    expect(request.data).toMatchObject({
      squadronName: "Newtown",
      squadronNumber: 7777,
      flights: ["", "Vulcan", "Lightning", "Spitfire"],
      displayName: "New Person",
      uid: UIDS.stranger,
    });
  });
});

describe("signing in as a system admin", () => {
  it("asks for a squadron number rather than handing over", async () => {
    const result = renderPage();
    await signInAs(result, SYS_ADMIN);
    expect(await screen.findByText("Please enter your Squadron number:")).toBeInTheDocument();
  });

  it("enters any existing squadron as its admin", async () => {
    const result = renderPage();
    await signInAs(result, SYS_ADMIN);
    await screen.findByText("Please enter your Squadron number:");
    await enterSquadronNumber(result, 9998);

    await waitFor(() => expect(result.onUserChange).toHaveBeenCalled());
    const [userArg, isAdmin] = result.onUserChange.mock.calls[0];
    expect(userArg).toMatchObject({ squadronNumber: 9998, squadronName: "Testwood", role: "admin" });
    expect(isAdmin).toBe(true);
  });

  it("creates a squadron directly instead of filing a request", async () => {
    const result = renderPage();
    await signInAs(result, SYS_ADMIN);
    await screen.findByText("Please enter your Squadron number:");
    await enterSquadronNumber(result, 7777);
    await screen.findByText(/Squadron does not exist/);
    await result.user.click(screen.getByRole("button", { name: "Set Up" }));
    await screen.findByText("New Squadron Setup");

    await result.user.type(screen.getByPlaceholderText("Enter Squadron Name"), "Newtown");
    await result.user.type(screen.getByPlaceholderText("Flight 1 Name"), "Vulcan");
    await result.user.click(screen.getByRole("button", { name: "+ Add another flight" }));
    await result.user.type(screen.getByPlaceholderText("Flight 2 Name"), "Lightning");
    await result.user.click(screen.getByRole("checkbox"));
    await result.user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(result.store()["SquadronDatabases/7777"]).toBeDefined();
    });

    const store = result.store();
    // SquadronList row with the defaulted staff flight name.
    const listEntry = Object.entries(store).find(
      ([path, doc]) => path.startsWith("SquadronList/") && doc.Number === 7777
    );
    expect(listEntry[1].flights).toEqual(["Training Flight", "Vulcan", "Lightning"]);

    // The creator becomes the squadron's admin, keyed by uid.
    expect(store[`SquadronDatabases/7777/AuthorisedUsers/${UIDS.systemAdmin}`]).toMatchObject({
      role: "admin",
    });

    // The FlightPoints template is copied in wholesale.
    expect(store["SquadronDatabases/7777/FlightPoints/Badge Points"]).toMatchObject({
      "Gold Badge": 20,
    });

    // No request is filed -- creation was direct.
    expect(Object.keys(store).filter((p) => p.startsWith("NewAccountRequests/auto"))).toEqual([]);
  });
});
