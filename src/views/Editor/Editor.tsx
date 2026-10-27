import { Properties } from "./components/Properties";
import styles from "./Editor.module.css";
import { CURRENT_POSITION, LAST_ACTIONS, LEFT_TOOLBAR, TOOL_BELT } from "./components/Toolbars";
import { nodes, updateNodePosition, updateNodeSize, finalizeNodePosition, setNodes, ocupadoPor, selectedNodesIds, activeNode, selectedNodes, setSelectedNodesIds, Node, finalizeNodeSize } from "../../models/nodes";
import { lerp } from "../../utils/math";
import { setDraggedNodeId, draggedNodeId, draggedNode } from "../../models/nodes";
import { connections, setConnections, setSelectedConnectionId } from "../../models/connections";
import { moveNodeThrottle, wsService } from "../../core/socket";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
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
    drawSnapGuides,
    drawConnectionPoint, 
    setSourceAnchorPoint,
    invalidateAllResources,
    invalidateParagraphCache
} from "../../core/renderer";

import "../../App.css";
import { setViewMouseHandlers } from "../../utils/mouse";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { deleteCurrentProjectProperty, userData } from "../../models/userStore";
import { COMMAND_PALETTE, setActiveIndex } from "./components/CommandPalette/CommandPalette";
import { activeUsers, setActiveUsers, useUser } from "../../models/users";
import { ToastContainer } from "../components/ToastContainer";
import { showToast } from "../../models/toast";
import { initializeEditorKeyboardEvents, removeEditorKeyboardEvents } from "../../utils/keyboard";
import { manageResizing } from "../../utils/resizing";
import { obtenerColorTexto } from "../../utils/color";

import { 
    captureNodesSnapshot, 
    actionFinalizeMultipleNodesMove, 
    actionFinalizeMultipleNodesResize,
    actionCreateConnection,
    actionSetConnectionProperty,
    actionChangeConnectionStyle,
    actionCreateNode,
    actionChangeNodeStyle,
    actionUpdateNodeTitle,
} from "../../core/actions";

import { 
    startAutosaveTimer,
    stopAutosaveTimer,
    saveOnClose,
    cleanOldAutosaves
} from "../../core/autosave";

import { ConfigPanel } from "./components/ConfigPanel/ConfiguracionPanel";
import { AutosavePanel } from "./components/AutosavePanel/AutosavePanel";
import { EDITOR_HEADER } from "./components/Header/Header";
import { LAYERS_PANEL } from "./components/LayersPanel/LayersPanel";
import { commitTransaction, startTransaction } from "../../core/history";
import { setIsAppLoading, setLoadingAppMessage } from "../components/Transition";

export const [isLayersPanelOpen, setIsLayersPanelOpen] = createSignal(false);
export const [isEditPanelOpen, setIsEditPanelOpen] = createSignal(true);
export const [isCommandPaletteOpen, setIsCommandPaletteOpen] = createSignal(false);
export const [isConfigPanelOpen, setIsConfigPanelOpen] = createSignal(false);
export const [isAutosavePanelOpen, setIsAutosavePAnelopen] = createSignal(false);

export const [isRunningDataFlow, setIsRunningDataFlow] = createSignal(false);
export const [dataFlowResult, setDataFlowResult] = createSignal("");

export const [isPressedEspace, setIsPRessedEspace] = createSignal(false);

export const [isResizing, setIsResizing] = createSignal(false);
export const [referencePoint, setReferencePoint] = createSignal<{x: number, y: number} | null>(null);
export const [resizingBox, setResizingBox] = createSignal<{x: number, y:number, width:number, height: number}| null>(null);
export let resizingNodesCopy: Node[] = [];
export let nodesMoveSnapshot: { id: string; x: number; y: number; width: number; height: number }[] = [];

export const [mouseOption, setMouseOption] = createSignal<'move' | 'select' | 'connect' | 'create'>('select');
export const [layerView, setLayerView] = createSignal<'nodes' | 'connections'>('nodes');

export const [mouseDisabled, setMouseDisables] = createSignal(false);
export let flowConecctions = 0;

export let selectionRect = { x0: 0, y0: 0, x1: 0, y1: 0};
export let mousePos = { x: 0, y: 0};
export const [exportedMousePos, setExportedMousePos] = createSignal({x:0, y:0});
type SnapGuide = {
    axis: "x" | "y",
    position: number,
    from: {x: number, y: number},
    to: {x: number, y: number}
};

const [snapPreview, setSnapPreview] = createSignal<{
    nodeIds: string[],
    offsetX: number,
    offsetY: number,
    guides: SnapGuide[]
}>({nodeIds: [], offsetX: 0, offsetY: 0, guides: []});

const getSnapAnchors = (bounds: {left: number, top: number, right: number, bottom: number}) => {
    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;
    return [
        {x: bounds.left, y: bounds.top},
        {x: centerX, y: bounds.top},
        {x: bounds.right, y: bounds.top},
        {x: bounds.right, y: centerY},
        {x: bounds.right, y: bounds.bottom},
        {x: centerX, y: bounds.bottom},
        {x: bounds.left, y: bounds.bottom},
        {x: bounds.left, y: centerY},
        {x: centerX, y: centerY}
    ];
};

const findSnapPreview = (
    movingNodes: Pick<Node, "x" | "y" | "width" | "height">[],
    stationaryNodes: Node[],
    deltaX: number,
    deltaY: number,
    threshold: number,
    applyPreviewOffset: boolean
) => {
    if(movingNodes.length === 0 || stationaryNodes.length === 0){
        return {offsetX: 0, offsetY: 0, guides: [] as SnapGuide[]};
    }

    const bounds = movingNodes.reduce((current, node) => ({
        left: Math.min(current.left, node.x),
        top: Math.min(current.top, node.y),
        right: Math.max(current.right, node.x + node.width),
        bottom: Math.max(current.bottom, node.y + node.height)
    }), {left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity});
    const movingAnchors = getSnapAnchors(bounds);
    const stationaryAnchors = stationaryNodes.flatMap(node => getSnapAnchors({
        left: node.x,
        top: node.y,
        right: node.x + node.width,
        bottom: node.y + node.height
    }));

    let offsetX = 0;
    let offsetY = 0;
    let closestX = threshold;
    let closestY = threshold;

    if(applyPreviewOffset){
        for(const moving of movingAnchors){
            for(const stationary of stationaryAnchors){
                const differenceX = stationary.x - (moving.x + deltaX);
                if(Math.abs(differenceX) < closestX){
                    closestX = Math.abs(differenceX);
                    offsetX = differenceX;
                }

                const differenceY = stationary.y - (moving.y + deltaY);
                if(Math.abs(differenceY) < closestY){
                    closestY = Math.abs(differenceY);
                    offsetY = differenceY;
                }
            }
        }
    }

    const guides: SnapGuide[] = [];
    for(const moving of movingAnchors){
        for(const stationary of stationaryAnchors){
            const displayedX = moving.x + deltaX + offsetX;
            if(Math.abs(stationary.x - displayedX) < threshold){
                guides.push({
                    axis: "x",
                    position: stationary.x,
                    from: {x: displayedX, y: moving.y + deltaY + offsetY},
                    to: stationary
                });
            }

            const displayedY = moving.y + deltaY + offsetY;
            if(Math.abs(stationary.y - displayedY) < threshold){
                guides.push({
                    axis: "y",
                    position: stationary.y,
                    from: {x: moving.x + deltaX + offsetX, y: displayedY},
                    to: stationary
                });
            }
        }
    }

    return {offsetX, offsetY, guides};
};

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

    const isViewer = () => userData.currentRoomRole !== "owner" && userData.currentRoomRole !== "editor";
    const [editingNode, setEditingNode] = createSignal<{id: string, value: string, initialHeight: number} | null>(null);
    let titleEditorRef: HTMLTextAreaElement | undefined;
    let isConnecting = false;
    let isSelecting = false;
    let isCreating = false;
    
    let connectionSourceId: string | null = null;
    let connectionPoint: {x: number, y: number, direction: ANCHOR_POINT} | null = null;
    let connectionSourcePoint: {x: number, y: number, direction: ANCHOR_POINT} | null = null;

    const finishTitleEditing = (save: boolean) => {
        const edit = editingNode();
        if(!edit) return;
        if (isViewer()) {
            setEditingNode(null);
            return;
        }

        if(save){
            const node = nodes.find(candidate => candidate.id === edit.id);
            if(node){
                actionUpdateNodeTitle(edit.id, node.title || "", edit.value, edit.initialHeight);
            }
        } else {
            const node = nodes.find(candidate => candidate.id === edit.id);
            if(node && node.height !== edit.initialHeight){
                updateNodeSize(node.id, node.width, edit.initialHeight);
                finalizeNodeSize(node.id);
            }
        }

        setEditingNode(null);
    };

    const resizeTitleEditor = (editor: HTMLTextAreaElement) => {
        const edit = editingNode();
        const node = edit && nodes.find(candidate => candidate.id === edit.id);
        if(!edit || !node) return;

        const zoom = nodusCanvas.camera.zoom();
        const basePadding = 10 * zoom;
        editor.style.height = "auto";
        editor.style.padding = `${basePadding}px`;
        const contentHeight = editor.scrollHeight - basePadding * 2;
        const naturalHeight = contentHeight / zoom + 20;
        const height = Math.max(edit.initialHeight, naturalHeight);
        updateNodeSize(node.id, node.width, height);
        const verticalPadding = (height * zoom - contentHeight) / 2;
        editor.style.height = `${height * zoom}px`;
        editor.style.padding = `${verticalPadding}px ${basePadding}px`;
    };

    const handleNodeDoubleClick = (e: MouseEvent) => {
        if (isViewer()) return;
        if(mouseOption() === 'move' || isPressedEspace()) return;

        const {x, y} = nodusCanvas.camera.screenToWordl(e.offsetX, e.offsetY);
        const hit = [...nodes].reverse().find(node =>
            x >= node.x && x <= node.x + node.width &&
            y >= node.y && y <= node.y + node.height
        );

        if(!hit || hit.lock || ocupadoPor(hit.id) !== undefined) return;

        setSelectedNodesIds([hit.id]);
        setEditingNode({id: hit.id, value: hit.title || "", initialHeight: hit.height});
        requestAnimationFrame(() => {
            if(!titleEditorRef) return;
            titleEditorRef.focus();
            titleEditorRef.select();
            resizeTitleEditor(titleEditorRef);
        });
    };

    const handleTitleEditorKeyDown = (e: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) => {
        e.stopPropagation();
        if(e.key === 'Enter' && !e.shiftKey){
            e.preventDefault();
            finishTitleEditing(true);
            e.currentTarget.blur();
        } else if(e.key === 'Escape'){
            e.preventDefault();
            finishTitleEditing(false);
        }
    };

    const editingNodeDetails = () => {
        const edit = editingNode();
        if(!edit) return null;
        const node = nodes.find(candidate => candidate.id === edit.id);
        return node ? {edit, node} : null;
    };

    const handleMouseDown = (e: MouseEvent) => {
        if (isViewer()) {
            if (mouseOption() === "move" || isPressedEspace()) setDraggedNodeId("root");
            return;
        }

        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        setIsCommandPaletteOpen(false);
        setSelectedConnectionId(null);

        if (mouseOption() === 'move' || isPressedEspace()){
            setDraggedNodeId("root");
            return;
        }

        const {x, y} = nodusCanvas.camera.screenToWordl(e.offsetX, e.offsetY);

        if(mouseOption() === 'create'){
            isCreating = true;
            selectionRect = {x0: x, y0: y, x1: x, y1: y};
            setSelectedNodesIds([]);
            setDraggedNodeId(null);
            return;
        }

        // Primero verificamos si es un resize
        const resizingPointsize = 8 / nodusCanvas.camera.zoom();
        const resizingPoint = resizingDots().find(dot => 
            x <= dot.x + resizingPointsize && x >= dot.x - resizingPointsize &&
            y <= dot.y + resizingPointsize && y >= dot.y - resizingPointsize
        );

        if(resizingPoint){
            setIsResizing(true);
            setReferencePoint({x: resizingPoint.x, y: resizingPoint.y});
            // Guardar snapshot para el historial
            resizingNodesCopy = [...nodes].filter(node => selectedNodesIds().includes(node.id)).map(node => ({...node}));
            nodesMoveSnapshot = captureNodesSnapshot(selectedNodesIds());
            const bounds = resizingNodesCopy.reduce((current, node) => ({
                minX: Math.min(current.minX, node.x),
                minY: Math.min(current.minY, node.y),
                maxX: Math.max(current.maxX, node.x + node.width),
                maxY: Math.max(current.maxY, node.y + node.height)
            }), {
                minX: Infinity,
                minY: Infinity,
                maxX: -Infinity,
                maxY: -Infinity
            });
            setResizingBox({
                x: bounds.minX,
                y: bounds.minY,
                width: bounds.maxX - bounds.minX,
                height: bounds.maxY - bounds.minY
            });
            return;
        }

        const zoom = nodusCanvas.camera.zoom();

        const connectionHit = [...nodes].reverse().find(node =>
            x >= (node.x - 10 / zoom) && x <= (node.x + node.width + 10 / zoom) &&
            y >= (node.y - 10 / zoom) && y <= (node.y + node.height + 10 /zoom)
        );

        if(mouseOption() == 'connect'){
            if(connectionHit && !connectionHit.lock){
                isConnecting = true;
                connectionSourceId = connectionHit.id;

                const points = anchorPoints.map(p => ({x: connectionHit.x + connectionHit.width * p.x, y: connectionHit.y + connectionHit.height * p.y, direction: p.direction}));

                const center = {x: connectionHit.x + connectionHit.width / 2, y: connectionHit.y + connectionHit.height / 2};
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

        const hit = [...nodes].reverse().find(node =>
            x >= node.x && x <= node.x + node.width &&
            y >= node.y && y <= node.y + node.height
        );

        if(hit){
            const isAlreadySelected = selectedNodesIds().includes(hit.id);

            if(ocupadoPor(hit.id) === undefined){
                if(!isAlreadySelected ){
                    if(!e.shiftKey){
                        setSelectedNodesIds([hit.id]);
                    } else {
                        setSelectedNodesIds(prev => [...prev, hit.id]);
                    }
                }
                setDraggedNodeId(hit.id);
                nodesMoveSnapshot = captureNodesSnapshot(selectedNodesIds());
            }
        } else {
            isSelecting = true;
            selectionRect = {x0: x, y0: y, x1: x, y1: y};
            setSelectedNodesIds([]);
        }
    }

    const handleMouseMove = (e : MouseEvent) => {

        mousePos = nodusCanvas.camera.screenToWordl(e.offsetX, e.offsetY);
        setExportedMousePos({x: mousePos.x, y: mousePos.y});

        wsService.sendEvent({
            tipo: "mover_cursor",
            x: mousePos.x,
            y: mousePos.y,
            nombre: useUser().name()
        }, false);

        if (isViewer()) {
            if (draggedNodeId() === "root" && !isRunningDataFlow()) {
                nodusCanvas.camera.setOffsetX(prev => prev + e.movementX);
                nodusCanvas.camera.setOffsetY(prev => prev + e.movementY);
            }
            return;
        }

        //Primero verificamos si es resizing
        if(isResizing()){
            manageResizing(mousePos)
            const movingIds = new Set(selectedNodesIds());
            const movingNodes = selectedNodes();
            const stationaryNodes = nodes.filter(node => !movingIds.has(node.id));
            const preview = findSnapPreview(
                movingNodes,
                stationaryNodes,
                0,
                0,
                8 / nodusCanvas.camera.zoom(),
                false
            );
            setSnapPreview({nodeIds: [], ...preview});
            return;
        }

        if(isCreating){
            selectionRect.x1 = mousePos.x;
            selectionRect.y1 = mousePos.y;
            return;
        }


        const resizingPointSize = 8 / nodusCanvas.camera.zoom();
        setFocusedPoint(resizingDots().find(dot => 
            mousePos.x <= dot.x + resizingPointSize && mousePos.x >= dot.x - resizingPointSize &&
            mousePos.y <= dot.y + resizingPointSize && mousePos.y >= dot.y - resizingPointSize
        ) || null);

        if(mouseOption() === 'connect'){
            const connectPointSize = 10 / nodusCanvas.camera.zoom();
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
                    mousePos.x <= p.x + connectPointSize && mousePos.x >= p.x - connectPointSize &&
                    mousePos.y <= p.y + connectPointSize && mousePos.y >= p.y - connectPointSize
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

        if(draggedNodeId() == "root" && !isRunningDataFlow()){
            nodusCanvas.camera.setOffsetX(prev =>  prev + e.movementX);
            nodusCanvas.camera.setOffsetY(prev =>  prev + e.movementY);
            return;
        }

        const deltaX = e.movementX / nodusCanvas.camera.zoom();
        const deltaY = e.movementY / nodusCanvas.camera.zoom();
        const draggedId = draggedNodeId()!;
        const movingNodes = selectedNodesIds().includes(draggedId)
            ? selectedNodes().filter(node => !node.lock)
            : nodes.filter(node => node.id === draggedId && !node.lock);
        const movingIds = new Set(movingNodes.map(node => node.id));
        const stationaryNodes = nodes.filter(node => !movingIds.has(node.id));
        const preview = findSnapPreview(
            movingNodes,
            stationaryNodes,
            deltaX,
            deltaY,
            8 / nodusCanvas.camera.zoom(),
            true
        );

        setSnapPreview({
            nodeIds: movingNodes.map(node => node.id),
            ...preview
        });

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
        if (isViewer()) {
            setDraggedNodeId(null);
            isSelecting = false;
            isCreating = false;
            return;
        }

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

        if(isCreating){
            const end = nodusCanvas.camera.screenToWordl(e.offsetX, e.offsetY);
            const width = Math.abs(end.x - selectionRect.x0);
            const height = Math.abs(end.y - selectionRect.y0);
            const dragDistance = Math.hypot(
                (end.x - selectionRect.x0) * nodusCanvas.camera.zoom(),
                (end.y - selectionRect.y0) * nodusCanvas.camera.zoom()
            );

            if(dragDistance >= 4){
                const x = Math.min(selectionRect.x0, end.x);
                const y = Math.min(selectionRect.y0, end.y);
                actionCreateNode(x, y, undefined, Math.max(60, width), Math.max(40, height));
            }

            isCreating = false;
            selectionRect = {x0: 0, y0: 0, x1: 0, y1: 0};
            return;
        }

        if(isConnecting && connectionSourceId){
            const {x: mouseX, y: mouseY} = nodusCanvas.camera.screenToWordl(e.offsetX, e.offsetY);

            const zoom = nodusCanvas.camera.zoom();

            const target = [...nodes].reverse().find(n => 
                !n.lock &&
                mouseX >= (n.x - 10 / zoom) && mouseX <= (n.x + n.width + 10 / zoom) &&
                mouseY >= (n.y - 10 / zoom) && mouseY <= (n.y + n.height + 10 / zoom)
            );

            if(target && target.id !== connectionSourceId){
                startTransaction("Crear conexion");
                const conn = actionCreateConnection(connectionSourceId, target.id);
                if(conn){
                    if(connectionSourcePoint){
                        actionSetConnectionProperty(conn.id, 'fromPoint', connectionSourcePoint.direction);
                    }
                    if(connectionPoint){
                        actionSetConnectionProperty(conn.id, 'toPoint', connectionPoint.direction);
                    }
                    if(e.altKey){
                        actionSetConnectionProperty(conn.id, 'dashed', true);
                    }
                    if(e.ctrlKey || e.metaKey){
                        actionChangeConnectionStyle(conn.id, 7);
                    }
                }
                commitTransaction();
            } else if (!target){
                startTransaction("Crear nodo con conexion");
                const new_node = actionCreateNode(mouseX - 80, mouseY - 40);
                if (new_node) {
                    const conn = actionCreateConnection(connectionSourceId, new_node.id);
                    if(conn) {
                        if(connectionSourcePoint){
                            actionSetConnectionProperty(conn.id, 'fromPoint', connectionSourcePoint.direction);
                        }
                        if(e.altKey){
                            actionSetConnectionProperty(conn.id, 'dashed', true);
                        }
                        if(e.ctrlKey || e.metaKey){
                            actionChangeConnectionStyle(conn.id, 7);
                        }
                    }
                }
                commitTransaction();
            }
        }

        isConnecting = false;
        connectionSourceId = null;
        connectionSourcePoint = null;
        setSourceAnchorPoint(null);

        // Finalizar movimiento de nodos - registrar en historial
        if(draggedNodeId() && draggedNodeId() !== "root") {
            const movedNodeIds = nodesMoveSnapshot.length > 0
                ? nodesMoveSnapshot.map(snapshot => snapshot.id)
                : selectedNodesIds();
            movedNodeIds.forEach(nodeID => finalizeNodePosition(nodeID));

            if (nodesMoveSnapshot.length > 0) {
                actionFinalizeMultipleNodesMove(nodesMoveSnapshot);
            }
        }

        setDraggedNodeId(null);
        setSnapPreview({nodeIds: [], offsetX: 0, offsetY: 0, guides: []});
        nodesMoveSnapshot = [];
    };

    const handleRightClickMouseDown = (e : MouseEvent) => {
        if (isViewer()) return;

        const {x, y} = nodusCanvas.camera.screenToWordl(e.offsetX, e.offsetY)

        const hit = [...nodes].reverse().find(n => 
            x >= n.x && x <= n.x + n.width &&
            y >= n.y && y <= n.y + n.height
        );

        if(hit){
            actionChangeNodeStyle(hit.id, hit.style, (hit.style + 1) % 2);
        }

    };

    setViewMouseHandlers({
        onLeftClick: handleMouseDown,
        onDoubleClick: handleNodeDoubleClick,
        onMove: handleMouseMove,
        onUp: handleMouseUp,
        onRightClick: handleRightClickMouseDown
    });

    onMount(async () => {

        nodusCanvas.viewName = 'editor';
        
        wsService.initSocket();

        try {

            window.addEventListener('wheel', (e) => {

                if(e.target !== nodusCanvas.canvasRef) return;

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

            function draw() {
                
                // Actualizar viewport bounds cada 16ms o cuando cambia la cámara
                if (Date.now() - lastViewportUpdate > 16) {
                    updateViewportBounds();
                }
                
                // Cache de nodos visibles para evitar filtrados repetitivos
                const preview = snapPreview();
                const previewNodeIds = new Set(preview.nodeIds);
                const displayNodes = [...nodes].map(node => previewNodeIds.has(node.id)
                    ? {...node, x: node.x + preview.offsetX, y: node.y + preview.offsetY}
                    : node
                );
                const displayNodesById = new Map(displayNodes.map(node => [node.id, node]));
                const visibleNodes = displayNodes.filter(node => isNodeVisible(node));
                const lockedNodes = visibleNodes.filter(node => node.lock);
                const unlockedNodes = visibleNodes.filter(node => !node.lock);
                
                // Grid solo cuando hay un nodo arrastrado
                if(draggedNodeId()){
                    const dragged = draggedNode();
                    if(dragged && isNodeVisible(dragged)){
                        drawGrid({x: dragged.x + dragged.width / 2, y: dragged.y + dragged.height / 2});
                    }
                }

                for (const node of nodes) {
                    if (node.targetX !== undefined && node.targetY !== undefined) {
                        const dx = node.targetX - node.x;
                        const dy = node.targetY - node.y;
                        const distance = Math.sqrt(dx*dx + dy*dy);
                        if (distance < 0.5) {
                            // Fijar posición exacta y limpiar targets
                            setNodes(n => n.id === node.id, {
                                x: node.targetX,
                                y: node.targetY,
                                targetX: undefined,
                                targetY: undefined
                            });
                        } else {
                            // Interpolar suavemente (factor 0.15 es típico)
                            const newX = node.x + dx * 0.15;
                            const newY = node.y + dy * 0.15;
                            setNodes(n => n.id === node.id, { x: newX, y: newY });
                        }
                    }
                }

                // Grid solo para nodo seleccionado único y visible
                if(selectedNodesIds().length === 1){
                    const node = displayNodesById.get(selectedNodesIds()[0]);
                    if(node && isNodeVisible(node) && userData.currentProjectProperties.showNodeLines){
                        drawNodeGrid(CK, node);
                    }
                }
                
                // Dibujar nodos bloqueados (visibles)
                lockedNodes.forEach(node => {
                    drawNode(CK, node);
                    drawNodeText(CK, node, nodusCanvas.getFont());
                });
                
                // Dibujar conexiones solo entre nodos visibles
                connections.forEach(conn => {
                    const fromNode = displayNodesById.get(conn.from);
                    const toNode = displayNodesById.get(conn.to);
                    
                    if (fromNode && !fromNode.lock && toNode && !toNode.lock && 
                        (isNodeVisible(fromNode) || isNodeVisible(toNode))) {
                        drawConnection(CK, fromNode, toNode, conn);
                    }
                });

                if(isConnecting && connectionSourceId){
                    const fromNode = displayNodesById.get(connectionSourceId);
                    if(fromNode){
                        const startPoint = connectionSourcePoint || {
                            x: fromNode.x + fromNode.width / 2,
                            y: fromNode.y + fromNode.height / 2
                        };

                        drawElasticLine(CK, fromNode, mousePos, startPoint);
                    }
                }
                
                // Dibujar nodos no bloqueados (visibles)
                unlockedNodes.forEach(node => {
                    drawNode(CK, node);
                    drawNodeText(CK, node, nodusCanvas.getFont());
                });

                if(isResizing() || (draggedNodeId() && draggedNodeId() !== "root")){
                    drawSnapGuides(CK, preview.guides);
                }

                if(connectionPoint){
                    drawConnectionPoint(CK, {
                        x: connectionPoint.x,
                        y: connectionPoint.y
                    });
                }
                
                if(connectionSourcePoint){
                    drawConnectionPoint(CK, { x: connectionSourcePoint.x, y: connectionSourcePoint.y }, "#33a1ff");
                }
                
                setResizingDots([]);
                if(selectedNodesIds().length > 0){
                    drawResizingBox(CK, selectedNodes().map(node => displayNodesById.get(node.id) || node))
                }
                
                if(isSelecting || isCreating){
                    drawSelectionRect();
                }
                
                drawPings();
                
                activeUsers.forEach(user => {
                    if(user.nombre == useUser().name()) return;
                    
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
            nodusCanvas.setOnResize(() => {
                invalidateAllResources();
                invalidateParagraphCache();
            })
                        
        } catch (error) {
            console.error('Error initializing CanvasKit:', error);
        }
    });;

    const appWindow = getCurrentWindow();
    onMount(() => {
        
        initializeEditorKeyboardEvents();

        const handleViewerEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape" || !isViewer()) return;

            event.preventDefault();
            onHome();
        };
        window.addEventListener("keydown", handleViewerEscape);

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

        if (!isFinite(nodusCanvas.camera.zoom()) || !isFinite(nodusCanvas.camera.offsetX())) {
            nodusCanvas.camera.setZoom(1);
            nodusCanvas.camera.setOffsetX(0);
            nodusCanvas.camera.setOffsetY(0);
        }

        // 2. Intentar enfocar el diagrama si ya hay nodos cargados, de lo contrario se ejecutará el fallback seguro
        setTimeout(() => {
            // Le damos 50ms para que SolidJS pinte los primeros elementos en el árbol reactivo
            nodusCanvas.camera.centerCameraNow();
        }, 50);

        onCleanup(() => {
            
            removeEditorKeyboardEvents();
            window.removeEventListener("keydown", handleViewerEscape);

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
            invalidateAllResources();
            invalidateParagraphCache();

            deleteCurrentProjectProperty('backgroundColor', false);

        });
    });


    async function onFullScrren(){
        const isFullScreen = await appWindow.isFullscreen();
        await appWindow.setFullscreen(!isFullScreen);
    }

    const onHome = () => {
        setIsAppLoading(true);
        setLoadingAppMessage("Guardando...");
        props.onNavigate('lobby');

        setTimeout(() => setIsAppLoading(false), 1200);
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
        const isEspace = isPressedEspace();
        let cursor = 'default';

        if(mouse == 'move' || isEspace){
            cursor = draggedNodeId() !== null? 'grabbing' : 'grab';
        }

        else if(mouse === 'create'){
            cursor = 'crosshair';
        }

        else if(focusedPoint() !== null){

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
        }
        else if (mouse == 'connect'){
            cursor = 'crosshair';
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
    });

    return (
        <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", "pointer-events": "none" }}>

            { EDITOR_HEADER(handleShare) }

            <Show when={!isViewer() && editingNodeDetails()}>
                {details => {
                    const screenPosition = () => nodusCanvas.camera.wordlToScreen(details().node.x, details().node.y);
                    return (
                        <textarea
                            ref={element => {
                                titleEditorRef = element;
                                element.value = editingNode()?.value || "";
                                requestAnimationFrame(() => resizeTitleEditor(element));
                            }}
                            class={styles.nodeTitleEditor}
                            style={{
                                left: `${screenPosition().x}px`,
                                top: `${screenPosition().y}px`,
                                width: `${details().node.width * nodusCanvas.camera.zoom()}px`,
                                "font-size": `${(details().node.properties.fontSize || 15) * nodusCanvas.camera.zoom()}px`,
                                "background-color": details().node.color,
                                color: obtenerColorTexto(details().node.color)
                            }}
                            onInput={e => {
                                const edit = editingNode();
                                if(edit){
                                    setEditingNode({...edit, value: e.currentTarget.value});
                                    resizeTitleEditor(e.currentTarget);
                                }
                            }}
                            onKeyDown={handleTitleEditorKeyDown}
                            onBlur={() => finishTitleEditing(true)}
                        />
                    );
                }}
            </Show>

            <Show when={!isViewer() && isCommandPaletteOpen()}>
                {COMMAND_PALETTE()}
            </Show>

            <Show when={!isViewer() && !isCommandPaletteOpen()}>
                { LEFT_TOOLBAR(onFullScrren, onHome) }
            </Show>


            <Show when={!isViewer()}>
                { Properties() }
            </Show>


            <Show when={!isViewer()}>
                { TOOL_BELT() }
            </Show>

            <Show when={!isViewer()}>
                { LAYERS_PANEL() }
            </Show>

            <Show when={!isViewer()}>
                { LAST_ACTIONS() }
            </Show>

            { CURRENT_POSITION() }

            { ConfigPanel() }

            <Show when={!isViewer()}>
                <AutosavePanel onClose={() => setIsAutosavePAnelopen(false)} />
            </Show>

            <Show when={isRunningDataFlow() && dataFlowResult()}>
                <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translateX(-50%) translateY(-50%)",
                    "z-index": 100,
                    "font-size": "40px",
                    color: "white",
                    padding: "9px",
                    background: "#403820A2",
                    "backdrop-filter": "blur(5px)",
                    "border-radius": "4px"
                }}>
                    {dataFlowResult()}
                </div>
            </Show>

            { ToastContainer() }


        </div>
    );
}