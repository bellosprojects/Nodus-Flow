// src/core/autosave.ts
import { nodes, Node } from "../models/nodes";
import { connections, Connection } from "../models/connections";
import { userData } from "../models/userStore";
import { showToast, ToastType } from "../models/toast";

export interface AutosaveData {
    version: string;
    timestamp: number;
    roomId: string;
    projectName: string;
    nodes: Node[];
    connections: Connection[];
    projectProperties: Record<string, any>;
    cameraState?: {
        zoom: number;
        offsetX: number;
        offsetY: number;
    };
}

const AUTOSAVE_KEY_PREFIX = "nodus_autosave_";
const AUTOSAVE_INTERVAL = 10 * 60 * 1000; // 10 minutos
const MAX_AUTOSAVES = 5; // Mantener hasta 5 autoguardados por sala

let autosaveTimer: number | null = null;

// Obtener clave de storage para una sala
const getStorageKey = (roomId: string) => `${AUTOSAVE_KEY_PREFIX}${roomId}`;

// Obtener todas las claves de autoguardado
const getAllAutosaveKeys = (): string[] => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(AUTOSAVE_KEY_PREFIX)) {
            keys.push(key);
        }
    }
    return keys;
};

// Guardar autoguardado actual
export const saveAutosave = (cameraState?: { zoom: number; offsetX: number; offsetY: number }): void => {
    try {
        const autosaveData: AutosaveData = {
            version: "1.0",
            timestamp: Date.now(),
            roomId: userData.roomId,
            projectName: userData.currentProjectName,
            nodes: JSON.parse(JSON.stringify(nodes)), // Deep clone
            connections: JSON.parse(JSON.stringify(connections)),
            projectProperties: { ...userData.currentProjectProperties },
            cameraState
        };

        const key = getStorageKey(userData.roomId);
        
        // Obtener autoguardados existentes
        const existing = getAutosaveHistory();
        
        // Agregar nuevo y mantener límite
        const updated = [autosaveData, ...existing.filter(s => s.roomId !== userData.roomId)];
        
        // Limitar por sala específica
        const roomSaves = updated.filter(s => s.roomId === userData.roomId);
        if (roomSaves.length > MAX_AUTOSAVES) {
            // Mantener solo los más recientes
            const keepIds = new Set(roomSaves.slice(0, MAX_AUTOSAVES).map(s => s.timestamp));
            const filtered = updated.filter(s => s.roomId !== userData.roomId || keepIds.has(s.timestamp));
            localStorage.setItem(key, JSON.stringify(filtered));
        } else {
            localStorage.setItem(key, JSON.stringify(updated));
        }
        
        console.log(`💾 Autoguardado completado: ${new Date().toLocaleTimeString()}`);
    } catch (error) {
        console.error("Error guardando autoguardado:", error);
    }
};

// Obtener historial de autoguardados para la sala actual
export const getAutosaveHistory = (): AutosaveData[] => {
    try {
        const key = getStorageKey(userData.roomId);
        const data = localStorage.getItem(key);
        if (!data) return [];
        
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
        console.error("Error leyendo autoguardados:", error);
        return [];
    }
};

// Obtener el autoguardado más reciente
export const getLatestAutosave = (): AutosaveData | null => {
    const history = getAutosaveHistory();
    if (history.length === 0) return null;
    
    // Ordenar por timestamp descendente
    history.sort((a, b) => b.timestamp - a.timestamp);
    return history[0];
};

// Restaurar un autoguardado específico
export const restoreAutosave = async (autosave: AutosaveData, onRestore: (data: AutosaveData) => void): Promise<boolean> => {
    try {
        // Verificar que sea para la sala correcta
        if (autosave.roomId !== userData.roomId) {
            showToast("Este autoguardado pertenece a otra sala", ToastType.ERROR);
            return false;
        }
        
        // Verificar antigüedad (más de 24 horas = advertencia)
        const ageHours = (Date.now() - autosave.timestamp) / (1000 * 60 * 60);
        if (ageHours > 24) {
            const confirm = window.confirm(
                `Este autoguardado tiene ${ageHours.toFixed(1)} horas de antigüedad.\n` +
                `¿Seguro que quieres restaurarlo? Podrías perder cambios más recientes.`
            );
            if (!confirm) return false;
        }
        
        onRestore(autosave);
        showToast(`Restaurado desde ${new Date(autosave.timestamp).toLocaleString()}`, ToastType.SUCCES);
        return true;
        
    } catch (error) {
        console.error("Error restaurando autoguardado:", error);
        showToast("Error al restaurar autoguardado", ToastType.ERROR);
        return false;
    }
};

// Limpiar autoguardados viejos (más de 7 días)
export const cleanOldAutosaves = (): void => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const keys = getAllAutosaveKeys();
    
    keys.forEach(key => {
        try {
            const data = localStorage.getItem(key);
            if (!data) return;
            
            const saves: AutosaveData[] = JSON.parse(data);
            const filtered = saves.filter(save => save.timestamp > oneWeekAgo);
            
            if (filtered.length === 0) {
                localStorage.removeItem(key);
            } else if (filtered.length !== saves.length) {
                localStorage.setItem(key, JSON.stringify(filtered));
            }
        } catch (error) {
            console.error(`Error limpiando autoguardado ${key}:`, error);
        }
    });
};

// Iniciar autoguardado periódico
export const startAutosaveTimer = (getCameraState: () => { zoom: number; offsetX: number; offsetY: number }): void => {
    if (autosaveTimer) {
        clearInterval(autosaveTimer);
    }
    
    autosaveTimer = window.setInterval(() => {
        saveAutosave(getCameraState());
        showToast("Autoguardado completado", ToastType.INFO);
    }, AUTOSAVE_INTERVAL);
};

// Detener autoguardado periódico
export const stopAutosaveTimer = (): void => {
    if (autosaveTimer) {
        clearInterval(autosaveTimer);
        autosaveTimer = null;
    }
};

// Guardar al cerrar (se llama antes de destroy)
export const saveOnClose = (getCameraState: () => { zoom: number; offsetX: number; offsetY: number }): void => {
    saveAutosave(getCameraState());
    console.log("Autoguardado al cerrar completado");
};