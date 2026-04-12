import { Properties } from "./components/Properties";
import { LEFT_TOOLBAR, USERS_PANEL, PROJECT_NAME, TOOL_BELT, LAYERS_PANEL, TOP_BUTTONS  } from "./components/Toolbars";
import { nodes, updateNodePosition, finalizeNodePosition, setNodes, deleteNode, selectedNode, selectedNodeId, filteredNodes, jumpToNode } from "../../models/nodes";
import { screenToWorld } from "../../utils/math";
import { setSelectedNodeId, setDraggedNodeId, draggedNodeId, draggedNode  } from "../../models/nodes";
import { addConnection, connections, setConnections, setSelectedConnectionId } from "../../models/connections";
import { moveNodeThrottle, socket, initSocket, closeSocket } from "../../core/socket";
import {  createEffect, createSignal, Match, onCleanup, onMount, Switch } from "solid-js";
import { nodusCanvas } from "../../core/NodusCanvas";
import { drawGrid, drawConnection, drawElasticLine, drawNode, drawNodeText } from "../../core/renderer";
import "../../App.css";
import { setViewMouseHandlers } from "../../utils/mouse";
import { getCurrentWindow } from "@tauri-apps/api/window";

import styles from "./Editor.module.css";
import { userData } from "../../models/userStore";
import { activeIndex, COMMAND_PALETTE, setActiveIndex } from "./components/CommandPalette";

export const [isLayersPanelOpen, setIsLayersPanelOpen] = createSignal(false); 
export const [isEditPanelOpen, setIsEditPanelOpen] = createSignal(true);

export const [isCommandPaletteOpen, setIsCommandPaletteOpen] = createSignal(false);
export const [searchQuery, setSearchQuery] = createSignal("");

export const [mouseOption, setMouseOption] = createSignal<'move' | 'select' | 'connect'>('move');
export const [layerView, setLayerView] = createSignal<'nodes' | 'connections'>('nodes');

export let scale = 1;
export  let offsetX = 0;
export  let offsetY = 0;

export const setOffset = (newOffsetX: number, newOffsetY: number) => {
    offsetX = newOffsetX;
    offsetY = newOffsetY;
}

export const setScale = (newScale: number) => {
    scale = newScale;
}

export let flowConecctions = 0;

export const Editor = (props: { onNavigate: (v: 'lobby' | 'editor') => void}) => {

    let isConnecting = false;
    let connectionSourceId: string | null = null;
    let mousePos = { x: 0, y: 0};

    const handleMouseDown = (e: MouseEvent) => {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }

        setIsCommandPaletteOpen(false);
        setSelectedConnectionId(null);

        const mouseX = e.offsetX;
        const mouseY = e.offsetY;

        const {x, y} = screenToWorld(mouseX, mouseY);

        const hit = [...nodes].reverse().find(node =>
            x >= node.x && x <= node.x + node.width &&
            y >= node.y && y <= node.y + node.height
        );

        if(hit && !hit.lock){
            if(mouseOption() == 'connect'){
                isConnecting = true;
                connectionSourceId = hit.id;
            } else if (mouseOption() == 'move') {
                setDraggedNodeId(hit.id);
            }
        } else if (mouseOption() == 'move'){
            setDraggedNodeId("root");
        }

        if(mouseOption() == 'select' && hit){
            setSelectedNodeId(hit.id);
            
        } else {
            setSelectedNodeId(null);
        }
    }

    const handleMouseMove = (e : MouseEvent) => {

        mousePos = screenToWorld(e.offsetX, e.offsetY);

        if(isConnecting) return;

        if(draggedNodeId() == null) return;

        if(draggedNodeId() == "root"){
            offsetX += e.movementX;
            offsetY += e.movementY;
            return;
        }

        if(draggedNode()!.lock) return;

        const events = (e as any).getCoalescedEvents?.() || [e];

        for(let event of events){
            updateNodePosition(draggedNodeId()!, event.movementX / scale, event.movementY / scale);
            moveNodeThrottle(draggedNodeId(), draggedNode()?.x, draggedNode()?.y);
        }

    }

    const handleMouseUp = (e : MouseEvent) => {

        if(isConnecting && connectionSourceId){
            const {x: mouseX, y: mouseY} = screenToWorld(e.offsetX, e.offsetY);

            const target = [...nodes].reverse().find(n => 
                !n.lock &&
                mouseX >= n.x && mouseX <= n.x + n.width &&
                mouseY >= n.y && mouseY <= n.y + n.height
            );

            if(target && target.id !== connectionSourceId){
                addConnection(connectionSourceId, target.id);
            }
        }

        isConnecting = false;
        connectionSourceId = null;

        if(draggedNodeId()) {
            setSelectedNodeId(draggedNodeId());
            finalizeNodePosition(draggedNodeId()!);
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
                const oldScale = scale;

                scale += delta * ZOOM_SPEED;
                scale = Math.min(Math.max(0.1, scale), 5);

                const mouseX = e.offsetX;
                const mouseY = e.offsetY;

                offsetX -= (mouseX - offsetX) * (scale / oldScale - 1);
                offsetY -= (mouseY - offsetY) * (scale / oldScale - 1);
            }, {passive: false});

            window.addEventListener('keydown', (e) => {
                if(e.key === 'Delete'){
                    if(selectedNode() !== undefined){
                        deleteNode(selectedNode()!.id, true);
                    }
                }
            });

            
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
                        drawConnection(CK, canvas, fromNode, toNode, conn.id);
                    }

                });

                if(isConnecting && connectionSourceId){
                    const fromNode = nodes.find(n => n.id === connectionSourceId);
                    if(fromNode){
                        drawElasticLine(CK, canvas, fromNode, mousePos);
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

        setSelectedNodeId(null);
        setDraggedNodeId(null);
        setNodes([]);
        setConnections([]);
    });

    onMount(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsCommandPaletteOpen(prev => !prev);
                setSearchQuery("");
            }
            if (e.key === 'Escape') setIsCommandPaletteOpen(false);

            const list = filteredNodes().slice().reverse(); 
            if (list.length === 0) return;

            if (e.key === "ArrowDown") {
                setActiveIndex((prev) => (prev + 1) % list.length);
            } else if (e.key === "ArrowUp") {
                setActiveIndex((prev) => (prev - 1 + list.length) % list.length);
            } else if (e.key === "Enter") {
                jumpToNode(list[activeIndex()]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
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

    const onExport = () => {
        const data = {
            name: userData.currentProjectName,
            nodes: nodes,
            connections: connections
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `nodus_${userData.roomId}.json`;
        link.click();
        console.log("Downloading");
        alert("Downloading diagram");
    }

    const handleShare = async () => {
        const shareData = {
            title: `Nodus Flow - ${userData.currentProjectName}`,
            text: `¡Únete a mi mesa de diseño en Nodus Flow!\nSala: ${userData.currentProjectName}\nID: ${userData.roomId}`,
            url: window.location.href, // O el link específico si tienes routing
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(
                    `${shareData.text}\nLink: ${shareData.url}`
                );
            alert("Invitación copiada al portapapeles (Tu navegador no soporta Share)");
            }
        } catch (err) {
            console.error("Error al compartir:", err);
        }
    };

    createEffect(() => {
        const id = selectedNodeId();
        if (id && isLayersPanelOpen()) {
            const el = document.getElementById(`layer-${id}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });

    createEffect(() => {
        const mouse = mouseOption();

        if(mouse == 'connect'){
            nodusCanvas.canvasRef.style.cursor = 'crosshair';
        } else if (mouse == 'move'){
            if(draggedNodeId()){
                nodusCanvas.canvasRef.style.cursor = 'grabbing';
            } else {
                nodusCanvas.canvasRef.style.cursor = 'grab';
            }
        } else {
            nodusCanvas.canvasRef.style.cursor = 'default';
        }
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

                { TOP_BUTTONS(onExport, handleShare) }
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

        </div>
    );
}