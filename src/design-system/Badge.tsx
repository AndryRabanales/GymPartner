import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './lib/cn';

/**
 * GINX Badge / Pill — small status and count markers.
 * The `dot` size renders the round gold count bubbles seen throughout the UI.
 */
const badge = cva(
  'inline-flex items-center justify-center font-black uppercase tracking-wider shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-gym-primary text-black',
        soft: 'bg-gym-primary/10 text-gym-primary border border-gym-primary/20',
        danger: 'bg-gym-accent text-white',
        neutral: 'bg-white/10 text-gym-text',
      },
      size: {
        dot: 'w-5 h-5 rounded-full text-[10px] leading-none',
        sm: 'px-2 py-0.5 rounded-full text-[10px]',
        md: 'px-3 py-1 rounded-full text-xs',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'sm',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => (
    <span ref={ref} className={cn(badge({ variant, size }), className)} {...props} />
  )
);
Badge.displayName = 'Badge';
