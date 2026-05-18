export function WorkspacePageFrame({ children, module, title }) {
  const pageTitle = title ?? module.title;

  return (
    <>
      <section className="page-intro" aria-label={`${pageTitle} page title`}>
        <h1>{pageTitle}</h1>
      </section>

      {children}
    </>
  );
}
