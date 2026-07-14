import { Card, Button, Badge } from '@ginx/design-system';

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: '#121212', padding: 24, width: 340 }}>{children}</div>
);

export const Basic = () => (
  <Frame>
    <Card>
      <h3 style={{ color: '#fff', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
        Pecho y tríceps
      </h3>
      <p style={{ color: '#e0e0e0', marginTop: 8, marginBottom: 0, fontSize: 14 }}>
        8 ejercicios · 45 min · Nivel intermedio
      </p>
    </Card>
  </Frame>
);

export const WorkoutStat = () => (
  <Frame>
    <Card elevated>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#e0e0e0', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.15em' }}>
          Racha
        </span>
        <Badge>12 días</Badge>
      </div>
      <div style={{ color: '#ffd700', fontWeight: 900, fontSize: 40, lineHeight: 1.1, marginTop: 8 }}>1.240</div>
      <div style={{ color: '#e0e0e0', fontSize: 12, marginTop: 4 }}>GX points esta semana</div>
    </Card>
  </Frame>
);

export const WithAction = () => (
  <Frame>
    <Card>
      <h3 style={{ color: '#fff', fontWeight: 900, margin: 0 }}>Nueva invitación</h3>
      <p style={{ color: '#e0e0e0', margin: '8px 0 16px', fontSize: 14 }}>
        Carlos quiere entrenar contigo hoy.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" block>
          Aceptar
        </Button>
        <Button size="sm" variant="ghost" block>
          Ahora no
        </Button>
      </div>
    </Card>
  </Frame>
);

export const Paddings = () => (
  <Frame>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card padding="sm">
        <span style={{ color: '#e0e0e0', fontSize: 13 }}>padding sm</span>
      </Card>
      <Card padding="lg">
        <span style={{ color: '#e0e0e0', fontSize: 13 }}>padding lg</span>
      </Card>
    </div>
  </Frame>
);
