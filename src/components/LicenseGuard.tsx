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
    deviceId
  } = useLicense();
  
  return (
    <>
      <Show when={isLoading()}>
        <div class="license-loading">
          <div class="spinner"></div>
          <p>Verificando licencia...</p>
        </div>
      </Show>
      
      <Show when={!isLoading() && !licenseValid()}>
        <div class="license-expired">
          <div class="license-card">
            <div class="license-icon">🔒</div>
            <h2>Acceso Restringido</h2>
            <p>{licenseMessage()}</p>
            
            <Show when={expiryDate()}>
              <div class="expiry-info">
                <span>Fecha de expiración:</span>
                <strong>{expiryDate()?.toLocaleDateString('es-ES')}</strong>
              </div>
            </Show>
            
            <div class="contact-info">
              <p>Si necesitas más tiempo, contacta al administrador:</p>
              <a href="mailto:bello.angel1505@gmail.com">bello.angel1505@gmail.com</a>
            </div>
            
            <button onClick={() => checkLicense()} class="retry-button">
              Reintentar
            </button>

            <Show when={deviceId()}>
                <p style="margin-top: 50px;">Dispositivo ID: {deviceId()}</p>
            </Show>

          </div>
        </div>
      </Show>
      
      <Show when={!isLoading() && licenseValid() === true}>
        {props.children}
      </Show>
    </>
  );
};