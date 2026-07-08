import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext';
import { Capacitor } from '@capacitor/core';

// Debug console on device — DEV builds only. Never ship the eruda inspector
// (full network/storage/console access) in production: it hands an attacker a
// ready-made tool to probe requests and local storage on any installed copy.
if (import.meta.env.DEV && Capacitor.isNativePlatform()) {
  import('eruda').then(({ default: eruda }) => eruda.init());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
