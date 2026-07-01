import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

import "./Index.css";
import "./theme.css";

function applyTheme(theme) {
  const isLight = theme === "light";
  document.documentElement.classList.toggle("light", isLight);
  document.body.classList.toggle("light", isLight);
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
}

applyTheme(localStorage.getItem("theme") || "dark");

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);