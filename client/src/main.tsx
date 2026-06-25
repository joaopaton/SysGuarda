import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthGate } from "./components/AuthGate";
import { ThemeProvider } from "./state/ThemeContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthGate>
        {(logout, user) => <App onLogout={logout} user={user} />}
      </AuthGate>
    </ThemeProvider>
  </StrictMode>
);
