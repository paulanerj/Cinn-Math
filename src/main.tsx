import React from "react";
import ReactDOM from "react-dom/client";
import GameSelector from "./platform/GameSelector";
import { ToastProvider } from "./platform/ui/ToastContext";
import "./index.css";
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find #root element to mount React into.");
}
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ToastProvider>
      <GameSelector />
    </ToastProvider>
  </React.StrictMode>
);
