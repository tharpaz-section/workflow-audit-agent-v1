import { X } from 'lucide-react';
import { useEffect, type PropsWithChildren, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function SideSheet({
  open,
  onClose,
  title,
  description,
  actions,
  children,
}: PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  actions?: ReactNode;
}>) {
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="sheet-root" role="presentation">
      <button
        type="button"
        className="sheet-backdrop"
        aria-label="Close panel"
        onClick={onClose}
      />
      <section
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close panel">
          <X size={22} />
        </button>
        <div className="sheet-header">
          <h2 className="sheet-title">{title}</h2>
          {description ? <p className="sheet-description">{description}</p> : null}
        </div>
        <div className="sheet-body">{children}</div>
        {actions ? <div className="sheet-actions">{actions}</div> : null}
      </section>
    </div>,
    document.body,
  );
}
