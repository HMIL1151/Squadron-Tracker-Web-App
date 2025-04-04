import React from "react";
import ReactDOM from "react-dom/client"; // Import the new createRoot API
import "./Styles/index.css";
import App from "./App";
import reportWebVitals from "./misc/reportWebVitals";
import { SquadronProvider } from "./context/SquadronContext"; // Import the provider

// Create the root element
const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement); // Use createRoot instead of render

root.render(
  <React.StrictMode>
    <SquadronProvider>
      <App />
    </SquadronProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
