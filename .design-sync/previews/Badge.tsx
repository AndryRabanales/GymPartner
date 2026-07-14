import { Badge } from '@ginx/design-system';

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: '#121212', padding: 24, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
    {children}
  </div>
);

export const Variants = () => (
  <Frame>
    <Badge variant="primary">Nuevo</Badge>
    <Badge variant="soft">Pro</Badge>
    <Badge variant="danger">Lleno</Badge>
    <Badge variant="neutral">Borrador</Badge>
  </Frame>
);

export const CountDots = () => (
  <Frame>
    <Badge size="dot">3</Badge>
    <Badge size="dot">9</Badge>
    <Badge size="dot" variant="danger">
      !
    </Badge>
  </Frame>
);

export const Sizes = () => (
  <Frame>
    <Badge size="sm">sm</Badge>
    <Badge size="md">md</Badge>
  </Frame>
);
