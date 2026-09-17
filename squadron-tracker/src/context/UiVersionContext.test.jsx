/**
 * UiVersionContext -- which interface a user gets, and who decided.
 *
 * The precedence rules are the whole feature. Two of them are easy to get
 * wrong in a way nobody notices until a rollout goes badly:
 *
 *   A user who explicitly chose classic must STAY on classic when the system
 *   default later moves to muster. Treating "no preference" and "chose
 *   classic" as the same value silently re-opts in everyone who opted out.
 *
 *   `?ui=` must beat the account, because it is the escape hatch for an
 *   interface that has broken badly enough to hide its own switch. If the
 *   account can correct it a moment after load, the escape hatch does not
 *   work when it is actually needed.
 */

import React, { useContext } from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import UiVersionContext, { UiVersionProvider, useUiVersion } from "./UiVersionContext";
import { __seed, __store } from "../test/fakeFirestore";

const UID = "uid-under-test";

const Probe = () => {
  const { uiVersion, systemDefault, hasPreference, isPinnedByUrl, chooseUiVersion, clearUiPreference } =
    useUiVersion();
  return (
    <div>
      <span data-testid="version">{uiVersion}</span>
      <span data-testid="system">{String(systemDefault)}</span>
      <span data-testid="hasPreference">{String(hasPreference)}</span>
      <span data-testid="pinned">{String(isPinnedByUrl)}</span>
      <button onClick={() => chooseUiVersion("muster")}>choose muster</button>
      <button onClick={() => chooseUiVersion("classic")}>choose classic</button>
      <button onClick={clearUiPreference}>follow default</button>
    </div>
  );
};

/**
 * Seeds the fake Firestore, then renders.
 *
 * `initialVersion` is deliberately NOT passed by default: these tests are
 * about what the provider resolves to on its own, and pinning it would test
 * the pin rather than the resolution.
 */
const renderProvider = async ({ preference = null, systemDefault = null, ...props } = {}) => {
  const seed = {};
  if (preference) seed[`UserPreferences/${UID}`] = { uiVersion: preference };
  if (systemDefault) seed["SystemConfig/ui"] = { defaultVersion: systemDefault };
  __seed(seed);

  const result = render(
    <UiVersionProvider uid={UID} {...props}>
      <Probe />
    </UiVersionProvider>
  );
  // The account read is async; every assertion below depends on it having
  // landed, so wait for it once here rather than in each test.
  await waitFor(() => expect(screen.getByTestId("system")).toBeInTheDocument());
  return result;
};

/** Pretends the page was loaded with `?ui=<value>`. */
const withSearch = (value) => {
  const original = window.location.search;
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, search: value },
  });
  return () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, search: original },
    });
  };
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-ui");
});

describe("resolving which interface to show", () => {
  it("falls back to classic when nobody has an opinion", async () => {
    await renderProvider();
    expect(screen.getByTestId("version")).toHaveTextContent("classic");
    expect(screen.getByTestId("hasPreference")).toHaveTextContent("false");
  });

  it("follows the system default when the user has no preference", async () => {
    await renderProvider({ systemDefault: "muster" });
    await waitFor(() => expect(screen.getByTestId("version")).toHaveTextContent("muster"));
    expect(screen.getByTestId("hasPreference")).toHaveTextContent("false");
  });

  it("prefers the user's own choice over the system default", async () => {
    await renderProvider({ preference: "muster", systemDefault: "classic" });
    await waitFor(() => expect(screen.getByTestId("version")).toHaveTextContent("muster"));
    expect(screen.getByTestId("hasPreference")).toHaveTextContent("true");
  });

  /*
   * The regression this whole context is shaped around. "No preference" and
   * "chose classic" must not collapse into one value.
   */
  it("keeps a user who chose classic on classic after the default moves to muster", async () => {
    await renderProvider({ preference: "classic", systemDefault: "muster" });
    await waitFor(() => expect(screen.getByTestId("hasPreference")).toHaveTextContent("true"));
    expect(screen.getByTestId("version")).toHaveTextContent("classic");
  });
});

describe("the URL escape hatch", () => {
  it("beats the account, so a broken interface can always be left", async () => {
    const restore = withSearch("?ui=classic");
    try {
      await renderProvider({ preference: "muster", systemDefault: "muster" });
      expect(screen.getByTestId("version")).toHaveTextContent("classic");
      expect(screen.getByTestId("pinned")).toHaveTextContent("true");
    } finally {
      restore();
    }
  });

  it("does not write the pinned value to the account", async () => {
    const restore = withSearch("?ui=classic");
    try {
      await renderProvider({ preference: "muster" });
      expect(__store()[`UserPreferences/${UID}`]).toEqual({ uiVersion: "muster" });
    } finally {
      restore();
    }
  });

  it("is ignored when it names something that is not an interface", async () => {
    const restore = withSearch("?ui=banana");
    try {
      await renderProvider({ systemDefault: "muster" });
      await waitFor(() => expect(screen.getByTestId("version")).toHaveTextContent("muster"));
      expect(screen.getByTestId("pinned")).toHaveTextContent("false");
    } finally {
      restore();
    }
  });
});

describe("choosing for yourself", () => {
  it("records the choice on the account so it follows the user", async () => {
    await renderProvider();
    await userEvent.click(screen.getByText("choose muster"));

    expect(screen.getByTestId("version")).toHaveTextContent("muster");
    await waitFor(() =>
      expect(__store()[`UserPreferences/${UID}`]).toMatchObject({ uiVersion: "muster" })
    );
  });

  it("caches the choice so the pre-paint script agrees on the next load", async () => {
    await renderProvider();
    await userEvent.click(screen.getByText("choose muster"));
    expect(localStorage.getItem("squadron-tracker:ui")).toBe("muster");
  });

  it("giving up a preference returns the user to the system default", async () => {
    await renderProvider({ preference: "classic", systemDefault: "muster" });
    await waitFor(() => expect(screen.getByTestId("version")).toHaveTextContent("classic"));

    await userEvent.click(screen.getByText("follow default"));
    expect(screen.getByTestId("version")).toHaveTextContent("muster");
    expect(screen.getByTestId("hasPreference")).toHaveTextContent("false");
  });
});

describe("the attribute the stylesheets key off", () => {
  it("is set on the document element", async () => {
    await renderProvider({ systemDefault: "muster" });
    await waitFor(() => expect(document.documentElement.getAttribute("data-ui")).toBe("muster"));
  });

  it("is always present, unlike data-theme, because there is no follow-the-OS case", async () => {
    await renderProvider();
    expect(document.documentElement.getAttribute("data-ui")).toBe("classic");
  });
});

describe("using the context without a provider", () => {
  it("throws, so a missing provider is a loud failure rather than a silent classic", () => {
    const Bare = () => {
      useUiVersion();
      return null;
    };
    // React logs the thrown error as well as rethrowing it; the log is noise.
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow(/UiVersionProvider/);
    spy.mockRestore();
  });

  it("the tolerant reader falls back to classic, for components shared with older tests", () => {
    const Tolerant = () => {
      const value = useContext(UiVersionContext);
      return <span data-testid="raw">{String(value)}</span>;
    };
    render(<Tolerant />);
    expect(screen.getByTestId("raw")).toHaveTextContent("null");
  });
});
