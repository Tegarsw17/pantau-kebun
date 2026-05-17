export function WorkspacePageFrame({ children, module }) {
  return (
    <>
      <section className="page-intro" aria-label={`${module.label} page title`}>
        <p className="section-kicker">{module.label}</p>
        <div className="page-intro__copy">
          <h1>{module.title}</h1>
          <p className="page-intro__summary">{module.summary}</p>
        </div>
      </section>

      {children}
    </>
  );
}
