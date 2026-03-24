import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import { applyStoredThemePreference } from "./lib/theme";
import "./index.css";

applyStoredThemePreference();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
