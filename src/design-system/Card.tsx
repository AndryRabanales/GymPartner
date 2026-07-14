import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './lib/cn';

/**
 * GINX Card — the elevated dark surface (#1e1e1e) used across the app.
 */
const card = cva('bg-gym-card text-gym-text rounded-2xl', {
  variants: {
    padding: {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    },
    border: {
      true: 'border border-white/5',
      false: '',
    },
    elevated: {
      true: 'shadow-xl',
      false: '',
    },
  },
  defaultVariants: {
    padding: 'md',
    border: true,
    elevated: false,
  },
});

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof card> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding, border, elevated, ...props }, ref) => (
    <div ref={ref} className={cn(card({ padding, border, elevated }), className)} {...props} />
  )
);
Card.displayName = 'Card';
