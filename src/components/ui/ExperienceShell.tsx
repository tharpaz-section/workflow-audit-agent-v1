import type { PropsWithChildren, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function ExperienceShell({
  rail,
  eyebrow,
  title,
  subtitle,
  headerActions,
  children,
}: PropsWithChildren<{
  rail: ReactNode;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
}>) {
  return (
    <div className="experience-shell">
      <aside className="experience-rail">
        <div className="experience-rail-inner">{rail}</div>
      </aside>

      <main className="experience-main">
        <div className="experience-brand-row">
          <Link to="/" className="experience-brand-link" aria-label="Go to workflow audit home">
            <img src="/images/section-black.png" alt="Section" className="experience-brand-mark" />
          </Link>
          {headerActions ? <div className="experience-brand-actions">{headerActions}</div> : null}
        </div>

        <header className="experience-header">
          <div className="experience-header-copy">
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            <h1 className="experience-title">{title}</h1>
            {subtitle ? <p className="experience-subtitle">{subtitle}</p> : null}
          </div>
        </header>

        <div className="experience-workspace">{children}</div>
      </main>
    </div>
  );
}
