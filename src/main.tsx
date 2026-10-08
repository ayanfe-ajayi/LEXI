import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import "./styles/globals.css";
import { configurePwaViewport } from "./lib/pwaViewport";
const resetViewport = configurePwaViewport();
if (import.meta.hot) import.meta.hot.dispose(resetViewport);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              const event = new CustomEvent("lexi-update-ready");
              window.dispatchEvent(event);
            }
          });
        });
      })
      .catch(console.error);
  });
