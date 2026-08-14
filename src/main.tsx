import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import App from "./App";

document.documentElement.lang = detectInitialLanguage();

function detectInitialLanguage(): "es" | "en" {
  const stored = localStorage.getItem("pulso-language");
  if (stored === "es" || stored === "en") return stored;
  return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}
