import type { PropsWithChildren, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function PageLayout({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: PropsWithChildren<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}>) {
  return (
    <div className="page-shell">
      <div className="page-topbar">
        <Link to="/" className="home-link" aria-label="Go home">
          <span className="home-link-brand">Section</span>
          <span className="home-link-divider">/</span>
          <span className="home-link-label">Home</span>
        </Link>
      </div>
      <header className="page-header">
        <div className="page-header-copy">
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}
