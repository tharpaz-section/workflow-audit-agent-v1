import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

function classes(variant: Variant, size: Size) {
  return [
    'button',
    `button-${variant}`,
    size === 'sm' ? 'button-sm' : '',
    size === 'lg' ? 'button-lg' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button className={[classes(variant, size), className].filter(Boolean).join(' ')} {...props}>
      {children}
    </button>
  );
}

type ButtonLinkProps = LinkProps & {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
};

export function ButtonLink({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={[classes(variant, size), className].filter(Boolean).join(' ')} {...props}>
      {children}
    </Link>
  );
}

type ButtonAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
};

export function ButtonAnchor({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonAnchorProps) {
  return (
    <a className={[classes(variant, size), className].filter(Boolean).join(' ')} {...props}>
      {children}
    </a>
  );
}
