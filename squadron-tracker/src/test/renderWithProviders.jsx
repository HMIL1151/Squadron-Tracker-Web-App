/**
 * Renders a component the way the running app does: inside the real providers,
 * seeded with a dummy squadron, backed by the in-memory Firestore.
 *
 * The providers are the real ones rather than stubs, so what gets tested is the
 * app's own wiring. Only the data underneath is swapped.
 */

import React from "react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DataProvider } from "../context/DataContext";
import { SquadronProvider } from "../context/SquadronContext";
import { SQUADRONS, dataContextFor, dummyData, userFor } from "./dummyData";
import { __seed, __writes, __store } from "./fakeFirestore";
import { ThemeProvider } from "../context/ThemeContext";
import { UiVersionProvider } from "../context/UiVersionContext";

/**
 * @param ui           element to render
 * @param options.squadron        squadron number (default 9999 "Faketon")
 * @param options.data            override the seeded DataContext state
 * @param options.user            override the `user` prop helper
 * @param options.seedFirestore   seed the fake with dummyData (default true)
 *
 * Returns Testing Library's result plus:
 *   user     a userEvent session, already set up
 *   data     the DataContext state the component was given
 *   props    { user } as App would pass it to a dashboard
 *   writes() every Firestore write made since render
 *   store()  current fake Firestore contents
 */
export const renderWithProviders = (ui, options = {}) => {
  const {
    squadron = SQUADRONS.FAKETON,
    data,
    user,
    squadronDocId = null,
    seedFirestore = true,
    theme = "light",
    uiVersion = "classic",
    ...renderOptions
  } = options;

  if (seedFirestore) __seed(dummyData);

  const contextData = data || dataContextFor(squadron);
  const userProp = user || userFor(squadron);

  // Flights are seeded into context exactly as App.handleUserChange does on
  // login, so dashboards see the squadron's real flight names.
  /*
   * ThemeProvider is outermost and takes an explicit theme.
   *
   * Explicit because the default reads prefers-color-scheme, which jsdom
   * reports as light but which a CI runner could in principle differ on -- a
   * suite whose theme depends on the machine is a suite that fails somewhere
   * else. Tests that care about dark pass `theme: "dark"`.
   */
  /*
   * UiVersionProvider is outermost and takes an explicit version, for the same
   * reason ThemeProvider takes an explicit theme: the default consults
   * localStorage and the URL, so a suite that did not pin it would render
   * whichever interface the last test happened to leave cached. Tests that
   * care about the new interface pass `uiVersion: "muster"`.
   *
   * It defaults to "classic" so that every test written before this existed
   * keeps exercising the interface it was written against.
   */
  const Wrapper = ({ children }) => (
    <UiVersionProvider initialVersion={uiVersion} uid={userProp.uid || "test-uid"}>
    <ThemeProvider initialTheme={theme} uid={userProp.uid || "test-uid"}>
    <DataProvider initialData={contextData}>
      <SquadronProvider
        initialSquadronNumber={squadron}
        initialSquadronDocId={squadronDocId}
        initialFlights={userProp.flightNames || []}
      >
        {children}
      </SquadronProvider>
    </DataProvider>
    </ThemeProvider>
    </UiVersionProvider>
  );

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });

  return {
    ...result,
    user: userEvent.setup(),
    data: contextData,
    props: { user: userProp },
    writes: () => __writes(),
    store: () => __store(),
  };
};

export default renderWithProviders;
