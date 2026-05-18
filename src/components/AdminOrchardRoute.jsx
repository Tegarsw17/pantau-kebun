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
    imageCalibration: null,
    imageBounds: null,
    loadState: "loading",
    mappedTrees: [],
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
          imageCalibration: snapshot.imageCalibration,
          imageBounds: snapshot.imageBounds,
          loadState: "ready",
          mappedTrees: snapshot.mappedTrees,
          unmappedTrees: snapshot.unmappedTrees,
        });
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setWorkspaceSnapshot({
          dataSource: getAdminPersistenceMode(),
          imageCalibration: null,
          imageBounds: null,
          loadState: "error",
          mappedTrees: [],
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
    <div className="app-shell admin-shell">
      <aside className="app-sidebar admin-sidebar" aria-label="Admin Orchard Sidebar">
        <div className="app-sidebar__brand">
          <div className="app-sidebar__brand-mark" aria-hidden="true">
            PK
          </div>
          <div className="app-sidebar__brand-copy">
            <p className="eyebrow">Pantau Kebun</p>
            <strong className="app-sidebar__title">Farm Workspace</strong>
          </div>
        </div>

        <div className="admin-sidebar__body">
          <div className="admin-sidebar__section">
            <span className="admin-sidebar__label">Admin Orchard</span>
            <strong className="admin-sidebar__title">Coordinate Setup</strong>
          </div>

          <div className="admin-sidebar__meta">
            <span>Garden 3</span>
            <span>{workspaceSnapshot.dataSource === "supabase" ? "Supabase Sync" : "Local Draft"}</span>
          </div>
        </div>

        <button className="admin-lock-button admin-lock-button--sidebar" type="button" onClick={handleLock}>
          Lock Session
        </button>
      </aside>

      <div className="app-content">
        <section className="page-intro" aria-label="Admin Orchard page title">
          <h1>Admin Orchard</h1>
        </section>

        <AdminOrchardWorkspace
          dataSource={workspaceSnapshot.dataSource}
          imageCalibration={workspaceSnapshot.imageCalibration}
          imageBounds={workspaceSnapshot.imageBounds}
          loadState={workspaceSnapshot.loadState}
          mappedTrees={workspaceSnapshot.mappedTrees}
          unmappedTrees={workspaceSnapshot.unmappedTrees}
        />
      </div>
    </div>
  );
}
