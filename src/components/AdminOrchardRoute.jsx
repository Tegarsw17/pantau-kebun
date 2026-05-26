import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { WorkspaceSidebar } from "./WorkspaceSidebar.jsx";
import { AdminWorkspaceProvider } from "./AdminWorkspaceContext.jsx";

const ADMIN_ACCESS_KEY = (
  import.meta.env.VITE_ADMIN_ACCESS_KEY ?? (import.meta.env.DEV ? "pantaukebun-admin" : "")
).trim();
const ADMIN_SESSION_KEY = "pantaukebun.admin-orchard.session";

function readAdminSession() {
  try {
    return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === "granted";
  } catch {
    return false;
  }
}

function writeAdminSession(value) {
  try {
    if (value) {
      window.sessionStorage.setItem(ADMIN_SESSION_KEY, "granted");
      return;
    }

    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    // Ignore storage failures in prototype mode.
  }
}

export function AdminOrchardRoute() {
  const [accessKeyInput, setAccessKeyInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(readAdminSession);

  const isAccessKeyConfigured = ADMIN_ACCESS_KEY.length > 0;

  const handleUnlock = (event) => {
    event.preventDefault();

    if (!isAccessKeyConfigured) {
      setErrorMessage("Admin access key is not configured in VITE_ADMIN_ACCESS_KEY.");
      return;
    }

    if (accessKeyInput.trim() !== ADMIN_ACCESS_KEY) {
      setErrorMessage("Access key is not valid.");
      return;
    }

    writeAdminSession(true);
    setIsAuthenticated(true);
    setAccessKeyInput("");
    setErrorMessage("");
  };

  const handleLock = () => {
    writeAdminSession(false);
    setIsAuthenticated(false);
    setErrorMessage("");
    setAccessKeyInput("");
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-gate-shell">
        <section className="admin-gate-card" aria-label="Admin Orchard Access Gate">
          <div className="admin-gate-card__header">
            <h1>Admin Orchard</h1>
            <p className="admin-gate-copy">Access key required for coordinate setup.</p>
          </div>

          <form className="admin-gate-form" onSubmit={handleUnlock}>
            <label className="control-block" htmlFor="admin-access-key">
              <span className="control-label">Access Key</span>
              <input
                id="admin-access-key"
                className="admin-access-input"
                type="password"
                value={accessKeyInput}
                onChange={(event) => {
                  setAccessKeyInput(event.target.value);
                  if (errorMessage !== "") {
                    setErrorMessage("");
                  }
                }}
                placeholder="Enter access key"
                autoComplete="current-password"
                spellCheck="false"
              />
            </label>

            <button className="admin-submit-button" type="submit" disabled={!isAccessKeyConfigured}>
              Unlock Workspace
            </button>

            {errorMessage ? (
              <p className="admin-gate-error" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </form>
        </section>
      </div>
    );
  }

  return (
    <AdminWorkspaceProvider
      value={{
        gardenLabel: "Kebun Ntak-Ntak",
        onLockSession: handleLock,
      }}
    >
      <div className="app-shell admin-shell">
        <WorkspaceSidebar
          basePath="/admin-orchard"
          footerAction={
            <button className="admin-lock-button admin-lock-button--sidebar" type="button" onClick={handleLock}>
              Lock Session
            </button>
          }
        />

        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </AdminWorkspaceProvider>
  );
}
