import { type HTMLAttributes, type ReactNode, useEffect } from 'react';
import { cn } from './lib/cn';

/**
 * GINX Modal — the base overlay shell shared by the app's many dialogs
 * (Referral, Location, Coop, ForceExit…). Renders a dimmed backdrop and a
 * centered dark card. Closing on backdrop click / Escape is opt-in via onClose.
 */
export interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  open: boolean;
  onClose?: () => void;
  /** Dismiss when the backdrop is clicked. Defaults to true when onClose is set. */
  dismissOnBackdrop?: boolean;
  title?: ReactNode;
  children?: ReactNode;
}

export function Modal({
  open,
  onClose,
  dismissOnBackdrop,
  title,
  children,
  className,
  ...props
}: ModalProps) {
  const canDismiss = dismissOnBackdrop ?? Boolean(onClose);

  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={canDismiss ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-w-md bg-gym-card text-gym-text rounded-2xl shadow-2xl',
          'border border-white/10 p-6',
          className
        )}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {title && (
          <h2 className="mb-4 text-lg font-black uppercase tracking-wider text-white">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}
Modal.displayName = 'Modal';
