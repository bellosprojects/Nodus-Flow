import { Properties } from "./components/Properties";
import { LEFT_TOOLBAR, USERS_PANEL, PROJECT_NAME, TOOL_BELT, LAYERS_PANEL, TOP_BUTTONS } from "./components/Toolbars";
import { nodes, updateNodePosition, finalizeNodePosition, setNodes, ocupar, ocupadoPor, selectedNodesIds, activeNode, selectedNodes, setSelectedNodesIds, Node, finalizeNodeSize } from "../../models/nodes";
import { lerp } from "../../utils/math";
import { setDraggedNodeId, draggedNodeId, draggedNode } from "../../models/nodes";
import { addConnection, connections, setConnections, setSelectedConnectionId, addConnectionProperty, changeConnectionStyle } from "../../models/connections";
import { moveNodeThrottle, wsService } from "../../core/socket";
import { createEffect, createSignal, Match, onCleanup, onMount, Switch } from "solid-js";
import { nodusCanvas } from "../../core/NodusCanvas";

import { 
    drawGrid, 
    drawConnection, 
    drawElasticLine, 
    drawNode, 
    drawNodeText, 
    drawExternalCursor, 
    drawPings, 
    drawSelectionRect, 
    drawResizingBox, 
    focusedPoint, 
    resizingDots, 
    setFocusedPoint, 
    setResizingDots, 
    drawNodeGrid, 
    drawConnectionPoint, 
    setSourceAnchorPoint 
} from "../../core/renderer";

import "../../App.css";
import { setViewMouseHandlers } from "../../utils/mouse";
import { getCurrentWindow } from "@tauri-apps/api/window";

import styles from "./Editor.module.css";
import { addCurrentProjectProperty, updateCurrentProjectName, userData } from "../../models/userStore";
import { COMMAND_PALETTE, setActiveIndex } from "./components/CommandPalette";
import { activeUsers, setActiveUsers } from "../../models/users";
import { ToastContainer } from "../components/ToastContainer";
import { showToast } from "../../models/toast";
import { initializeEditorKeyboardEvents, removeEditorKeyboardEvents } from "../../utils/keyboard";
import { manageResizing } from "../../utils/resizing";
import { calculateDiagramBounds } from "../../utils/path";

import { 
    captureNodesSnapshot, 
    actionFinalizeMultipleNodesMove, 
    actionFinalizeMultipleNodesResize,
} from "../../core/actions";

import { 
    startAutosaveTimer,
    stopAutosaveTimer,
    saveOnClose,
    getLatestAutosave,
    restoreAutosave,
    cleanOldAutosaves
} from "../../core/autosave";

import { ConfigPanel } from "./components/ConfiguracionPanel";
import { AutosavePanel } from "./components/AutosavePanel";

export const [isLayersPanelOpen, setIsLayersPanelOpen] = createSignal(false);
export const [isEditPanelOpen, setIsEditPanelOpen] = createSignal(true);
export const [isCommandPaletteOpen, setIsCommandPaletteOpen] = createSignal(false);
export const [isConfigPanelOpen, setIsConfigPanelOpen] = createSignal(false);
export const [isAutosavePanelOpen, setIsAutosavePAnelopen] = createSignal(false);

export const [isResizing, setIsResizing] = createSignal(false);
export const [referencePoint, setReferencePoint] = createSignal<{x: number, y: number} | null>(null);
export const [resizingBox, setResizingBox] = createSignal<{x: number, y:number, width:number, height: number}| null>(null);
export let resizingNodesCopy: Node[] = [];
export let nodesMoveSnapshot: { id: string; x: number; y: number; width: number; height: number }[] = [];

export const [mouseOption, setMouseOption] = createSignal<'move' | 'select' | 'connect'>('move');
export const [layerView, setLayerView] = createSignal<'nodes' | 'connections'>('nodes');

export const [mouseDisabled, setMouseDisables] = createSignal(false);
export let flowConecctions = 0;

export let selectionRect = { x0: 0, y0: 0, x1: 0, y1: 0};
export let mousePos = { x: 0, y: 0};

let viewportBounds = {x: 0, y: 0, width: 0, height: 0};
let lastViewportUpdate = 0;
const VIEWPORT_MARGIN = 200;

function updateViewportBounds() {
    const zoom = nodusCanvas.camera.zoom();
    const offsetX = nodusCanvas.camera.offsetX();
    const offsetY = nodusCanvas.camera.offsetY();
    
    viewportBounds = {
        x: -offsetX / zoom - VIEWPORT_MARGIN,
        y: -offsetY / zoom - VIEWPORT_MARGIN,
        width: window.innerWidth / zoom + VIEWPORT_MARGIN * 2,
        height: window.innerHeight / zoom + VIEWPORT_MARGIN * 2
    };
    lastViewportUpdate = Date.now();
}

function isNodeVisible(node: Node): boolean {
    return !(node.x + node.width < viewportBounds.x ||
            node.x > viewportBounds.x + viewportBounds.width ||
            node.y + node.height < viewportBounds.y ||
            node.y > viewportBounds.y + viewportBounds.height);
}

export enum ANCHOR_POINT{
    TOP = "TOP",
    BOTTOM = "BOTTOM",
    LEFT = "LEFT",
    RIGHT = "RIGHT",
    TOP_LEFT = "TOP_LEFT",
    TOP_RIGHT = "TOP_RIGHT",
    BOTTOM_LEFT = "BOTTOM_LEFT",
    BOTTOM_RIGHT = "BOTTOM_RIGHT"
};

const anchorPoints = [
    {x: 0.5, y: 0, direction: ANCHOR_POINT.TOP},
    {x: 1, y: 0.5, direction: ANCHOR_POINT.RIGHT},
    {x: 0.5, y: 1, direction: ANCHOR_POINT.BOTTOM},
    {x: 0, y: 0.5, direction: ANCHOR_POINT.LEFT},
    {x: 0, y: 0, direction: ANCHOR_POINT.TOP_LEFT},
    {x: 1, y: 0, direction: ANCHOR_POINT.TOP_RIGHT},
    {x: 0, y: 1, direction: ANCHOR_POINT.BOTTOM_LEFT},
    {x: 1, y: 1, direction: ANCHOR_POINT.BOTTOM_RIGHT},
];

export const Editor = (props: { onNavigate: (v: 'lobby' | 'editor') => void}) => {

    let isConnecting = false;
    let isSelecting = false;
    
    let connectionSourceId: string | null = null;
    let connectionPoint: {x: number, y: number, direction: ANCHOR_POINT} | null = null;
    let connectionSourcePoint: {x: number, y: number, direction: ANCHOR_POINT} | null = null;

    const handleMouseDown = (e: MouseEvent) => {

        nodusCanvas.requestRedraw();

        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        setIsCommandPaletteOpen(false);
        setSelectedConnectionId(null);

        const {x, y} = nodusCanvas.camera.screenToWordl(e.offsetX, e.offsetY);

        // Primero verificamos si es un resize
        const resizingPoint = resizingDots().find(dot => 
            x <= dot.x + 8 && x >= dot.x - 8 &&
            y <= dot.y + 8 && y >= dot.y - 8
        );

        if(resizingPoint){
            setIsResizing(true);
            setReferencePoint({x: resizingPoint.x, y: resizingPoint.y});
            // Guardar snapshot para el historial
            resizingNodesCopy = [...nodes].filter(node => selectedNodesIds().includes(node.id)).map(node => ({...node}));
            nodesMoveSnapshot = captureNodesSnapshot(selectedNodesIds());
            const bounds = calculateDiagramBounds(selectedNodes());
            setResizingBox({
                x: bounds.x + 20,
                y: bounds.y + 20,
                width: bounds.width - 20,
                height: bounds.height - 20
            });
            return;
        }

        const hit = [...nodes].reverse().find(node =>
            x >= node.x && x <= node.x + node.width &&
            y >= node.y && y <= node.y + node.height
        );

        if(mouseOption() == 'connect'){
            if(hit && !hit.lock){
                isConnecting = true;
                connectionSourceId = hit.id;

                const points = anchorPoints.map(p => ({x: hit.x + hit.width * p.x, y: hit.y + hit.height * p.y, direction: p.direction}));

                const center = {x: hit.x + hit.width / 2, y: hit.y + hit.height / 2};
                const click = {x, y};

                let nearest = points[0];
                let minDist = Infinity;
                for(const p of points){
                    const dx = p.x - click.x;
                    const dy = p.y - click.y;
                    const d = Math.sqrt(dx*dx + dy*dy);
                    if(d < minDist){ minDist = d; nearest = p; }
                }

                const centerDist = Math.sqrt((center.x - click.x) * (center.x - click.x) + (center.y - click.y) * (center.y - click.y));

                if(centerDist < minDist){
                    connectionSourcePoint = null;
                    setSourceAnchorPoint(null);
                } else {
                    connectionSourcePoint = { x: nearest.x, y: nearest.y, direction: nearest.direction };
                    setSourceAnchorPoint(connectionSourcePoint);
                }
            }
            return;
        }

        if(hit){
            const isAlreadySelected = selectedNodesIds().includes(hit.id);

            if(!isAlreadySelected){
                if(!e.shiftKey){
                    ocupar(hit.id);
                } else {
                    setSelectedNodesIds(prev => [...prev, hit.id]);
                }
            }

            if(mouseOption() == 'move' && ocupadoPor(hit.id) === undefined){
                if(!hit.lock){
                    setDraggedNodeId(hit.id);
                    // Capturar snapshot para el historial al inicio del arrastre
                    nodesMoveSnapshot = captureNodesSnapshot(selectedNodesIds().length > 0 ? selectedNodesIds() : [hit.id]);
                }
            }
        } else {
            //CLIC AL VACIO
            if(mouseOption() === 'select'){
                isSelecting = true;
                selectionRect = {x0: x, y0: y, x1: x, y1: y};
            } else if (mouseOption() == 'move'){
                setDraggedNodeId("root"); //Paneo de camara
            }
            setSelectedNodesIds([]);
        }
    }

    const handleMouseMove = (e : MouseEvent) => {

        mousePos = nodusCanvas.camera.screenToWordl(e.offsetX, e.offsetY);

        wsService.sendEvent({
            tipo: "mover_cursor",
            x: mousePos.x,
            y: mousePos.y,
            nombre: userData.name
        }, false);

        nodusCanvas.requestRedraw();

        //Primero verificamos si es resizing
        if(isResizing()){
            manageResizing(mousePos)
            return;
        }

        setFocusedPoint(resizingDots().find(dot => 
            mousePos.x <= dot.x + 8 && mousePos.x >= dot.x - 8 &&
            mousePos.y <= dot.y + 8 && mousePos.y >= dot.y - 8
        ) || null);

        if(focusedPoint()){
            setMouseOption(prev => prev);
        }

        if(mouseOption() === 'connect'){
            const snapNode = [...nodes].reverse().find(node =>
                mousePos.x >= node.x - 10 && mousePos.x <= node.x + node.width + 10 &&
                mousePos.y >= node.y - 10 && mousePos.y <= node.y + node.height + 10
            );

            if(snapNode){
                const points = anchorPoints.map(point => {
                    return {
                        x: snapNode.x + point.x * snapNode.width,
                        y: snapNode.y + point.y * snapNode.height,
                        direction: point.direction
                    }
                });

                const snapPoint = points.find(p => 
                    mousePos.x <= p.x + 10 && mousePos.x >= p.x - 10 &&
                    mousePos.y <= p.y + 10 && mousePos.y >= p.y - 10
                );

                connectionPoint = snapPoint? {x: snapPoint.x, y: snapPoint.y, direction: snapPoint.direction} : null;
                
            } else {
                connectionPoint = null;
            }
        };
        
        if(isSelecting) {
            selectionRect.x1 = mousePos.x;
            selectionRect.y1 = mousePos.y;
            return;
        }

        if(isConnecting) return;

        if(draggedNodeId() == null) return;

        if(draggedNodeId() == "root"){
            nodusCanvas.camera.setOffsetX(prev =>  prev + e.movementX);
            nodusCanvas.camera.setOffsetY(prev =>  prev + e.movementY);
            return;
        }

        //Arrastre multiple
        const deltaX = e.movementX / nodusCanvas.camera.zoom();
        const deltaY = e.movementY / nodusCanvas.camera.zoom();

        if(selectedNodesIds().includes(draggedNodeId()!)){
            selectedNodes().forEach(node => {
                if(!node.lock) {
                    updateNodePosition(node.id, deltaX, deltaY);
                }
            });
            moveNodeThrottle(selectedNodes().map(n => {return {x: n.x, y: n.y, id: n.id}}));
        } else {
            updateNodePosition(draggedNodeId()!, deltaX, deltaY);
            moveNodeThrottle([{id: draggedNode()!.id, x: draggedNode()!.x, y: draggedNode()!.y}]);
        }
    };

    const handleMouseUp = (e : MouseEvent) => {

        nodusCanvas.requestRedraw();

        // Finalizar resize - registrar en historial
        if(isResizing()){
            const currentNodes = selectedNodesIds().map(id => {
                const node = nodes.find(n => n.id === id);
                return node ? { id, width: node.width, height: node.height, x: node.x, y: node.y } : null;
            }).filter(Boolean);
            
            // Registrar el resize en el historial si hubo cambios
            if (nodesMoveSnapshot.length > 0 && currentNodes.length > 0) {
                const hasChanges = nodesMoveSnapshot.some((snapshot, i) => {
                    const current = currentNodes[i];
                    return current && (current.width !== snapshot.width || 
                                      current.height !== snapshot.height ||
                                      current.x !== snapshot.x ||
                                      current.y !== snapshot.y);
                });
                
                if (hasChanges) {
                    actionFinalizeMultipleNodesResize(nodesMoveSnapshot as any);
                }
            }
            
            selectedNodesIds().forEach(id => {
                finalizeNodePosition(id);
                finalizeNodeSize(id);
            });
            setIsResizing(false);
            setFocusedPoint(null);
            setReferencePoint(null);
            setResizingBox(null);
            resizingNodesCopy = [];
            nodesMoveSnapshot = [];
        }

        if (isSelecting){
            setSelectedNodesIds(nodes.filter(node => {
                const minX = Math.min(selectionRect.x0, selectionRect.x1);
                const maxX = Math.max(selectionRect.x0, selectionRect.x1);
                const minY = Math.min(selectionRect.y0, selectionRect.y1);
                const maxY = Math.max(selectionRect.y0, selectionRect.y1);

                return (
                    node.x < maxX &&
                    node.x + node.width > minX &&
                    node.y < maxY &&
                    node.y + node.height > minY
                );
            }).map(it => it.id));

            isSelecting = false;
            return;
        }

        if(isConnecting && connectionSourceId){
            const {x: mouseX, y: mouseY} = nodusCanvas.camera.screenToWordl(e.offsetX, e.offsetY);

            const target = [...nodes].reverse().find(n => 
                !n.lock &&
                mouseX >= n.x && mouseX <= n.x + n.width &&
                mouseY >= n.y && mouseY <= n.y + n.height
            );

            if(target && target.id !== connectionSourceId){
                const newId = addConnection(connectionSourceId, target.id)?.id;
                if(newId){
                    if(connectionSourcePoint){
                        addConnectionProperty(newId, 'fromPoint', connectionSourcePoint.direction);
                    }
                    if(connectionPoint){
                        addConnectionProperty(newId, 'toPoint', connectionPoint.direction);
                    }
                    if(e.altKey){
                        addConnectionProperty(newId, 'dashed', 'true');
                    }
                    if(e.ctrlKey || e.metaKey){
                        changeConnectionStyle(newId, 7);
                    }
                }
            }
        }

        isConnecting = false;
        connectionSourceId = null;
        connectionSourcePoint = null;
        setSourceAnchorPoint(null);

        // Finalizar movimiento de nodos - registrar en historial
        if(draggedNodeId() && draggedNodeId() !== "root") {
            
            // Registrar el movimiento en el historial si hay snapshot guardado
            if (nodesMoveSnapshot.length > 0) {
                actionFinalizeMultipleNodesMove(nodesMoveSnapshot as any);
            }
            
            selectedNodesIds().forEach(nodeID => {
                finalizeNodePosition(nodeID);
            });
        }

        setDraggedNodeId(null);
        nodesMoveSnapshot = [];
    };

    setViewMouseHandlers({
        onClick: handleMouseDown,
        onMove: handleMouseMove,
        onUp: handleMouseUp
    });

    onMount(async () => {
        
        wsService.initSocket();

        try {

            window.addEventListener('wheel', (e) => {
                e.preventDefault();
                const ZOOM_SPEED = 0.0008;
                const delta = -e.deltaY;
                const oldScale = nodusCanvas.camera.zoom();

                nodusCanvas.camera.setZoom(prev => prev + delta * ZOOM_SPEED);
                nodusCanvas.camera.setZoom(prev => Math.min(Math.max(0.1, prev), 5));

                const mouseX = e.offsetX;
                const mouseY = e.offsetY;

                nodusCanvas.camera.setOffsetX(prev => prev - (mouseX - prev) * (nodusCanvas.camera.zoom() / oldScale - 1));
                nodusCanvas.camera.setOffsetY(prev => prev - (mouseY - prev) * (nodusCanvas.camera.zoom() / oldScale - 1));

            }, {passive: false});

            
            const CK = nodusCanvas.getCK();
            const canvas = nodusCanvas.getCanvas();

            function draw() {
                
                // Actualizar viewport bounds cada 16ms o cuando cambia la cámara
                if (Date.now() - lastViewportUpdate > 16) {
                    updateViewportBounds();
                }
                
                // Cache de nodos visibles para evitar filtrados repetitivos
                const visibleNodes = nodes.filter(node => isNodeVisible(node));
                const lockedNodes = visibleNodes.filter(node => node.lock);
                const unlockedNodes = visibleNodes.filter(node => !node.lock);
                
                // Grid solo cuando hay un nodo arrastrado
                if(draggedNodeId()){
                    const dragged = draggedNode();
                    if(dragged && isNodeVisible(dragged)){
                        drawGrid({x: dragged.x + dragged.width / 2, y: dragged.y + dragged.height / 2});
                    }
                }
                
                // Dibujar nodos bloqueados (visibles)
                lockedNodes.forEach(node => {
                    drawNode(CK, canvas, node);
                    drawNodeText(CK, canvas, node, nodusCanvas.getFont());
                });
                
                // Dibujar conexiones solo entre nodos visibles
                connections.forEach(conn => {
                    const fromNode = nodes.find(n => n.id === conn.from);
                    const toNode = nodes.find(n => n.id === conn.to);
                    
                    if (fromNode && !fromNode.lock && toNode && !toNode.lock && 
                        (isNodeVisible(fromNode) || isNodeVisible(toNode))) {
                        drawConnection(CK, canvas, fromNode, toNode, conn);
                    }
                });

                if(isConnecting && connectionSourceId){
                    const fromNode = nodes.find(n => n.id === connectionSourceId);
                    if(fromNode){
                        const startPoint = connectionSourcePoint || {
                            x: fromNode.x + fromNode.width / 2,
                            y: fromNode.y + fromNode.height / 2
                        };

                        drawElasticLine(CK, canvas, fromNode, mousePos, startPoint);
                    }
                }
                
                // Dibujar nodos no bloqueados (visibles)
                unlockedNodes.forEach(node => {
                    drawNode(CK, canvas, node);
                    drawNodeText(CK, canvas, node, nodusCanvas.getFont());
                });
                
                // Grid solo para nodo seleccionado único y visible
                if(selectedNodesIds().length === 1){
                    const node = selectedNodes()[0];
                    if(node && isNodeVisible(node)){
                        drawNodeGrid(CK, canvas, node);
                    }
                }

                // Resto del código igual...
                if(connectionPoint){
                    drawConnectionPoint(CK, canvas, {
                        x: connectionPoint.x,
                        y: connectionPoint.y
                    });
                }
                
                if(connectionSourcePoint){
                    drawConnectionPoint(CK, canvas, { x: connectionSourcePoint.x, y: connectionSourcePoint.y }, "#33a1ff");
                }
                
                setResizingDots([]);
                if(selectedNodesIds().length > 0){
                    drawResizingBox(CK, canvas, selectedNodes())
                }
                
                if(isSelecting){
                    drawSelectionRect();
                }
                
                drawPings();
                
                activeUsers.forEach(user => {
                    if(user.nombre == userData.name) return;
                    
                    if(user.targetX !== undefined){
                        setActiveUsers(u => u.nombre === user.nombre, {x: lerp(user.x, user.targetX, 0.15)});
                    }
                    
                    if(user.targetY !== undefined){
                        setActiveUsers(u => u.nombre === user.nombre, {y: lerp(user.y, user.targetY, 0.15)});
                    }
                    
                    // Solo dibujar cursores de usuarios dentro del viewport
                    if (user.x >= viewportBounds.x && user.x <= viewportBounds.x + viewportBounds.width &&
                        user.y >= viewportBounds.y && user.y <= viewportBounds.y + viewportBounds.height) {
                        drawExternalCursor(user.x, user.y, user.color, user.nombre);
                    }
                });
                
                flowConecctions += 0.015;
                if(flowConecctions > 1) flowConecctions = 0;
            }
            nodusCanvas.setDraw(draw);
        
        } catch (error) {
            console.error('Error initializing CanvasKit:', error);
        }
    });;

    onMount(() => {

        initializeEditorKeyboardEvents();

        const handlerGlobalMouseMove = (_: MouseEvent) => {
            if(mouseDisabled()) setMouseDisables(false);
        }

        document.addEventListener('mousemove', handlerGlobalMouseMove);

        cleanOldAutosaves();

        startAutosaveTimer(() => ({
            zoom: nodusCanvas.camera.zoom(),
            offsetX: nodusCanvas.camera.offsetX(),
            offsetY: nodusCanvas.camera.offsetY()
        }));

        const latestAutosave = getLatestAutosave();
        if(latestAutosave && latestAutosave.timestamp > Date.now() - 24 * 60 * 60 * 1000) {
            const ageMinutes = Math.round((Date.now() - latestAutosave.timestamp) / (1000 * 60));
            const shuoldRestore = window.confirm(
                `Se encontro un autoguardado de hace ${ageMinutes} minutos. \n Queres restaurarlo? (Selecciona "Cancelar" paa usar el estado actual del servidor)`
            );

            if(shuoldRestore){
                restoreAutosave(latestAutosave, (data) => {
                    setNodes(data.nodes);
                    setConnections(data.connections);
                    if (data.projectName) updateCurrentProjectName(data.projectName, false);
                    Object.entries(data.projectProperties || {}).forEach(([KeyboardEvent, value]) => {
                        addCurrentProjectProperty(KeyboardEvent, value);
                    });

                    if(data.cameraState){
                        nodusCanvas.camera.setZoom(data.cameraState.zoom);
                        nodusCanvas.camera.setOffsetX(data.cameraState.offsetX);
                        nodusCanvas.camera.setOffsetY(data.cameraState.offsetY);
                    }
                });
            }
        }

        onCleanup(() => {
            
            removeEditorKeyboardEvents();

            document.removeEventListener('mousemove', handlerGlobalMouseMove);

            saveOnClose(() => ({
                zoom: nodusCanvas.camera.zoom(),
                offsetX: nodusCanvas.camera.offsetX(),
                offsetY: nodusCanvas.camera.offsetY()
            }));

            stopAutosaveTimer();

            wsService.closeSocket();
            setSelectedNodesIds([]);
            setDraggedNodeId(null);
            setNodes([]);
            setConnections([]);

        });
    });

    const appWindow = getCurrentWindow();
    appWindow.setTitle(`Nodus Flow - ${userData.name}`);

    async function onFullScrren(){
        const isFullScreen = await appWindow.isFullscreen();
        await appWindow.setFullscreen(!isFullScreen);
    }

    const onHome = () => {
        props.onNavigate('lobby');
    }

    const handleShare = async () => {
        const shareData : ShareData = {
            title: `Nodus Flow - ${userData.currentProjectName}`,
            text: `Join my design team at Nodus Flow!!\nRoom: ${userData.currentProjectName}\nID: ${userData.roomId}`,
            url: `https://render-yqtz.onrender.com/share_diagram?d=${userData.roomId}`,
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(
                    `${shareData.text}\nLink: ${shareData.url}`
                );
            showToast("Invitation copied to clipboard");
            }
        } catch (err) {
            console.error("Error al compartir:", err);
        }
    };

    createEffect(() => {
        const id = activeNode();
        if (id && isLayersPanelOpen()) {
            const el = document.getElementById(`layer-${id}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        if(wsService.isReady())
        wsService.sendEvent({
            "tipo": "seleccionar_nodo",
            "id": id?.id || null
        }, false);
    });
    
    createEffect(() => {
        const mouse = mouseOption();
        let cursor = 'default';

        if(focusedPoint() !== null){

            switch(focusedPoint()?.direction){
                case ANCHOR_POINT.TOP:
                    cursor = "n-resize";
                    break;
                case ANCHOR_POINT.BOTTOM:
                    cursor = "s-resize";
                    break;
                case ANCHOR_POINT.LEFT:
                    cursor = "e-resize";
                    break;
                case ANCHOR_POINT.RIGHT:
                    cursor = "w-resize";
                    break;
                case ANCHOR_POINT.TOP_LEFT:
                    cursor = "se-resize";
                    break;
                case ANCHOR_POINT.TOP_RIGHT:
                    cursor = "sw-resize";
                    break;
                case ANCHOR_POINT.BOTTOM_LEFT:
                    cursor = "ne-resize";
                    break;
                case ANCHOR_POINT.BOTTOM_RIGHT:
                    cursor = "nw-resize";
                    break;
            }
        } else {

            if(mouse == 'connect'){
                cursor = 'crosshair';
            } else if (mouse == 'move'){
                cursor = draggedNodeId() !== null? 'grabbing' : 'grab';
            }
        }
            
        nodusCanvas.canvasRef.style.cursor = cursor;
    });

    createEffect(() => {
        if(isCommandPaletteOpen()){
            document.getElementById("search")?.focus();
            setActiveIndex(0);
        }
    });

    createEffect(() => {
        // Escuchar cambios en cámara
        nodusCanvas.camera.zoom();
        nodusCanvas.camera.offsetX();
        nodusCanvas.camera.offsetY();
        updateViewportBounds();
        nodusCanvas.requestRedraw();
    });

    return (
        <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", "pointer-events": "none" }}>

            <div class={styles.topRightToolbar}>
                { USERS_PANEL() }

                { TOP_BUTTONS(handleShare) }
            </div>

            { LEFT_TOOLBAR(onFullScrren, onHome) }

            { Properties() }

            <div class={styles.topPanel}>
                <Switch>
                    <Match when={isCommandPaletteOpen()}>
                        { COMMAND_PALETTE() }
                    </Match>
                    <Match when={!isCommandPaletteOpen()}>
                        { PROJECT_NAME() }
                    </Match>
                </Switch>
            </div>

            { TOOL_BELT() }

            { LAYERS_PANEL() }

            { ConfigPanel() }

            { <AutosavePanel onClose={() => setIsAutosavePAnelopen(false)}></AutosavePanel> }

            { ToastContainer() }


        </div>
    );
}