import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './lib/cn';

/**
 * GINX Input — dark-theme text field matching the card surface.
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-xl bg-gym-card text-gym-text placeholder:text-gym-text/40',
        'px-4 py-3 text-sm border border-white/10 transition-colors',
        'focus:outline-none focus:border-gym-primary/60 focus:ring-1 focus:ring-gym-primary/40',
        'disabled:opacity-40 disabled:pointer-events-none',
        invalid && 'border-gym-accent focus:border-gym-accent focus:ring-gym-accent/40',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';
