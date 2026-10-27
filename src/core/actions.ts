// core/actions.ts
import { startTransaction, commitTransaction, pushAction } from "./history";

import { 
    nodes, 
    setNodes,
    selectedNodesIds, 
    setSelectedNodesIds,
    addNode, 
    deleteNode, 
    updateNodePosition, 
    updateNodeSize, 
    updateNodeColor, 
    updateNodeOpacity,
    updateNodeRadius,
    updateNodoTitle,
    changeNodeStyle,
    lockNode,
    unLockNode,
    moveToFront,
    moveToBack,
    addNodeProperty,
    deleteNodeProperty,
    updateNodoAbsolutePosition,
    updateHeightFromText,
    Node,
    selectedNodes,
    finalizeNodeSize,
    finalizeNodePosition
} from "../models/nodes";

import { 
    connections, 
    setConnections,
    addConnection, 
    deleteConnection, 
    changeConnectionStyle, 
    addConnectionProperty, 
    deleteConnectionProperty,
    areConnected,
    Connection
} from "../models/connections";

import { updateCurrentProjectName, addCurrentProjectProperty, deleteCurrentProjectProperty } from "../models/userStore";
import { wsService } from "./socket";
import { generarUUID } from "../utils/math";
import { nodusCanvas } from "./NodusCanvas";

let nodeClipboard: Node[] = [];
let connectionClipboard: Connection[] = [];
let pasteQueue: Promise<void> = Promise.resolve();
const PASTE_CAMERA_SHIFT = 40;
const PASTE_CAMERA_ANIMATION_DURATION = 240;

const getSelectedNodeContent = () => {
    const targets = [...selectedNodes()];
    const targetIds = new Set(targets.map(node => node.id));
    const selectedConnections = connections
        .filter(connection => targetIds.has(connection.from) && targetIds.has(connection.to))
        .map(connection => ({...connection, properties: {...connection.properties}}));

    return {
        nodes: targets.map(node => ({...node, properties: {...node.properties}})),
        connections: selectedConnections
    };
};

const sendNewNodeEvent = (node: Node) => {
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
};

const sendNewConnectionEvent = (connection: Connection) => {
    wsService.sendEvent({
        tipo: "crear_conexion",
        conexion: {
            id: connection.id,
            style: connection.tipo,
            origenId: connection.from,
            destinoId: connection.to,
            properties: connection.properties
        }
    });
};

const createNodeClones = (
    sourceNodes: Node[],
    sourceConnections: Connection[],
    offset: {x: number, y: number},
    label: string
) => {
    if(sourceNodes.length === 0) return;

    const idMap = new Map(sourceNodes.map(node => [node.id, generarUUID()]));
    const clonedNodes = sourceNodes.map(node => ({
        ...node,
        id: idMap.get(node.id)!,
        x: node.x + offset.x,
        y: node.y + offset.y,
        properties: {...node.properties}
    }));
    const clonedConnections = sourceConnections.map(connection => ({
        ...connection,
        id: generarUUID(),
        from: idMap.get(connection.from)!,
        to: idMap.get(connection.to)!,
        properties: {...connection.properties}
    }));

    setNodes(previous => [...previous, ...clonedNodes]);
    clonedNodes.forEach(sendNewNodeEvent);
    setConnections(previous => [...previous, ...clonedConnections]);
    clonedConnections.forEach(sendNewConnectionEvent);
    setSelectedNodesIds(clonedNodes.map(node => node.id));

    pushAction({
        label,
        undo: () => {
            clonedConnections.forEach(connection => deleteConnection(connection.id, true));
            clonedNodes.forEach(node => deleteNode(node.id, true));
        },
        redo: () => {
            setNodes(previous => [...previous, ...clonedNodes]);
            clonedNodes.forEach(sendNewNodeEvent);
            setConnections(previous => [...previous, ...clonedConnections]);
            clonedConnections.forEach(sendNewConnectionEvent);
            setSelectedNodesIds(clonedNodes.map(node => node.id));
        }
    });
};

// ==========================================
// 1. ACCIONES DE NODOS (CREACIÓN Y BORRADO)
// ==========================================

export const actionCreateNode = (x: number, y: number, title?: string, width = 160, height = 80): Node | null => {
    const newNode = addNode(x, y, title, width, height);
    if (!newNode) return null;

    pushAction({
        label: `Crear nodo: ${title || newNode.id}`,
        undo: () => deleteNode(newNode.id, true),
        redo: () => {
            setNodes(prev => [...prev, newNode]);
            wsService.sendEvent({
                tipo: "nuevo_nodo",
                nodo: {
                    id: newNode.id,
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
    });
    return newNode;
};

export const actionDeleteNode = (id: string) => {
    const nodeSnapshot = nodes.find(n => n.id === id);
    if (!nodeSnapshot) return;
    
    const connsToDelete = connections.filter(c => c.from === id || c.to === id);
    
    connsToDelete.forEach(conn => deleteConnection(conn.id, true));
    deleteNode(id, true);

    pushAction({
        label: `Eliminar nodo: ${nodeSnapshot.title || id}`,
        undo: () => {
            setNodes(prev => [...prev, nodeSnapshot]);
            wsService.sendEvent({
                tipo: "nuevo_nodo",
                nodo: {
                    id: nodeSnapshot.id,
                    w: nodeSnapshot.width,
                    h: nodeSnapshot.height,
                    x: nodeSnapshot.x,
                    y: nodeSnapshot.y,
                    texto: nodeSnapshot.title || "",
                    color: nodeSnapshot.color,
                    opacidad: nodeSnapshot.opacity,
                    radius: nodeSnapshot.radius,
                    pin: nodeSnapshot.lock,
                    style: nodeSnapshot.style,
                    properties: nodeSnapshot.properties
                }
            });
            connsToDelete.forEach(conn => {
                setConnections(prev => [...prev, conn]);
                wsService.sendEvent({
                    tipo: 'crear_conexion',
                    conexion: {
                        id: conn.id,
                        style: conn.tipo,
                        origenId: conn.from,
                        destinoId: conn.to,
                        properties: conn.properties
                    }
                });
            });
        },
        redo: () => {
            connsToDelete.forEach(conn => deleteConnection(conn.id, true));
            deleteNode(id, true);
        }
    });
};

export const actionDeleteSelectedNodes = () => {
    const idsSnapshot = [...selectedNodesIds()];
    if (idsSnapshot.length === 0) return;

    startTransaction(`Eliminar ${idsSnapshot.length} elementos`);

    const nodesToRestore = nodes.filter(n => idsSnapshot.includes(n.id));
    const connsToRestore = connections.filter(c => idsSnapshot.includes(c.from) || idsSnapshot.includes(c.to));

    connsToRestore.forEach(conn => deleteConnection(conn.id, true));
    idsSnapshot.forEach(id => deleteNode(id, true));

    pushAction({
        label: `Eliminar lote de nodos`,
        undo: () => {
            nodesToRestore.forEach(node => {
                setNodes(prev => [...prev, node]);
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
            connsToRestore.forEach(conn => {
                setConnections(prev => [...prev, conn]);
                wsService.sendEvent({
                    tipo: 'crear_conexion',
                    conexion: {
                        id: conn.id,
                        style: conn.tipo,
                        origenId: conn.from,
                        destinoId: conn.to,
                        properties: conn.properties
                    }
                });
            });
        },
        redo: () => {
            connsToRestore.forEach(conn => deleteConnection(conn.id, true));
            idsSnapshot.forEach(id => deleteNode(id, true));
        }
    });

    commitTransaction();
    setSelectedNodesIds([]);
};

export const actionDeleteAllNodes = () => {
    const nodesSnapshot = [...nodes];
    const connsSnapshot = [...connections];
    
    startTransaction("Eliminar todos los nodos");
    
    nodes.forEach(node => deleteNode(node.id, true));
    
    pushAction({
        label: "Eliminar todos los nodos",
        undo: () => {
            nodesSnapshot.forEach(node => {
                setNodes(prev => [...prev, node]);
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
            connsSnapshot.forEach(conn => {
                setConnections(prev => [...prev, conn]);
                wsService.sendEvent({
                    tipo: 'crear_conexion',
                    conexion: {
                        id: conn.id,
                        style: conn.tipo,
                        origenId: conn.from,
                        destinoId: conn.to,
                        properties: conn.properties
                    }
                });
            });
        },
        redo: () => {
            nodesSnapshot.forEach(node => deleteNode(node.id, true));
        }
    });
    
    commitTransaction();
};

export const actionDeleteAllConnections = () => {
    const connsSnapshot = [...connections];
    
    startTransaction("Eliminar todas las conexiones");
    
    connections.forEach(conn => deleteConnection(conn.id, true));
    
    pushAction({
        label: "Eliminar todas las conexiones",
        undo: () => {
            connsSnapshot.forEach(conn => {
                setConnections(prev => [...prev, conn]);
                wsService.sendEvent({
                    tipo: 'crear_conexion',
                    conexion: {
                        id: conn.id,
                        style: conn.tipo,
                        origenId: conn.from,
                        destinoId: conn.to,
                        properties: conn.properties
                    }
                });
            })
        },
        redo: () => {
            connsSnapshot.forEach(conn => deleteConnection(conn.id, true));
        }
    });
    
    commitTransaction();
};

export const actionDeleteAllDisconnected = () => {
    const disconnectedNodes = nodes.filter(node => connectionsByNode(node.id).length === 0);
    
    if (disconnectedNodes.length === 0) return;
    
    startTransaction("Eliminar nodos desconectados");
    
    disconnectedNodes.forEach(node => deleteNode(node.id, true));
    
    pushAction({
        label: "Eliminar nodos desconectados",
        undo: () => {
            disconnectedNodes.forEach(node => {
                setNodes(prev => [...prev, node]);
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
            })
        },
        redo: () => {
            disconnectedNodes.forEach(node => deleteNode(node.id, true));
        }
    });
    
    commitTransaction();
};

export const actionClearCanvas = () => {
    const nodesSnapshot = [...nodes];
    const connsSnapshot = [...connections];
    
    startTransaction("Limpiar canvas");
    
    nodes.forEach(node => deleteNode(node.id, true));
    
    pushAction({
        label: "Limpiar canvas",
        undo: () => {
            nodesSnapshot.forEach(node => {
                setNodes(prev => [...prev, node]);
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
            connsSnapshot.forEach(conn => {
                setConnections(prev => [...prev, conn]);
                wsService.sendEvent({
                    tipo: 'crear_conexion',
                    conexion: {
                        id: conn.id,
                        style: conn.tipo,
                        origenId: conn.from,
                        destinoId: conn.to,
                        properties: conn.properties
                    }
                });
            });
        },
        redo: () => {
            nodesSnapshot.forEach(node => deleteNode(node.id, true));
        }
    });
    
    commitTransaction();
};

export const actionBulkCopy = () => {
    actionDuplicateSelectedNodes();
};

export const actionCopySelectedNodes = () => {
    const content = getSelectedNodeContent();
    if(content.nodes.length === 0) return;

    nodeClipboard = content.nodes;
    connectionClipboard = content.connections;
};

export const actionCutSelectedNodes = () => {
    if(selectedNodesIds().length === 0) return;
    actionCopySelectedNodes();
    actionDeleteSelectedNodes();
};

export const actionPasteNodes = () => {
    if(nodeClipboard.length === 0) return;

    const nodesToPaste = nodeClipboard.map(node => ({...node, properties: {...node.properties}}));
    const connectionsToPaste = connectionClipboard.map(connection => ({...connection, properties: {...connection.properties}}));

    pasteQueue = pasteQueue.then(async () => {
        const zoom = nodusCanvas.camera.zoom();
        await nodusCanvas.camera.animateTo(
            nodusCanvas.camera.offsetX() - PASTE_CAMERA_SHIFT,
            nodusCanvas.camera.offsetY() - PASTE_CAMERA_SHIFT,
            zoom,
            PASTE_CAMERA_ANIMATION_DURATION
        );

        const minX = Math.min(...nodesToPaste.map(node => node.x));
        const minY = Math.min(...nodesToPaste.map(node => node.y));
        const maxX = Math.max(...nodesToPaste.map(node => node.x + node.width));
        const maxY = Math.max(...nodesToPaste.map(node => node.y + node.height));
        const center = nodusCanvas.camera.getWorldCenter();

        createNodeClones(
            nodesToPaste,
            connectionsToPaste,
            {
                x: center.x - (minX + maxX) / 2,
                y: center.y - (minY + maxY) / 2
            },
            `Pegar ${nodesToPaste.length} nodos`
        );
    });
};

export const actionDuplicateSelectedNodes = () => {
    const content = getSelectedNodeContent();
    if(content.nodes.length === 0) return;

    createNodeClones(
        content.nodes,
        content.connections,
        {x: 20, y: 20},
        `Duplicar ${content.nodes.length} nodos`
    );
};

export const actionBulkFitHeight = () => {
    const targets = [...selectedNodes()];
    if (targets.length === 0) return;
    
    startTransaction(`Ajustar altura de ${targets.length} nodos`);
    
    const oldHeights = targets.map(node => ({ id: node.id, height: node.height }));
    
    targets.forEach(node => updateHeightFromText(node.id));
    
    pushAction({
        label: "Ajustar altura de nodos",
        undo: () => {
            oldHeights.forEach(({ id, height }) => {
                const node = nodes.find(n => n.id === id);
                if (node) {
                    updateNodeSize(id, node.width, height);
                    finalizeNodeSize(id);
                }
            });
        },
        redo: () => {
            targets.forEach(node => updateHeightFromText(node.id));
        }
    });
    
    commitTransaction();
};

export const actionBulkToFront = () => {
    const targets = [...selectedNodes()];
    if (targets.length === 0) return;
        
    targets.forEach(node => moveToFront(node.id, true));
    
    pushAction({
        label: "Traer al frente lote",
        undo: () => {
            targets.forEach(node => moveToBack(node.id, true));
        },
        redo: () => {
            targets.forEach(node => moveToFront(node.id, true));
        }
    });
};

export const actionBulkToBack = () => {
    const targets = [...selectedNodes()];
    if (targets.length === 0) return;
        
    targets.forEach(node => moveToBack(node.id, true));
    
    pushAction({
        label: "Enviar al fondo lote",
        undo: () => {
            targets.forEach(node => moveToFront(node.id, true));
        },
        redo: () => {
            targets.forEach(node => moveToBack(node.id, true));
        }
    });
};

// ==========================================
// 2. ACCIONES DE TRANSFORMACIÓN Y APARIENCIA
// ==========================================

export const actionFinalizeNodePosition = (id: string, oldX: number, oldY: number, newX: number, newY: number) => {
    if (oldX === newX && oldY === newY) return;
    
    pushAction({
        label: `Mover nodo`,
        undo: () => {
            updateNodePosition(id, oldX - newX, oldY - newY);
            finalizeNodePosition(id);
        },
        redo: () => {
            updateNodePosition(id, newX - oldX, newY - oldY);
            finalizeNodePosition(id);
        }
    });
};

export const actionUpdateNodeTitle = (id: string, oldTitle: string, newTitle: string, oldHeight?: number) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;

    const previousHeight = oldHeight ?? node.height;
    const updatedHeight = node.height;
    if (oldTitle === newTitle && previousHeight === updatedHeight) return;

    updateNodoTitle(id, newTitle);
    if(previousHeight !== updatedHeight){
        finalizeNodeSize(id);
    }
    const finalHeight = nodes.find(n => n.id === id)?.height ?? updatedHeight;

    pushAction({
        label: `Editar contenido de nodo`,
        undo: () => {
            updateNodoTitle(id, oldTitle);
            if(finalHeight !== previousHeight){
                updateNodeSize(id, node.width, previousHeight);
                finalizeNodeSize(id);
            }
        },
        redo: () => {
            updateNodoTitle(id, newTitle);
            if(finalHeight !== previousHeight){
                updateNodeSize(id, node.width, finalHeight);
                finalizeNodeSize(id);
            }
        }
    });
};

export const actionUpdateNodeColor = (id: string, oldColor: string, newColor: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node || oldColor === newColor) return;

    updateNodeColor(id, newColor);

    pushAction({
        label: `Cambiar color de nodo`,
        undo: () => updateNodeColor(id, oldColor),
        redo: () => updateNodeColor(id, newColor)
    });
};

export const actionUpdateNodeOpacity = (id: string, oldOpacity: number, newOpacity: number) => {
    const node = nodes.find(n => n.id === id);
    if (!node || oldOpacity === newOpacity) return;

    updateNodeOpacity(id, newOpacity);

    pushAction({
        label: `Cambiar opacidad`,
        undo: () => updateNodeOpacity(id, oldOpacity),
        redo: () => updateNodeOpacity(id, newOpacity)
    });
};

export const actionUpdateNodeRadius = (id: string, oldRadius: number, newRadius: number) => {
    const node = nodes.find(n => n.id === id);
    if (!node || oldRadius === newRadius) return;

    updateNodeRadius(id, newRadius);

    pushAction({
        label: `Cambiar radio de nodo`,
        undo: () => updateNodeRadius(id, oldRadius),
        redo: () => updateNodeRadius(id, newRadius)
    });
};

export const actionChangeNodeStyle = (id: string, oldStyle: number, newStyle: number) => {
    const node = nodes.find(n => n.id === id);
    if (!node || oldStyle === newStyle) return;

    changeNodeStyle(id, newStyle);

    pushAction({
        label: `Cambiar estilo de nodo`,
        undo: () => changeNodeStyle(id, oldStyle),
        redo: () => changeNodeStyle(id, newStyle)
    });
};


// ==========================================
// 3. ACCIONES DE ORDENAMIENTO Y BLOQUEOS
// ==========================================

export const actionToggleLockNodes = (ids: string[], lock: boolean) => {
    if (ids.length === 0) return;
    
    const snapshots = ids.map(id => {
        const node = nodes.find(n => n.id === id);
        return node ? { id, wasLocked: node.lock } : null;
    }).filter(Boolean);
    
    startTransaction(lock ? "Bloquear elementos" : "Desbloquear elementos");

    ids.forEach(id => {
        if (lock) lockNode(id, true);
        else unLockNode(id, true);
    });

    pushAction({
        label: lock ? "Bloquear" : "Desbloquear",
        undo: () => {
            snapshots.forEach(s => {
                if (s) {
                    if (s.wasLocked) lockNode(s.id, true);
                    else unLockNode(s.id, true);
                }
            });
        },
        redo: () => {
            ids.forEach(id => {
                if (lock) lockNode(id, true);
                else unLockNode(id, true);
            });
        }
    });

    commitTransaction();
};

export const actionLockAllNodes = () => {
    const snapshots = nodes.map(node => ({ id: node.id, wasLocked: node.lock }));
    
    startTransaction("Bloquear todos los nodos");
    
    nodes.forEach(node => lockNode(node.id, true));
    
    pushAction({
        label: "Bloquear todos los nodos",
        undo: () => {
            snapshots.forEach(s => {
                if (s.wasLocked) lockNode(s.id, true);
                else unLockNode(s.id, true);
            });
        },
        redo: () => {
            nodes.forEach(node => lockNode(node.id, true));
        }
    });
    
    commitTransaction();
};

export const actionUnlockAllNodes = () => {
    const snapshots = nodes.map(node => ({ id: node.id, wasLocked: node.lock }));
    
    startTransaction("Desbloquear todos los nodos");
    
    nodes.forEach(node => unLockNode(node.id, true));
    
    pushAction({
        label: "Desbloquear todos los nodos",
        undo: () => {
            snapshots.forEach(s => {
                if (s.wasLocked) lockNode(s.id, true);
                else unLockNode(s.id, true);
            });
        },
        redo: () => {
            nodes.forEach(node => unLockNode(node.id, true));
        }
    });
    
    commitTransaction();
};


// ==========================================
// 4. ACCIONES DE SELECCIÓN
// ==========================================

export const actionSelectNone = () => {
    const oldSelection = [...selectedNodesIds()];
    setSelectedNodesIds([]);
    
    pushAction({
        label: "Deseleccionar todo",
        undo: () => setSelectedNodesIds(oldSelection),
        redo: () => setSelectedNodesIds([])
    });
};

export const actionSelectAll = () => {
    const oldSelection = [...selectedNodesIds()];
    const allIds = nodes.map(n => n.id);
    setSelectedNodesIds(allIds);
    
    pushAction({
        label: "Seleccionar todo",
        undo: () => setSelectedNodesIds(oldSelection),
        redo: () => setSelectedNodesIds(allIds)
    });
};

export const actionInvertSelection = () => {
    const oldSelection = [...selectedNodesIds()];
    const allIds = nodes.map(n => n.id);
    const invertedIds = allIds.filter(id => !oldSelection.includes(id));
    setSelectedNodesIds(invertedIds);
    
    pushAction({
        label: "Invertir selección",
        undo: () => setSelectedNodesIds(oldSelection),
        redo: () => setSelectedNodesIds(invertedIds)
    });
};

export const actionSelectUnconnected = () => {
    const oldSelection = [...selectedNodesIds()];
    const allIds = nodes.map(n => n.id);
    const unconnectedIds = allIds.filter(node => connectionsByNode(node).length === 0);
    setSelectedNodesIds(unconnectedIds);
    
    pushAction({
        label: "Seleccionar nodos sin conexiones",
        undo: () => setSelectedNodesIds(oldSelection),
        redo: () => setSelectedNodesIds(unconnectedIds)
    });
};


// ==========================================
// 5. ACCIONES DE CONEXIONES
// ==========================================

const connectionsByNode = (nodeId: string) => {
    return connections.filter(conn => conn.from === nodeId || conn.to === nodeId);
};

export const actionCreateConnection = (fromId: string, toId: string): Connection | null => {
    if (fromId === toId || areConnected(fromId, toId)) return null;

    const newConn = addConnection(fromId, toId);
    const connInstance = newConn || connections.find(c => c.from === fromId && c.to === toId);
    if (!connInstance) return null;

    pushAction({
        label: `Conectar nodos`,
        undo: () => deleteConnection(connInstance.id, true),
        redo: () => {
            setConnections(prev => [...prev, connInstance]);
            wsService.sendEvent({
                tipo: 'crear_conexion',
                conexion: {
                    id: connInstance.id,
                    style: connInstance.tipo,
                    origenId: connInstance.from,
                    destinoId: connInstance.to,
                    properties: connInstance.properties
                }
            });
        }
    });

    return connInstance;
};

export const actionDeleteConnection = (id: string) => {
    const connSnapshot = connections.find(c => c.id === id);
    if (!connSnapshot) return;

    deleteConnection(id, true);

    pushAction({
        label: `Eliminar conexión`,
        undo: () => {
            setConnections(prev => [...prev, connSnapshot]);
            wsService.sendEvent({
                tipo: 'crear_conexion',
                conexion: {
                    id: connSnapshot.id,
                    style: connSnapshot.tipo,
                    origenId: connSnapshot.from,
                    destinoId: connSnapshot.to,
                    properties: connSnapshot.properties
                }
            });
        },
        redo: () => {
            deleteConnection(id, true);
        }
    });
};

export const actionChangeConnectionStyle = (id: string, newStyle: number) => {
    const conn = connections.find(c => c.id === id);
    if (!conn || conn.tipo === newStyle) return;

    const oldStyle = conn.tipo;
    changeConnectionStyle(id, newStyle);

    pushAction({
        label: `Cambiar estilo de conexión`,
        undo: () => changeConnectionStyle(id, oldStyle),
        redo: () => changeConnectionStyle(id, newStyle)
    });
};

export const actionConnectCompleteGraph = () => {
    const ids = [...selectedNodesIds()];
    if (ids.length < 2) return;

    startTransaction("Conectar grafo completo");
    
    const createdConns: Connection[] = [];
    
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            if (!areConnected(ids[i], ids[j])) {
                const conn = actionCreateConnection(ids[i], ids[j]);
                if (conn) createdConns.push(conn);
            }
        }
    }
    
    pushAction({
        label: "Conectar grafo completo",
        undo: () => {
            createdConns.forEach(conn => actionDeleteConnection(conn.id));
        },
        redo: () => {
            createdConns.forEach(conn => {
                setConnections(prev => [...prev, conn]);
                wsService.sendEvent({
                    tipo: 'crear_conexion',
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
    
    commitTransaction();
};


// ==========================================
// 6. ACCIONES DE PROPIEDADES AVANZADAS
// ==========================================

export const actionSetNodeProperty = (nodeId: string, propertyName: string, value: any) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const prevValue = node.properties ? node.properties[propertyName] : undefined;
    addNodeProperty(nodeId, propertyName, value);

    pushAction({
        label: `Propiedad de nodo: ${propertyName}`,
        undo: () => {
            if (prevValue === undefined) {
                deleteNodeProperty(nodeId, propertyName);
            } else {
                addNodeProperty(nodeId, propertyName, prevValue);
            }
        },
        redo: () => addNodeProperty(nodeId, propertyName, value)
    });
};

export const actionDeleteNodeProperty = (nodeId: string, propertyName: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.properties || node.properties[propertyName] === undefined) return;

    const prevValue = node.properties[propertyName];
    deleteNodeProperty(nodeId, propertyName);

    pushAction({
        label: `Eliminar propiedad de nodo: ${propertyName}`,
        undo: () => addNodeProperty(nodeId, propertyName, prevValue),
        redo: () => deleteNodeProperty(nodeId, propertyName)
    });
};

export const actionSetConnectionProperty = (connId: string, propertyName: string, value: any) => {
    const conn = connections.find(c => c.id === connId);
    if (!conn) return;

    const prevValue = conn.properties ? conn.properties[propertyName] : undefined;
    addConnectionProperty(connId, propertyName, value);

    pushAction({
        label: `Propiedad de conexión: ${propertyName}`,
        undo: () => {
            if (prevValue === undefined) {
                deleteConnectionProperty(connId, propertyName);
            } else {
                addConnectionProperty(connId, propertyName, prevValue);
            }
        },
        redo: () => addConnectionProperty(connId, propertyName, value)
    });
};

export const actionDeleteConnectionProperty = (connId: string, propertyName: string) => {
    const conn = connections.find(c => c.id === connId);
    if (!conn || !conn.properties || conn.properties[propertyName] === undefined) return;

    const prevValue = conn.properties[propertyName];
    deleteConnectionProperty(connId, propertyName);

    pushAction({
        label: `Eliminar propiedad de conexión: ${propertyName}`,
        undo: () => addConnectionProperty(connId, propertyName, prevValue),
        redo: () => deleteConnectionProperty(connId, propertyName)
    });
};

// Acciones para propiedades desde queries (con selección múltiple)
export const actionAddNodePropertyToSelected = (propertyName: string, propertyValue: any) => {
    const selectedIds = [...selectedNodesIds()];
    if (selectedIds.length === 0) return;
    
    startTransaction(`Agregar propiedad ${propertyName} a ${selectedIds.length} nodos`);
    
    const snapshots = selectedIds.map(id => {
        const node = nodes.find(n => n.id === id);
        return { id, prevValue: node?.properties?.[propertyName] };
    });
    
    selectedIds.forEach(id => addNodeProperty(id, propertyName, propertyValue, true));
    
    pushAction({
        label: `Agregar propiedad: ${propertyName}`,
        undo: () => {
            snapshots.forEach(({ id, prevValue }) => {
                if (prevValue === undefined) {
                    deleteNodeProperty(id, propertyName);
                } else {
                    addNodeProperty(id, propertyName, prevValue);
                }
            });
        },
        redo: () => {
            selectedIds.forEach(id => addNodeProperty(id, propertyName, propertyValue, true));
        }
    });
    
    commitTransaction();
};

export const actionDeleteNodePropertyFromSelected = (propertyName: string) => {
    const selectedIds = [...selectedNodesIds()];
    if (selectedIds.length === 0) return;
    
    const snapshots = selectedIds.map(id => {
        const node = nodes.find(n => n.id === id);
        return { id, prevValue: node?.properties?.[propertyName] };
    }).filter(s => s.prevValue !== undefined);
    
    if (snapshots.length === 0) return;
    
    startTransaction(`Eliminar propiedad ${propertyName} de ${snapshots.length} nodos`);
    
    selectedIds.forEach(id => deleteNodeProperty(id, propertyName, true));
    
    pushAction({
        label: `Eliminar propiedad: ${propertyName}`,
        undo: () => {
            snapshots.forEach(({ id, prevValue }) => {
                addNodeProperty(id, propertyName, prevValue);
            });
        },
        redo: () => {
            selectedIds.forEach(id => deleteNodeProperty(id, propertyName, true));
        }
    });
    
    commitTransaction();
};


// ==========================================
// 7. ACCIONES GLOBALES DEL PROYECTO
// ==========================================

export const actionUpdateProjectName = (oldName: string, newName: string) => {
    if (oldName === newName) return;
    
    updateCurrentProjectName(newName, true);

    pushAction({
        label: `Renombrar proyecto a "${newName}"`,
        undo: () => updateCurrentProjectName(oldName, true),
        redo: () => updateCurrentProjectName(newName, true)
    });
};

export const actionAddProjectProperty = (propertyName: string, propertyValue: any, prevValue?: any) => {
    addCurrentProjectProperty(propertyName, propertyValue);

    pushAction({
        label: `Cambiar propiedad del proyecto: ${propertyName}`,
        undo: () => {
            if (prevValue === undefined) {
                addCurrentProjectProperty(propertyName, undefined);
            } else {
                addCurrentProjectProperty(propertyName, prevValue);
            }
        },
        redo: () => addCurrentProjectProperty(propertyName, propertyValue)
    });
};

export const actionDeleteProjectProperty = (propertyName: string, prevValue?: any) => {
    deleteCurrentProjectProperty(propertyName);

    pushAction({
        label: `Eliminar propiedad del proyecto: ${propertyName}`,
        undo: () => {
            addCurrentProjectProperty(propertyName, prevValue);
        },
        redo: () => deleteCurrentProjectProperty(propertyName)
    });
};

// Agrega estas funciones al final de actions.ts (antes de los exports)

// ==========================================
// 8. ACCIONES BULK PARA RESIZE Y MOVE (desde Editor.tsx)
// ==========================================

/**
 * Registra el movimiento de múltiples nodos (para arrastre en tiempo real)
 * Esta función debe llamarse al FINALIZAR el movimiento (mouse up)
 */
export const actionFinalizeMultipleNodesMove = (snapshots: { id: string; x: number; y: number }[]) => {
    if (snapshots.length === 0) return;
    
    const changedSnapshots = snapshots.map(snapshot => {
        const node = nodes.find(candidate => candidate.id === snapshot.id);
        return node && (node.x !== snapshot.x || node.y !== snapshot.y)
            ? {before: snapshot, after: {id: node.id, x: node.x, y: node.y}}
            : null;
    }).filter((snapshot): snapshot is {before: {id: string, x: number, y: number}, after: {id: string, x: number, y: number}} => snapshot !== null);
    
    if (changedSnapshots.length === 0) return;

    startTransaction(`Mover ${changedSnapshots.length} nodos`);
    changedSnapshots.forEach(({before, after}) => {
        pushAction({
            label: "Mover nodo",
            undo: () => {
                updateNodoAbsolutePosition(before.id, before.x, before.y);
                finalizeNodePosition(before.id);
            },
            redo: () => {
                updateNodoAbsolutePosition(after.id, after.x, after.y);
                finalizeNodePosition(after.id);
            }
        });
    });
    commitTransaction();
};

/**
 * Registra el redimensionamiento de múltiples nodos
 */
export const actionFinalizeMultipleNodesResize = (snapshots: { id: string; width: number; height: number; x: number; y: number }[]) => {
    if (snapshots.length === 0) return;
    
    const currentSnapshots = snapshots.map(s => {
        const node = nodes.find(n => n.id === s.id);
        return node ? { id: s.id, width: node.width, height: node.height, x: node.x, y: node.y } : null;
    }).filter(Boolean);
    
    if (currentSnapshots.length === 0) return;
    
    startTransaction(`Redimensionar ${snapshots.length} nodos`);
    
    snapshots.forEach((s, i) => {
        const current = currentSnapshots[i];
        if (current && (current.width !== s.width || current.height !== s.height)) {
            pushAction({
                label: `Redimensionar nodo`,
                undo: () => {
                    updateNodeSize(s.id, s.width, s.height);
                    updateNodePosition(s.id, s.x - current.x, s.y - current.y);
                    finalizeNodePosition(s.id);
                    finalizeNodeSize(s.id);
                },
                redo: () => {
                    updateNodeSize(s.id, current.width, current.height);
                    updateNodePosition(s.id, current.x - s.x, current.y - s.y);
                    finalizeNodePosition(s.id);
                    finalizeNodeSize(s.id);
                }
            });
        }
    });
    
    commitTransaction();
};

/**
 * Guarda el estado actual de los nodos seleccionados para luego registrar el movimiento
 * Útil para capturar el estado inicial antes de un arrastre
 */
export const captureNodesSnapshot = (ids: string[]) => {
    return ids.map(id => {
        const node = nodes.find(n => n.id === id);
        return node ? { id, x: node.x, y: node.y, width: node.width, height: node.height } : null;
    }).filter(n => n != null);
};

/**
 * Registra el movimiento de un solo nodo (al finalizar)
 */
export const actionFinalizeNodeMove = (id: string, oldX: number, oldY: number) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    
    if (oldX !== node.x || oldY !== node.y) {
        pushAction({
            label: `Mover nodo`,
            undo: () => {
                updateNodePosition(id, oldX - node.x, oldY - node.y);
                finalizeNodePosition(id);
            },
            redo: () => {
                updateNodePosition(id, node.x - oldX, node.y - oldY);
                finalizeNodePosition(id);
            }
        });
    }
};

/**
 * Registra el redimensionamiento de un solo nodo (al finalizar)
 */
export const actionFinalizeNodeResize = (id: string, oldWidth: number, oldHeight: number, oldX: number, oldY: number) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    
    if (oldWidth !== node.width || oldHeight !== node.height) {
        pushAction({
            label: `Redimensionar nodo`,
            undo: () => {
                updateNodeSize(id, oldWidth, oldHeight);
                updateNodePosition(id, oldX - node.x, oldY - node.y);
                finalizeNodePosition(id);
                finalizeNodeSize(id);
            },
            redo: () => {
                updateNodeSize(id, node.width, node.height);
                updateNodePosition(id, node.x - oldX, node.y - oldY);
                finalizeNodePosition(id);
                finalizeNodeSize(id);
            }
        });
    }
};