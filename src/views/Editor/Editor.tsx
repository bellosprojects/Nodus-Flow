import { Properties } from "./components/Properties";
import { LEFT_TOOLBAR, USERS_PANEL, PROJECT_NAME, TOOL_BELT, LAYERS_PANEL, TOP_BUTTONS  } from "./components/Toolbars";
import { nodes, updateNodePosition, finalizeNodePosition, setNodes, ocupar, ocupadoPor, selectedNodesIds, activeNode, selectedNodes, setSelectedNodesIds, Node, finalizeNodeSize } from "../../models/nodes";
import { lerp } from "../../utils/math";
import { setDraggedNodeId, draggedNodeId, draggedNode  } from "../../models/nodes";
import { addConnection, connections, setConnections, setSelectedConnectionId, addConnectionProperty } from "../../models/connections";
import { moveNodeThrottle, socket, initSocket, closeSocket, sendEvent } from "../../core/socket";
import {  createEffect, createSignal, Match, onCleanup, onMount, Switch } from "solid-js";
import { nodusCanvas } from "../../core/NodusCanvas";
import { drawGrid, drawConnection, drawElasticLine, drawNode, drawNodeText, drawExternalCursor, drawPings, drawSelectionRect, drawResizingBox, focusedPoint, resizingDots, setFocusedPoint, setResizingDots, drawNodeGrid, drawConnectionPoint, setSourceAnchorPoint } from "../../core/renderer";
import "../../App.css";
import { setViewMouseHandlers } from "../../utils/mouse";
import { getCurrentWindow } from "@tauri-apps/api/window";

import styles from "./Editor.module.css";
import { userData } from "../../models/userStore";
import { COMMAND_PALETTE, setActiveIndex } from "./components/CommandPalette";
import { activeUsers, setActiveUsers } from "../../models/users";
import { ToastContainer } from "../components/ToastContainer";
import { showToast } from "../../models/toast";
import { initializeEditorKeyboardEvents, removeEditorKeyboardEvents } from "../../utils/keyboard";
import { manageResizing } from "../../utils/resizing";
import { calculateDiagramBounds } from "../../utils/path";

export const [isLayersPanelOpen, setIsLayersPanelOpen] = createSignal(false);
export const [isEditPanelOpen, setIsEditPanelOpen] = createSignal(true);
export const [isCommandPaletteOpen, setIsCommandPaletteOpen] = createSignal(false);
export const [isConfigPanelOpen, setIsConfigPanelOpen] = createSignal(false);

export const [isResizing, setIsResizing] = createSignal(false);
export const [referencePoint, setReferencePoint] = createSignal<{x: number, y: number} | null>(null);
export const [resizingBox, setResizingBox] = createSignal<{x: number, y:number, width:number, height: number}| null>(null);
export let resizingNodesCopy : Node[] = [];

export const [mouseOption, setMouseOption] = createSignal<'move' | 'select' | 'connect'>('move');
export const [layerView, setLayerView] = createSignal<'nodes' | 'connections'>('nodes');

export const [mouseDisabled, setMouseDisables] = createSignal(false);
export let flowConecctions = 0;

export let selectionRect = { x0: 0, y0: 0, x1: 0, y1: 0};
export let mousePos = { x: 0, y: 0};

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
    {x: 0, y: 0, direction: ANCHOR_POINT.TOP_LEFT},
    {x: 0.5, y: 0, direction: ANCHOR_POINT.TOP},
    {x: 1, y: 0, direction: ANCHOR_POINT.TOP_RIGHT},
    {x: 1, y: 0.5, direction: ANCHOR_POINT.RIGHT},
    {x: 1, y: 1, direction: ANCHOR_POINT.BOTTOM_RIGHT},
    {x: 0.5, y: 1, direction: ANCHOR_POINT.BOTTOM},
    {x: 0, y: 1, direction: ANCHOR_POINT.BOTTOM_LEFT},
    {x: 0, y: 0.5, direction: ANCHOR_POINT.LEFT}
];

export const Editor = (props: { onNavigate: (v: 'lobby' | 'editor') => void}) => {

    let isConnecting = false;
    let isSelecting = false;
    
    let connectionSourceId: string | null = null;
    let connectionPoint: {x: number, y: number, direction: ANCHOR_POINT} | null = null;
    let connectionSourcePoint: {x: number, y: number, direction: ANCHOR_POINT} | null = null;

    const handleMouseDown = (e: MouseEvent) => {
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
            resizingNodesCopy = [...nodes].filter(node => selectedNodesIds().includes(node.id)).map(node => ({...node}));
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

                // compute nearest anchor on the source node
                const points = [
                    {x: hit.x + 0 * hit.width, y: hit.y + 0 * hit.height, direction: ANCHOR_POINT.TOP_LEFT},
                    {x: hit.x + 0.5 * hit.width, y: hit.y + 0 * hit.height, direction: ANCHOR_POINT.TOP},
                    {x: hit.x + 1 * hit.width, y: hit.y + 0 * hit.height, direction: ANCHOR_POINT.TOP_RIGHT},
                    {x: hit.x + 1 * hit.width, y: hit.y + 0.5 * hit.height, direction: ANCHOR_POINT.RIGHT},
                    {x: hit.x + 1 * hit.width, y: hit.y + 1 * hit.height, direction: ANCHOR_POINT.BOTTOM_RIGHT},
                    {x: hit.x + 0.5 * hit.width, y: hit.y + 1 * hit.height, direction: ANCHOR_POINT.BOTTOM},
                    {x: hit.x + 0 * hit.width, y: hit.y + 1 * hit.height, direction: ANCHOR_POINT.BOTTOM_LEFT},
                    {x: hit.x + 0 * hit.width, y: hit.y + 0.5 * hit.height, direction: ANCHOR_POINT.LEFT}
                ];

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

                // if clicked near center or the nearest is a corner, don't use a source anchor
                if(centerDist < 20 || [ANCHOR_POINT.TOP_LEFT, ANCHOR_POINT.TOP_RIGHT, ANCHOR_POINT.BOTTOM_LEFT, ANCHOR_POINT.BOTTOM_RIGHT].includes(nearest.direction)){
                    connectionSourcePoint = null;
                    setSourceAnchorPoint(null);
                } else {
                    connectionSourcePoint = { x: nearest.x, y: nearest.y, direction: nearest.direction };
                    setSourceAnchorPoint(connectionSourcePoint as any);
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

        sendEvent({
            tipo: "mover_cursor",
            x: mousePos.x,
            y: mousePos.y,
            nombre: userData.name
        });

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
            // Buscar un punto cardinal de un nodo debajo del cursor para hacer snap
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

        if(isResizing()){
            selectedNodesIds().forEach(id => {
                finalizeNodePosition(id);
                finalizeNodeSize(id);
            })
            setIsResizing(false);
            setFocusedPoint(null);
            setReferencePoint(null);
            setResizingBox(null);
            resizingNodesCopy = [];
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
                const newId = addConnection(connectionSourceId, target.id);
                if(newId){
                    if(connectionSourcePoint){
                        addConnectionProperty(newId, 'fromPoint', connectionSourcePoint.direction);
                    }
                    if(connectionPoint){
                        addConnectionProperty(newId, 'toPoint', connectionPoint.direction);
                    }
                }
            }
        }

        isConnecting = false;
        connectionSourceId = null;
        connectionSourcePoint = null;
        setSourceAnchorPoint(null);

        if(draggedNodeId()) {
            selectedNodesIds().forEach(nodeID => {
                finalizeNodePosition(nodeID);
            });
        }

        setDraggedNodeId(null);
    };

    setViewMouseHandlers({
        onClick: handleMouseDown,
        onMove: handleMouseMove,
        onUp: handleMouseUp
    });

    onMount(async () => {
        
    
        if(!socket)
        initSocket();

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

            
            function draw() {

                const CK = nodusCanvas.getCK();
                const canvas = nodusCanvas.getCanvas();

                if(draggedNodeId()){
                    const node = draggedNode();
                    if(node){
                        const screenX = (node.x + node.width / 2)
                        const screenY = (node.y + node.height / 2)
                        drawGrid({x: screenX, y: screenY});
                    }
                }

                nodes.forEach(node => {

                    if(node.lock){

                        if(node.targetX !== undefined){
                            const easing = 0.15;
                            const newX = node.x + (node.targetX! - node.x) * easing;
                            const newY = node.y + (node.targetY! - node.y) * easing;

                            setNodes(n => n.id === node.id, {x : newX, y : newY});

                            if(Math.abs(node.x - node.targetX) < 0.1){
                                setNodes(n => n.id === node.id, { x: node.targetX, y: node.targetY});
                                setNodes(n => n.id === node.id, { targetX: undefined, targetY: undefined});
                            }
                        }

                        drawNode(CK, canvas, node);
                        drawNodeText(CK, canvas, node, nodusCanvas.getFont());
                    }
                });

                connections.forEach(conn => {

                    const fromNode = nodes.find(n => n.id === conn.from);
                    const toNode = nodes.find(n => n.id === conn.to);
                    
                    if (fromNode && !fromNode.lock && toNode && !toNode.lock) {
                        drawConnection(CK, canvas, fromNode, toNode, conn);
                    }

                });

                if(isConnecting && connectionSourceId){
                    const fromNode = nodes.find(n => n.id === connectionSourceId);
                    if(fromNode){
                        const startPoint = connectionSourcePoint ? { x: connectionSourcePoint.x, y: connectionSourcePoint.y } : undefined;
                        drawElasticLine(CK, canvas, fromNode, mousePos, startPoint);
                    }
                }

                nodes.forEach(node => {

                    if(!node.lock){

                        if(node.targetX !== undefined){
                            const easing = 0.15;
                            const newX = node.x + (node.targetX! - node.x) * easing;
                            const newY = node.y + (node.targetY! - node.y) * easing;

                            setNodes(n => n.id === node.id, {x : newX, y : newY});

                            if(Math.abs(node.x - node.targetX) < 0.1){
                                setNodes(n => n.id === node.id, { targetX: undefined, targetY: undefined});
                            }
                        }

                        drawNode(CK, canvas, node);
                        drawNodeText(CK, canvas, node, nodusCanvas.getFont());
                    }
                });

                if(selectedNodesIds().length === 1){
                    const node = selectedNodes()[0];
                    drawNodeGrid(CK, canvas, node);
                }

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

                    drawExternalCursor(user.x, user.y, user.color, user.nombre);
                });

                flowConecctions += 0.015;
                if(flowConecctions > 1) flowConecctions = 0;
                
            }
            nodusCanvas.setDraw(draw);
        
        } catch (error) {
            console.error('Error initializing CanvasKit:', error);
        }
    });

    onCleanup(() => {

        socket?.close();
        closeSocket();
        setSelectedNodesIds([]);
        setDraggedNodeId(null);
        setNodes([]);
        setConnections([]);
    });

    onMount(() => {

        initializeEditorKeyboardEvents();

        const handlerGlobalMouseMove = (_: MouseEvent) => {
            if(mouseDisabled()) setMouseDisables(false);
        }

        document.addEventListener('mousemove', handlerGlobalMouseMove);

        onCleanup(() => {
            
            removeEditorKeyboardEvents();

            document.removeEventListener('mousemove', handlerGlobalMouseMove);

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
            url: `https://render-yqtz.onrender.com/views/share.html?d=${userData.roomId}`, // O el link específico si tienes routing
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

        sendEvent({
            "tipo": "seleccionar_nodo",
            "id": id?.id || null
        });
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

            { ToastContainer() }

        </div>
    );
}