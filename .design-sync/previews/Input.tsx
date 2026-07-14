import { Input } from '@ginx/design-system';

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: '#121212', padding: 24, width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
    {children}
  </div>
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <span style={{ color: '#e0e0e0', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em' }}>{children}</span>
);

export const Default = () => (
  <Frame>
    <Label>Nombre de la rutina</Label>
    <Input placeholder="Ej. Full body lunes" />
  </Frame>
);

export const Filled = () => (
  <Frame>
    <Label>Email</Label>
    <Input defaultValue="atleta@ginx.app" />
  </Frame>
);

export const Invalid = () => (
  <Frame>
    <Label>Peso (kg)</Label>
    <Input invalid defaultValue="-5" />
    <span style={{ color: '#ff4d4d', fontSize: 12 }}>Introduce un valor válido</span>
  </Frame>
);

export const Disabled = () => (
  <Frame>
    <Label>Código de invitación</Label>
    <Input disabled defaultValue="GINX-2026" />
  </Frame>
);
