import type { PropsWithChildren, ReactNode } from 'react';

type CardTone = 'default' | 'soft' | 'highlight';

export function Card({
  title,
  description,
  tone = 'default',
  aside,
  children,
}: PropsWithChildren<{
  title?: string;
  description?: string;
  tone?: CardTone;
  aside?: ReactNode;
}>) {
  return (
    <section className="card" data-tone={tone}>
      {(title || aside) && (
        <div className="card-title-row">
          <div>
            {title ? <h2 className="card-title">{title}</h2> : null}
            {description ? <p className="card-description">{description}</p> : null}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
