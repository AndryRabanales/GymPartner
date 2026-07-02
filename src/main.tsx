import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext';
import { Capacitor } from '@capacitor/core';

// Debug console on device — tap the floating button to open
if (Capacitor.isNativePlatform()) {
  import('eruda').then(({ default: eruda }) => eruda.init());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
