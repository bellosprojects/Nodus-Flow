// utils/commands.ts
import { nodusCanvas } from "../core/NodusCanvas";
import { connections } from "../models/connections";
import { nodes } from "../models/nodes";
import { addCurrentProjectProperty, updateCurrentProjectName, userData } from "../models/userStore";
import { 
    actionCreateNode, 
    actionDeleteSelectedNodes, 
    actionDeleteAllNodes, 
    actionDeleteAllConnections, 
    actionDeleteAllDisconnected,
    actionClearCanvas,
    actionConnectCompleteGraph,
    actionAddNodePropertyToSelected,
    actionDeleteNodePropertyFromSelected,
    actionSetConnectionProperty,
    actionDeleteConnectionProperty
} from "../core/actions";
import { showToast, ToastType } from "../models/toast";

export const createNodesFromCommand = (query?: string) => {
    const centerPoint = nodusCanvas.camera.getWorldCenter();
    actionCreateNode(centerPoint.x - 80, centerPoint.y - 40, query);
    showToast(`Nodo creado: ${query || "Sin nombre"}`, ToastType.SUCCES);
}

export const connectGraph = (query?: string) => {
    if (!query) return;

    if (query === "Complete") {
        actionConnectCompleteGraph();
        showToast("Grafo completo conectado", ToastType.SUCCES);
    }
}

export const deleteFromQuery = (query?: string) => {
    if (!query) return;

    switch (query) {
        case "Selected Nodes":
            actionDeleteSelectedNodes();
            showToast("Nodos seleccionados eliminados", ToastType.SUCCES);
            break;
        case "All Disconnected":
            actionDeleteAllDisconnected();
            showToast("Nodos desconectados eliminados", ToastType.SUCCES);
            break;
        case "All Connections":
            actionDeleteAllConnections();
            showToast("Todas las conexiones eliminadas", ToastType.SUCCES);
            break;
        case "All Nodes":
            actionDeleteAllNodes();
            showToast("Todos los nodos eliminados", ToastType.SUCCES);
            break;
        case "Clear Canvas":
            actionClearCanvas();
            showToast("Canvas limpiado", ToastType.SUCCES);
            break;
        default:
            const node = [...nodes].find(node => node.title === query);
            if (node) {
                actionDeleteSelectedNodes(); // Si está seleccionado
                // O podrías implementar actionDeleteNodeByName
            }
            break;
    }
}

export const addNodePropertyFromQuery = (query?: string) => {
    if (!query) return;

    const parts = query.trim().split(/\s+/);
    const propertyName = parts[0];
    const propertyValue = parts.slice(1).join(" ") || "true";

    actionAddNodePropertyToSelected(propertyName, propertyValue);
    showToast(`Propiedad "${propertyName}" agregada`, ToastType.SUCCES);
}

export const deleteNodePropertyFromQuery = (query?: string) => {
    if (!query) return;

    const propertyName = query.trim().split(/\s+/)[0];
    actionDeleteNodePropertyFromSelected(propertyName);
    showToast(`Propiedad "${propertyName}" eliminada`, ToastType.SUCCES);
}

export const addConnectionPropertyFromQuery = (query?: string) => {
    if (!query) return;

    const parts = query.trim().split(/\s+/);
    const fromNodeName = parts[0];
    const toNodeName = parts[1];
    const propertyName = parts[2];
    const propertyValue = parts.slice(3).join(" ") || "true";

    const fromNode = [...nodes].find(node => node.title === fromNodeName);
    const toNode = [...nodes].find(node => node.title === toNodeName);

    if (fromNode && toNode && propertyName) {
        const conn = connections.find(conn => 
            (conn.from === fromNode.id && conn.to === toNode.id) || 
            (conn.from === toNode.id && conn.to === fromNode.id)
        );
        if (conn) {
            actionSetConnectionProperty(conn.id, propertyName, propertyValue);
            showToast(`Propiedad de conexión "${propertyName}" agregada`, ToastType.SUCCES);
        } else {
            showToast("Conexión no encontrada", ToastType.ERROR);
        }
    } else {
        showToast("Nodos no encontrados", ToastType.ERROR);
    }
}

export const deleteConnectionPropertyFromQuery = (query?: string) => {
    if (!query) return;

    const parts = query.trim().split(/\s+/);
    const fromNodeName = parts[0];
    const toNodeName = parts[1];
    const propertyName = parts[2];

    const fromNode = [...nodes].find(node => node.title === fromNodeName);
    const toNode = [...nodes].find(node => node.title === toNodeName);

    if (fromNode && toNode && propertyName) {
        const conn = connections.find(conn => 
            (conn.from === fromNode.id && conn.to === toNode.id) || 
            (conn.from === toNode.id && conn.to === fromNode.id)
        );
        if (conn) {
            actionDeleteConnectionProperty(conn.id, propertyName);
            showToast(`Propiedad de conexión "${propertyName}" eliminada`, ToastType.SUCCES);
        } else {
            showToast("Conexión no encontrada", ToastType.ERROR);
        }
    } else {
        showToast("Nodos no encontrados", ToastType.ERROR);
    }
}

import { startTransaction, commitTransaction, pushAction } from "../core/history";
import { setNodes, Node } from "../models/nodes";
import { setConnections, Connection } from "../models/connections";
import { wsService } from "../core/socket";

export const importFromQuery = (_?: string) => {
    try {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const json = JSON.parse(event.target?.result as string);
                        
                        // Validar estructura del JSON
                        if (!json.nodes || !Array.isArray(json.nodes)) {
                            throw new Error("Invalid JSON structure: missing nodes array");
                        }
                        
                        // Validar límites
                        const totalNodes = nodes.length + json.nodes.length;
                        const maxNodes = 500;
                        if (totalNodes > maxNodes) {
                            showToast(`Cannot import: would exceed maximum of ${maxNodes} nodes (${totalNodes}/${maxNodes})`, ToastType.ERROR);
                            return;
                        }
                        
                        // INICIAR TRANSACCIÓN PARA TODO EL IMPORT
                        startTransaction(`Importar proyecto: ${json.name || "Untitled"}`);
                        
                        // Guardar snapshot del estado actual para posible undo
                        const oldNodes = [...nodes];
                        const oldConnections = [...connections];
                        const oldProjectName = userData.currentProjectName;
                        const oldProjectProperties = { ...userData.currentProjectProperties };
                        
                        // 1. Importar nodos
                        const importedNodes: Node[] = [];
                        const nodeIdMap: Map<string, string> = new Map(); // Mapa de IDs antiguos a nuevos
                        
                        for (const nodeData of json.nodes) {
                            // Generar nuevo ID para evitar colisiones
                            const newId = Math.random().toString(36).substring(6).toUpperCase();
                            const oldId = nodeData.id;
                            nodeIdMap.set(oldId, newId);
                            
                            const newNode: Node = {
                                id: newId,
                                x: nodeData.x || nodeData.x === 0 ? nodeData.x : 100,
                                y: nodeData.y || nodeData.y === 0 ? nodeData.y : 100,
                                width: nodeData.width || nodeData.w || 160,
                                height: nodeData.height || nodeData.h || 80,
                                color: nodeData.color || "#21a2a6",
                                opacity: nodeData.opacity || nodeData.opacidad || 1,
                                radius: nodeData.radius || 8,
                                lock: nodeData.lock || nodeData.pin || false,
                                title: nodeData.title || nodeData.texto || "",
                                style: nodeData.style || 1,
                                properties: nodeData.properties || {}
                            };
                            
                            // Asegurar dimensiones mínimas
                            newNode.width = Math.max(newNode.width, 60);
                            newNode.height = Math.max(newNode.height, 40);
                            
                            importedNodes.push(newNode);
                            
                            // Enviar al servidor
                            wsService.sendEvent({
                                tipo: "nuevo_nodo",
                                nodo: {
                                    id: newId,
                                    w: newNode.width,
                                    h: newNode.height,
                                    x: newNode.x,
                                    y: newNode.y,
                                    texto: newNode.title || "",
                                    color: newNode.color,
                                    opacidad: newNode.opacity,
                                    radius: newNode.radius,
                                    pin: newNode.lock,
                                    style: newNode.style,
                                    properties: newNode.properties
                                }
                            });
                        }
                        
                        // Agregar todos los nodos de una vez
                        setNodes([...nodes, ...importedNodes]);
                        
                        // 2. Importar conexiones (si existen)
                        const importedConnections: Connection[] = [];
                        const connectionsData = json.connections || json.conexiones || [];
                        
                        for (const connData of connectionsData) {
                            const oldFromId = connData.from || connData.origenId;
                            const oldToId = connData.to || connData.destinoId;
                            
                            const newFromId = nodeIdMap.get(oldFromId);
                            const newToId = nodeIdMap.get(oldToId);
                            
                            // Solo importar si ambos nodos existen
                            if (newFromId && newToId && newFromId !== newToId) {
                                const newId = Math.random().toString(36).substring(6);
                                
                                const newConn: Connection = {
                                    id: newId,
                                    from: newFromId,
                                    to: newToId,
                                    tipo: connData.tipo || connData.style || 1,
                                    properties: connData.properties || {}
                                };
                                
                                importedConnections.push(newConn);
                                
                                // Enviar al servidor
                                wsService.sendEvent({
                                    tipo: "crear_conexion",
                                    conexion: {
                                        id: newId,
                                        style: newConn.tipo,
                                        origenId: newFromId,
                                        destinoId: newToId,
                                        properties: newConn.properties
                                    }
                                });
                            }
                        }
                        
                        // Agregar todas las conexiones de una vez
                        if (importedConnections.length > 0) {
                            setConnections([...connections, ...importedConnections]);
                        }
                        
                        // 3. Importar nombre del proyecto
                        if (json.name) {
                            updateCurrentProjectName(json.name, true);
                        }
                        
                        // 4. Importar propiedades del proyecto
                        const projectProperties = json.properties || json.projectProperties || {};
                        for (const [key, value] of Object.entries(projectProperties)) {
                            addCurrentProjectProperty(key, value);
                        }
                        
                        // REGISTRAR ACCIÓN DE UNDO/REDO
                        pushAction({
                            label: `Importar proyecto: ${json.name || "Untitled"} (${importedNodes.length} nodos, ${importedConnections.length} conexiones)`,
                            undo: () => {
                                // Restaurar estado anterior
                                setNodes(oldNodes);
                                setConnections(oldConnections);
                                updateCurrentProjectName(oldProjectName, true);
                                // Restaurar propiedades del proyecto
                                for (const [key, value] of Object.entries(oldProjectProperties)) {
                                    addCurrentProjectProperty(key, value);
                                }
                                // Limpiar propiedades que no existían antes
                                for (const key of Object.keys(projectProperties)) {
                                    if (!(key in oldProjectProperties)) {
                                        addCurrentProjectProperty(key, undefined);
                                    }
                                }
                                nodusCanvas.requestRedraw();
                            },
                            redo: () => {
                                // Re-importar
                                setNodes([...oldNodes, ...importedNodes]);
                                setConnections([...oldConnections, ...importedConnections]);
                                updateCurrentProjectName(json.name || oldProjectName, true);
                                for (const [key, value] of Object.entries(projectProperties)) {
                                    addCurrentProjectProperty(key, value);
                                }
                                nodusCanvas.requestRedraw();
                                // Re-enviar al servidor los nodos y conexiones
                                importedNodes.forEach(node => {
                                    wsService.sendEvent({
                                        tipo: "nuevo_nodo",
                                        nodo: {
                                            id: node.id,
                                            w: node.width,
                                            h: node.height,
                                            x: node.x,
                                            y: node.y,
                                            texto: node.title || "",
                                            color: node.color,
                                            opacidad: node.opacity,
                                            radius: node.radius,
                                            pin: node.lock,
                                            style: node.style,
                                            properties: node.properties
                                        }
                                    });
                                });
                                importedConnections.forEach(conn => {
                                    wsService.sendEvent({
                                        tipo: "crear_conexion",
                                        conexion: {
                                            id: conn.id,
                                            style: conn.tipo,
                                            origenId: conn.from,
                                            destinoId: conn.to,
                                            properties: conn.properties
                                        }
                                    });
                                });
                            }
                        });
                        
                        // COMMIT DE LA TRANSACCIÓN
                        commitTransaction();
                        
                        // Invalidar caches de renderizado
                        nodusCanvas.requestRedraw();
                        
                        showToast(`Importado: ${importedNodes.length} nodos, ${importedConnections.length} conexiones`, ToastType.SUCCES);
                        
                    } catch (error) {
                        console.error("Error parsing JSON:", error);
                        showToast("Error al importar JSON: formato inválido", ToastType.ERROR);
                        // Rollback de la transacción en caso de error
                        import("../core/history").then(({ rollbackTransaction }) => rollbackTransaction());
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    } catch (error) {
        console.error("Import error:", error);
        showToast("Error al importar JSON", ToastType.ERROR);
    }
};

// Acciones adicionales para comandos
export const lockAllNodesFromCommand = () => {
    import("../core/actions").then(({ actionLockAllNodes }) => {
        actionLockAllNodes();
        showToast("Todos los nodos bloqueados", ToastType.SUCCES);
    });
}

export const unlockAllNodesFromCommand = () => {
    import("../core/actions").then(({ actionUnlockAllNodes }) => {
        actionUnlockAllNodes();
        showToast("Todos los nodos desbloqueados", ToastType.SUCCES);
    });
}

export const selectNoneFromCommand = () => {
    import("../core/actions").then(({ actionSelectNone }) => {
        actionSelectNone();
    });
}

export const selectAllFromCommand = () => {
    import("../core/actions").then(({ actionSelectAll }) => {
        actionSelectAll();
    });
}

export const invertSelectionFromCommand = () => {
    import("../core/actions").then(({ actionInvertSelection }) => {
        actionInvertSelection();
    });
}