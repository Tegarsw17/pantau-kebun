import { AdminPageFrame } from "../components/AdminPageFrame.jsx";

export function AdminModulePlaceholderPage({ module }) {
  return (
    <AdminPageFrame summary={module.summary} title={module.label}>
      <main className="dashboard">
        <section
          className="workspace-panel workspace-panel--secondary"
          aria-label={`${module.label} admin module status`}
        >
          <div className="workspace-panel__header">
            <div className="workspace-panel__heading">
              <p className="section-kicker">{module.label}</p>
              <h2>Coming soon</h2>
            </div>
          </div>

          <div className="workspace-panel__body">
            <p className="module-placeholder__copy">{module.placeholderCopy}</p>
          </div>
        </section>
      </main>
    </AdminPageFrame>
  );
}
