import { useEffect, useState } from "react";
import { AdminOrchardWorkspace } from "./AdminOrchardWorkspace.jsx";
import { loadAdminOrchardWorkspace } from "../data/loadAdminOrchardWorkspace.js";
import { getAdminPersistenceMode } from "../data/adminOrchardSupabase.js";

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
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState({
    dataSource: getAdminPersistenceMode(),
    imageBounds: null,
    loadState: "loading",
    unmappedTrees: [],
  });

  const isAccessKeyConfigured = ADMIN_ACCESS_KEY.length > 0;

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let isMounted = true;

    loadAdminOrchardWorkspace()
      .then((snapshot) => {
        if (!isMounted) {
          return;
        }

        setWorkspaceSnapshot({
          dataSource: snapshot.dataSource,
          imageBounds: snapshot.imageBounds,
          loadState: "ready",
          unmappedTrees: snapshot.unmappedTrees,
        });
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setWorkspaceSnapshot({
          dataSource: getAdminPersistenceMode(),
          imageBounds: null,
          loadState: "error",
          unmappedTrees: [],
        });
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

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
            <p className="eyebrow admin-eyebrow">Setup Lab</p>
            <h1>Admin Orchard Access</h1>
            <p className="admin-gate-copy">Protected route for orchard calibration workspace.</p>
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
    <div className="admin-shell">
      <header className="admin-topbar">
        <div>
          <p className="eyebrow admin-eyebrow">Setup Lab</p>
          <h1>Admin Orchard Workspace</h1>
        </div>

        <div className="admin-topbar__actions">
          <span className="admin-status-pill">Session Active</span>
          <span className="admin-route-pill">/admin-orchard</span>
          <button className="admin-lock-button" type="button" onClick={handleLock}>
            Lock Session
          </button>
        </div>
      </header>

      <AdminOrchardWorkspace
        dataSource={workspaceSnapshot.dataSource}
        imageBounds={workspaceSnapshot.imageBounds}
        loadState={workspaceSnapshot.loadState}
        unmappedTrees={workspaceSnapshot.unmappedTrees}
      />
    </div>
  );
}
