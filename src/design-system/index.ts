/**
 * GINX Design System — reusable primitives extracted from the GINX app.
 * This barrel is the library entry point consumed by the lib build
 * (see vite.ds.config.ts, global name `GinxDS`).
 */
export { Button, type ButtonProps } from './Button';
export { Card, type CardProps } from './Card';
export { Input, type InputProps } from './Input';
export { Badge, type BadgeProps } from './Badge';
export { Modal, type ModalProps } from './Modal';
export { tokens, type Tokens } from './tokens';
export { cn } from './lib/cn';

import './ds.css';
