// src/components/LicenseGuard.tsx
import { Component, JSX, Show } from 'solid-js';
import { useLicense } from '../services/license';
import "../index.css";

interface LicenseGuardProps {
  children: JSX.Element;
}

export const LicenseGuard: Component<LicenseGuardProps> = (props) => {
  const { 
    licenseValid, 
    licenseMessage, 
    expiryDate, 
    isLoading,
    checkLicense,
    deviceId,
    supportMail
  } = useLicense();

  // Leer versión desde Vite (o usar default)
  const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';

  // Icono SVG de candado (reemplaza 🔒)
  const LockIcon = () => (
    <svg class="license-icon" viewBox="0 0 24 24">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );

  return (
    <>
      {/* Estado de carga */}
      <Show when={isLoading()}>
        <div class="license-loading">
          <div class="spinner"></div>
          <p>Verifying license...</p>
        </div>
      </Show>
      
      {/* Licencia inválida / expirada */}
      <Show when={!isLoading() && !licenseValid()}>
        <div class="license-expired">
          <div class="license-card">
            <LockIcon />
            <h2>Access Restricted</h2>
            <p class="message">{licenseMessage()}</p>
            
            <Show when={expiryDate()}>
              <div class="expiry-info">
                <span>Expiration date:</span>
                <strong>{expiryDate()?.toLocaleDateString('en-US')}</strong>
              </div>
            </Show>
            
            <div class="contact-info">
              <p>If you need more time, contact the administrator:</p>
              <a href={`mailto:${supportMail}`}>{supportMail}</a>
            </div>
            
            <button onClick={() => checkLicense()} class="retry-button">
              Retry
            </button>

            <Show when={deviceId()}>
              <div class="device-id">Device ID: {deviceId()}</div>
            </Show>

            {/* Footer de la app */}
            <div class="app-footer">
              <span>Nodus Flow v{appVersion}</span>
              <span class="company"> | Bello's Projects</span>
            </div>
          </div>
        </div>
      </Show>
      
      {/* Licencia válida -> renderizar hijos */}
      <Show when={!isLoading() && licenseValid() === true}>
        {props.children}
      </Show>
    </>
  );
};