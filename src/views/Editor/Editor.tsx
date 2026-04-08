import { Properties } from "./components/Properties";
import { LEFT_TOOLBAR, USERS_PANEL, PROJECT_NAME, ROOM_ID  } from "./components/Toolbars";
import { nodes, updateNodePosition, finalizeNodePosition, setNodes, deleteNode, selectedNode } from "../../models/nodes";
import { screenToWorld } from "../../utils/math";
import { setSelectedNodeId, setDraggedNodeId, moveToFront, draggedNodeId, draggedNode  } from "../../models/nodes";
import { addConnection, connections } from "../../models/connections";
import { moveNodeThrottle, socket, initSocket, closeSocket } from "../../core/socket";
import {  onCleanup, onMount } from "solid-js";
import { nodusCanvas } from "../../core/NodusCanvas";
import { drawGrid, drawConnection, drawElasticLine, drawNode, drawNodeText } from "../../core/renderer";
import "../../App.css";
import { setViewMouseHandlers } from "../../utils/mouse";
import { getCurrentWindow } from "@tauri-apps/api/window";

import styles from "./Editor.module.css";

export let scale = 1;
export  let offsetX = 0;
export  let offsetY = 0;

export let flowConecctions = 0;

export const Editor = (props: { onNavigate: (v: 'lobby' | 'editor') => void}) => {


    let isConnecting = false;
    let connectionSourceId: string | null = null;
    let mousePos = { x: 0, y: 0};

    const handleMouseDown = (e: MouseEvent) => {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        const mouseX = e.offsetX;
        const mouseY = e.offsetY;

        const {x, y} = screenToWorld(mouseX, mouseY);

        const hit = [...nodes].reverse().find(node =>
        x >= node.x && x <= node.x + node.width &&
        y >= node.y && y <= node.y + node.height
        );

        if(hit){
        if(e.altKey){
            isConnecting = true;
            connectionSourceId = hit.id;
        } else {
            setDraggedNodeId(hit.id);
            moveToFront(hit.id);
            (e.target as HTMLCanvasElement).style.cursor = 'grabbing';
        }
        }

        else {
        setSelectedNodeId(null);
        setDraggedNodeId("root");
        (e.target as HTMLCanvasElement).style.cursor = 'grabbing';
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

        const events = (e as any).getCoalescedEvents?.() || [e];

        for(let event of events){
        updateNodePosition(draggedNodeId()!, event.movementX / scale, event.movementY / scale);
        moveNodeThrottle(draggedNodeId(), draggedNode()?.x, draggedNode()?.y);
        }

    }

    const handleMouseUp = (e : MouseEvent) => {

        if(isConnecting && connectionSourceId){
        const {x: mouseX, y: mouseY} = screenToWorld(e.offsetX, e.offsetY);

        const target = nodes.find(n => 
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
        (e.target as HTMLCanvasElement).style.cursor = 'crosshair';
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

                connections.forEach(conn => {

                    const fromNode = nodes.find(n => n.id === conn.from);
                    const toNode = nodes.find(n => n.id === conn.to);
                    
                    if (fromNode && toNode) {
                        drawConnection(CK, canvas, fromNode, toNode, conn.tipo);
                    }

                });

                if(isConnecting && connectionSourceId){
                    const fromNode = nodes.find(n => n.id === connectionSourceId);
                    if(fromNode){
                        drawElasticLine(CK, canvas, fromNode, mousePos);
                    }
                }

                nodes.forEach(node => {

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
    });

    const appWindow = getCurrentWindow();

    const onFullScrren = () => {
        appWindow.setFullscreen(true);
    }

    const onHome = () => {
        props.onNavigate('lobby');
    }

    return (
        <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", "pointer-events": "none" }}>

            { LEFT_TOOLBAR(onFullScrren, onHome) }

            { Properties() }

            { USERS_PANEL() }

            <div class={styles.topLeftToolbar}>
                { PROJECT_NAME() }
                { ROOM_ID() }
            </div>

        </div>
    );
}