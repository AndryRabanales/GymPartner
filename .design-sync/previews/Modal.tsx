import { Modal, Button } from '@ginx/design-system';

// The Modal is a `fixed inset-0` overlay. In the preview mount an ancestor has
// `transform: translateZ(0)`, which would make `fixed` resolve against a tiny
// containing block and clip the card. Wrapping in a sized element that itself
// establishes a containing block (transform) lets the overlay center correctly.
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: 'relative', transform: 'translateZ(0)', width: 460, height: 340, background: '#121212' }}>
    {children}
  </div>
);

export const Open = () => (
  <Stage>
    <Modal open title="Salir del entrenamiento">
      <p style={{ color: '#e0e0e0', margin: '0 0 20px', fontSize: 14 }}>
        Perderás el progreso de esta sesión si sales ahora. ¿Seguro que quieres salir?
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ghost" block>
          Cancelar
        </Button>
        <Button variant="danger" block>
          Salir
        </Button>
      </div>
    </Modal>
  </Stage>
);

export const Confirmation = () => (
  <Stage>
    <Modal open title="Rutina guardada">
      <p style={{ color: '#e0e0e0', margin: '0 0 20px', fontSize: 14 }}>
        Tu rutina «Full body» está lista para compartir con tu gym partner.
      </p>
      <Button block>Entendido</Button>
    </Modal>
  </Stage>
);
