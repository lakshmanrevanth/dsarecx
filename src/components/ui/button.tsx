import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'ember' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  ember: 'btn-ember',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const SIZE: Record<ButtonSize, string> = { sm: 'btn-sm', md: '', lg: 'btn-lg' };

/** Class string for a pill button, for links styled as buttons. */
export function buttonClass({
  variant = 'outline',
  size = 'md',
  icon = false,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; icon?: boolean; className?: string } = {}) {
  return cn('btn', VARIANT[variant], SIZE[size], icon && 'btn-icon', className);
}

export type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square icon-only button. Give it an aria-label. */
  icon?: boolean;
};

/** Pill button built on the `.btn` design classes. Defaults to type="button". */
export function Button({ variant = 'outline', size = 'md', icon = false, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, icon, className })} {...props} />;
}
