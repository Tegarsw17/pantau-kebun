import { useAdminWorkspace } from "./AdminWorkspaceContext.jsx";

export function AdminPageFrame({ children, showGardenPicker = true, summary, title }) {
  const { gardenLabel } = useAdminWorkspace();

  return (
    <>
      <section className="page-intro page-intro--with-toolbar" aria-label={`${title} page title`}>
        <div className="page-intro__copy">
          <h1>{title}</h1>
          {summary ? <p className="page-intro__summary">{summary}</p> : null}
        </div>

        {showGardenPicker ? (
          <div className="admin-page-toolbar">
            <label className="control-block admin-garden-picker" htmlFor="admin-garden-select">
              <span className="control-label">Garden</span>
              <select id="admin-garden-select" defaultValue="garden-3">
                <option value="garden-3">{gardenLabel}</option>
              </select>
            </label>
          </div>
        ) : null}
      </section>

      {children}
    </>
  );
}
