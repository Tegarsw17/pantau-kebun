import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  readAdminAuthSession,
  signInAdminWithPassword,
  signOutAdminAuth,
} from "../data/adminOrchardSupabase.js";
import { WorkspaceSidebar } from "./WorkspaceSidebar.jsx";
import { AdminWorkspaceProvider } from "./AdminWorkspaceContext.jsx";

export function AdminOrchardRoute() {
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(() => readAdminAuthSession() != null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUnlock = async (event) => {
    event.preventDefault();

    if (emailInput.trim() === "" || passwordInput === "") {
      setErrorMessage("Email and password are required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await signInAdminWithPassword({
        email: emailInput.trim(),
        password: passwordInput,
      });
      setIsAuthenticated(true);
      setEmailInput("");
      setPasswordInput("");
      toast.success("Admin session started.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Admin sign in failed.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLock = async () => {
    await signOutAdminAuth();
    setIsAuthenticated(false);
    setErrorMessage("");
    setEmailInput("");
    setPasswordInput("");
    toast.success("Admin session ended.");
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-gate-shell">
        <section className="admin-gate-card" aria-label="Admin Orchard Access Gate">
          <div className="admin-gate-card__header">
            <h1>Admin Orchard</h1>
            <p className="admin-gate-copy">Supabase admin account required for protected workspace access.</p>
          </div>

          <form className="admin-gate-form" onSubmit={handleUnlock}>
            <label className="control-block" htmlFor="admin-email">
              <span className="control-label">Email</span>
              <input
                id="admin-email"
                autoComplete="email"
                className="admin-access-input"
                onChange={(event) => {
                  setEmailInput(event.target.value);
                  if (errorMessage !== "") {
                    setErrorMessage("");
                  }
                }}
                placeholder="admin@pantaukebun.local"
                spellCheck="false"
                type="email"
                value={emailInput}
              />
            </label>

            <label className="control-block" htmlFor="admin-password">
              <span className="control-label">Password</span>
              <input
                id="admin-password"
                autoComplete="current-password"
                className="admin-access-input"
                onChange={(event) => {
                  setPasswordInput(event.target.value);
                  if (errorMessage !== "") {
                    setErrorMessage("");
                  }
                }}
                placeholder="Enter password"
                spellCheck="false"
                type="password"
                value={passwordInput}
              />
            </label>

            <button className="admin-submit-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing In..." : "Sign In"}
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
              Sign Out
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
