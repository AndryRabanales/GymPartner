import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './lib/cn';

/**
 * GINX Button — the athletic, uppercase, black-weight call-to-action.
 * The signature primary style is a white fill that flips to gold on hover,
 * with `active:scale-95` press feedback.
 */
const button = cva(
  'inline-flex items-center justify-center gap-2 font-black uppercase tracking-widest ' +
    'rounded-2xl transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-gym-primary/60',
  {
    variants: {
      variant: {
        // White → gold on hover. The primary app CTA.
        primary: 'bg-white text-black shadow-xl hover:bg-gym-primary',
        // Solid gold. Secondary emphasis.
        accent: 'bg-gym-primary text-black shadow-lg hover:bg-yellow-400',
        // Gold-tinted outline, low emphasis.
        ghost: 'bg-gym-primary/10 border border-gym-primary/20 text-gym-primary hover:bg-gym-primary/20',
        // Destructive.
        danger: 'bg-gym-accent text-white shadow-lg hover:brightness-110',
      },
      size: {
        sm: 'py-2 px-4 text-[10px]',
        md: 'py-3 px-5 text-xs',
        lg: 'py-4 px-6 text-sm tracking-[0.2em]',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      block: false,
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(button({ variant, size, block }), className)}
      {...props}
    />
  )
);
Button.displayName = 'Button';
