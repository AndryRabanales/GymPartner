import { Button } from '@ginx/design-system';

// GINX renders on a near-black app background — frame each story the way the app does.
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: '#121212', padding: 24, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
    {children}
  </div>
);

export const Primary = () => (
  <Frame>
    <Button>Empezar entrenamiento</Button>
  </Frame>
);

export const Variants = () => (
  <Frame>
    <Button variant="primary">Primary</Button>
    <Button variant="accent">Accent</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="danger">Salir</Button>
  </Frame>
);

export const Sizes = () => (
  <Frame>
    <Button size="sm">Small</Button>
    <Button size="md">Medium</Button>
    <Button size="lg">Large</Button>
  </Frame>
);

export const States = () => (
  <Frame>
    <Button>Activo</Button>
    <Button disabled>Deshabilitado</Button>
  </Frame>
);

export const FullWidth = () => (
  <div style={{ background: '#121212', padding: 24, width: 320 }}>
    <Button variant="accent" size="lg" block>
      Guardar rutina
    </Button>
  </div>
);
