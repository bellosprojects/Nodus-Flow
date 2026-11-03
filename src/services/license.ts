// src/services/license.ts
import { Store } from '@tauri-apps/plugin-store';
import { createSignal, onMount } from 'solid-js';
import { setIsAppLoading, setLoadingAppMessage } from '../views/components/Transition';

const API_URL = "https://render-yqtz.onrender.com";

interface LicenseStatus {
    valid: boolean;
    message: string;
    expires_at?: string | null;
    days_left?: number | null;
    license_type?: 'finite' | 'unlimited';
    plan?: 'trial' | 'monthly' | 'annual' | 'unlimited' | 'custom';
    is_new?: boolean;
}

const supportMail = "bello.angel1505@gmail.com";

class LicenseService {
    private store: Store | null = null;
    private deviceId: string | null = null;
    
    async init() {
        // Inicializar store persistente
        this.store = await Store.load('license.json');
        
        // Obtener o generar device ID único
        let storedId = await this.store?.get<string>('device_id');
        
        if (!storedId) {
        // Generar ID único persistente
        storedId = this.generateDeviceId();
        await this.store?.set('device_id', storedId);
        await this.store?.save();
        }
        
        this.deviceId = storedId;
        console.log('Device ID:', this.deviceId);
    }
    
    private generateDeviceId(): string {
        // Generar ID único basado en timestamp + random + navegador info
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const navigation = performance?.navigation?.type ?? 'unknown';
        return `${timestamp}-${random}-${navigation}`;
    }
    
    async validate(): Promise<LicenseStatus> {
        if (!this.deviceId) {
        await this.init();
        }
        
        try {
        const response = await fetch(`${API_URL}/validate`, {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            },
            body: JSON.stringify({
            device_id: this.deviceId,
            app_version: 'preview'
            }),
        });

        console.log('License validation response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        // Guardar en cache local
        await this.store?.set('last_validation', {
            timestamp: Date.now(),
            valid: data.valid,
            expires_at: data.expires_at,
            days_left: data.days_left,
            license_type: data.license_type,
            plan: data.plan
        });
        await this.store?.save();
        
        return data;
        
        } catch (error) {
        console.error('Error validando licencia:', error);
        
        // Fallback: usar cache local si existe (máximo 24h)
        const cached = await this.store?.get<any>('last_validation');
        if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
            return {
            valid: cached.valid,
            message: 'Modo offline - usando última validación',
            expires_at: cached.expires_at,
            days_left: cached.days_left,
            license_type: cached.license_type,
            plan: cached.plan
            };
        }
        
        // Sin cache, denegar acceso
        return {
            valid: false,
            message: 'No se pudo validar la licencia. Verifica tu conexión a internet.'
        };
        }
    }
    
    async getDeviceId(): Promise<string | null> {
        if (!this.deviceId) {
        await this.init();
        }
        return this.deviceId;
    }
    }

//    Singleton
export const licenseService = new LicenseService();

// Hook para SolidJS
export function useLicense() {
    const [licenseValid, setLicenseValid] = createSignal<boolean | null>(null);
    const [licenseMessage, setLicenseMessage] = createSignal('');
    const [expiryDate, setExpiryDate] = createSignal<Date | null>(null);
    const [daysLeft, setDaysLeft] = createSignal<number | null>(null);
    const [licenseType, setLicenseType] = createSignal<'finite' | 'unlimited' | null>(null);
    const [isLoading, setIsLoading] = createSignal(true);
    const [deviceId, setDeviceId] = createSignal<string | null>(null);
    
    const checkLicense = async () => {
        setIsAppLoading(true);
        setLoadingAppMessage("Verificando licencia");
        setIsLoading(true);
        setExpiryDate(null);
        setDaysLeft(null);
        setLicenseType(null);
        
        try {
        await licenseService.init();
        const deviceIdValue = await licenseService.getDeviceId();
        setDeviceId(deviceIdValue);
        
        const status = await licenseService.validate();
        
        setLicenseValid(status.valid);
        setLicenseMessage(status.message);

        const type = status.license_type
            ?? (status.expires_at !== undefined && status.expires_at !== null ? 'finite' : null);
        setLicenseType(type);

        if (status.expires_at != null) {
            const expiry = new Date(status.expires_at);
            setExpiryDate(expiry);

            if (status.days_left != null) {
                setDaysLeft(status.days_left);
            } else {
                const days = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                setDaysLeft(days);
            }
        }
        
        return status.valid;
        
        } catch (error) {
        console.error('Error checking license:', error);
        setLicenseValid(false);
        setLicenseMessage('Error verificando licencia');
        return false;
        
        } finally {
        setIsLoading(false);
        setIsAppLoading(false);
        }
    };
    
    // Re-validar cada hora
    onMount(() => {
        checkLicense();
        const interval = setInterval(checkLicense, 60 * 60 * 1000);
        return () => clearInterval(interval);
    });
    
    return {
        licenseValid,
        licenseMessage,
        expiryDate,
        daysLeft,
        licenseType,
        isLoading,
        deviceId,
        checkLicense,
        supportMail
    };
}