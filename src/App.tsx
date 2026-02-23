
import React from "react";
import PlatformShell from "./platform/PlatformShell";
import { ToastProvider } from "./platform/ui/ToastContext";

const App: React.FC = () => {
  return (
    <ToastProvider>
      <PlatformShell />
    </ToastProvider>
  );
};

export default App;
