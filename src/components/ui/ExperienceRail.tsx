import type { AnchorHTMLAttributes, ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

export function ExperienceRail({ children }: PropsWithChildren) {
  return <div className="experience-rail-panel">{children}</div>;
}

export function ExperienceRailSection({
  label,
  title,
  description,
  children,
}: PropsWithChildren<{
  label?: string;
  title?: string;
  description?: string;
}>) {
  return (
    <section className="experience-rail-section">
      {label ? <p className="rail-label">{label}</p> : null}
      {title ? <h2 className="rail-title">{title}</h2> : null}
      {description ? <p className="rail-copy">{description}</p> : null}
      {children}
    </section>
  );
}

function navClasses(active?: boolean) {
  return ['rail-nav-item', active ? 'is-active' : ''].filter(Boolean).join(' ');
}

export function ExperienceRailLink({
  active,
  children,
  ...props
}: LinkProps & { active?: boolean; children: ReactNode }) {
  return (
    <Link {...props} className={navClasses(active)}>
      {children}
    </Link>
  );
}

export function ExperienceRailButton({
  active,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; children: ReactNode }) {
  return (
    <button
      {...props}
      className={[navClasses(active), className].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}

export function ExperienceRailAnchor({
  active,
  children,
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { active?: boolean; children: ReactNode }) {
  return (
    <a
      {...props}
      className={[navClasses(active), className].filter(Boolean).join(' ')}
    >
      {children}
    </a>
  );
}
