import { Link, useRouterState } from "@tanstack/react-router";
import {
  WORKSPACE_MODULES,
  WORKSPACE_NAV_ITEMS,
} from "../data/workspaceModules.js";

export function WorkspaceSidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <aside className="app-sidebar" aria-label="Primary navigation">
      <div className="app-sidebar__brand">
        <div className="app-sidebar__brand-mark" aria-hidden="true">
          PK
        </div>
        <div className="app-sidebar__brand-copy">
          <p className="eyebrow">Pantau Kebun</p>
          <strong className="app-sidebar__title">Farm Workspace</strong>
        </div>
      </div>

      <nav className="app-sidebar__nav">
        {WORKSPACE_NAV_ITEMS.map((itemId) => {
          const item = WORKSPACE_MODULES[itemId];
          const Icon = item.icon;
          const isActive =
            item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`);

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`app-sidebar__nav-button ${
                isActive ? "app-sidebar__nav-button--active" : ""
              }`}
              key={item.id}
              to={item.to}
            >
              <span className="app-sidebar__nav-button-main">
                <span className="app-sidebar__nav-glyph" aria-hidden="true">
                  <Icon size={16} strokeWidth={2} />
                </span>
                <span className="app-sidebar__nav-button-label">{item.label}</span>
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
