import React from "react";
import ReactDOM from "react-dom/client"; // Import the new createRoot API
import ReactModal from "react-modal";
/*
 * Tokens first, and as their own module rather than an @import inside
 * index.css.
 *
 * Both matter. Importing here keeps the colour vocabulary in the eager entry
 * chunk, so it is defined on first paint whichever lazily-loaded dashboard the
 * user lands on -- an undefined var() resolves to nothing, not to a default.
 *
 * The @import version also went stale: editing tokens.css left the dev server
 * serving the previous values inside index.css, because the import was not
 * registered as an invalidation dependency, and Vite's on-disk cache carried
 * that across restarts. A separate module gets its own node in the graph and
 * invalidates properly.
 */
import "./Styles/tokens.css";
import "./Styles/index.css";
import App from "./App";
import reportWebVitals from "./misc/reportWebVitals";
import { SquadronProvider } from "./context/SquadronContext"; // Import the provider
import { DataProvider } from "./context/DataContext";
import { ThemeProvider } from "./context/ThemeContext";

// Create the root element
const rootElement = document.getElementById("root");

// Tells react-modal what to hide from assistive technology while a dialog is
// open. Set once, here, because it is global to the library rather than to any
// one Modal. The test suite does the same in setupTests.js.
ReactModal.setAppElement(rootElement);

const root = ReactDOM.createRoot(rootElement); // Use createRoot instead of render

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <DataProvider>
        <SquadronProvider>
          <App />
        </SquadronProvider>
      </DataProvider>
    </ThemeProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(//console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
