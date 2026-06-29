// src/views/Editor/components/AutosavePanel.tsx
import { For, createSignal, Show } from "solid-js";
import { getAutosaveHistory, restoreAutosave, AutosaveData } from "../../../../core/autosave";
import { setNodes } from "../../../../models/nodes";
import { setConnections } from "../../../../models/connections";
import { updateCurrentProjectName, addCurrentProjectProperty } from "../../../../models/userStore";
import { nodusCanvas } from "../../../../core/NodusCanvas";
import styles from "./AutosavePanel.module.css";
import { isAutosavePanelOpen } from "../../Editor";

interface AutosavePanelProps {
    onClose: () => void;
}

export const AutosavePanel = (props: AutosavePanelProps) => {
    const [history, setHistory] = createSignal<AutosaveData[]>([]);
    const [selectedIndex, setSelectedIndex] = createSignal<number>(-1);
    
    // Cargar historial al abrir
    const loadHistory = () => {
        const saves = getAutosaveHistory();
        saves.sort((a, b) => b.timestamp - a.timestamp);
        setHistory(saves);
    };
    
    loadHistory();
    
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };
    
    const getAgeText = (timestamp: number) => {
        const minutes = Math.round((Date.now() - timestamp) / (1000 * 60));
        if (minutes < 60) return `hace ${minutes} min`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `hace ${hours} h`;
        const days = Math.round(hours / 24);
        return `hace ${days} días`;
    };
    
    const handleRestore = (autosave: AutosaveData) => {
        restoreAutosave(autosave, (data) => {
            setNodes(data.nodes);
            setConnections(data.connections);
            if (data.projectName) updateCurrentProjectName(data.projectName, false);
            Object.entries(data.projectProperties || {}).forEach(([key, value]) => {
                addCurrentProjectProperty(key, value);
            });
            if (data.cameraState) {
                nodusCanvas.camera.setZoom(data.cameraState.zoom);
                nodusCanvas.camera.setOffsetX(data.cameraState.offsetX);
                nodusCanvas.camera.setOffsetY(data.cameraState.offsetY);
            }
            nodusCanvas.requestRedraw();
            props.onClose();
        });
    };
    
    return (
        <Show when={isAutosavePanelOpen()}>
            <div class={styles.autosaveOverlay} onClick={props.onClose}>
                <div class={styles.autosavePanel} onClick={(e) => e.stopPropagation()}>
                    <div class={styles.autosaveHeader}>
                        <h3>Autoguardados</h3>
                        <button onClick={props.onClose} class={styles.closeBtn}>✕</button>
                    </div>
                    
                    <div class={styles.autosaveList}>
                        <Show when={history().length === 0}>
                            <div class={styles.emptyState}>
                                No hay autoguardados disponibles
                            </div>
                        </Show>
                        
                        <For each={history()}>
                            {(save, index) => (
                                <div 
                                    class={`${styles.autosaveItem} ${selectedIndex() === index() ? styles.selected : ""}`}
                                    onClick={() => setSelectedIndex(index())}
                                    onDblClick={() => handleRestore(save)}
                                >
                                    <div class={styles.autosaveInfo}>
                                        <span class={styles.autosaveDate}>
                                            {formatDate(save.timestamp)}
                                        </span>
                                        <span class={styles.autosaveAge}>
                                            {getAgeText(save.timestamp)}
                                        </span>
                                    </div>
                                    <div class={styles.autosaveStats}>
                                        <span>{save.nodes.length} nodos</span>
                                        <span>{save.connections.length} conexiones</span>
                                        <span>{save.projectName || "Sin nombre"}</span>
                                    </div>
                                    <button 
                                        class={styles.restoreBtn}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRestore(save);
                                        }}
                                    >
                                        Restaurar
                                    </button>
                                </div>
                            )}
                        </For>
                    </div>
                    
                    <div class={styles.autosaveFooter}>
                        <p>Los autoguardados se crean cada 10 minutos y al cerrar la app</p>
                        <p class={styles.hint}>Doble click para restaurar</p>
                    </div>
                </div>
            </div>
        </Show>
    );
};