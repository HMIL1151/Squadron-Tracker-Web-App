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
    seedFirestore = true,
    ...renderOptions
  } = options;

  if (seedFirestore) __seed(dummyData);

  const contextData = data || dataContextFor(squadron);
  const userProp = user || userFor(squadron);

  // Flights are seeded into context exactly as App.handleUserChange does on
  // login, so dashboards see the squadron's real flight names.
  const Wrapper = ({ children }) => (
    <DataProvider initialData={contextData}>
      <SquadronProvider
        initialSquadronNumber={squadron}
        initialFlights={userProp.flightNames || []}
      >
        {children}
      </SquadronProvider>
    </DataProvider>
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
