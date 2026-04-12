import { createStore } from "solid-js/store";
import { snapToGrid } from "../utils/math";
import { createSignal, createMemo } from "solid-js";
import { sendEvent } from "../core/socket";
import { connections, setConnections, setSelectedConnectionId } from "./connections";
import { nodusCanvas } from "../core/NodusCanvas";
import { scale, searchQuery, setIsCommandPaletteOpen, setOffset } from "../views/Editor/Editor";

export interface Node {
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    title?: string,
    opacity: number,
    targetX?: number,
    targetY?: number,
    radius: number
    lock: boolean
}

export const [nodes, setNodes] = createStore<Node[]>([]);

export const filteredNodes = createMemo(() => {

    const currentNodes = [...nodes]; 
    const query = searchQuery().toLowerCase();
    
    return currentNodes.filter(n => 
        (n.title || "").toLowerCase().includes(query)
    );
});

export const [selectedNodeId, setSelectedNodeId] = createSignal<string | null>(null);

export const [draggedNodeId, setDraggedNodeId] = createSignal<string | null>(null);

export const selectedNode = () => nodes.find(n => n.id === selectedNodeId());

export const draggedNode = () => nodes.find(n => n.id === draggedNodeId());

export const getNode = (id: string) => nodes.find(n => n.id === id);

export const addNode = (x: number, y : number) => {

    const newID = Math.random().toString(36).substring(6).toUpperCase();

    const newNode: Node = {
        id: newID,
        x,
        y,
        width: 160,
        height: 80,
        color: "#70C8C8",
        opacity: 1,
        radius: 8,
        lock: false
    };

    setNodes([...nodes, newNode]);

    console.log("Nodo agregado:", newNode);

    sendEvent({
        tipo: "nuevo_nodo",
        nodo: {
            id: newID,
            w: 160,
            h: 80,
            x: x,
            y: y,
            texto: "",
            color: "#70C8C8",
            opacidad: 1,
            radius: 8,
            pin: false
        }
    });
    
};

export const copyNode = (id: string) => {
    const currentNode = nodes.find(n => n.id === id);

    if(currentNode){

        const newID = Math.random().toString(36).substring(6).toUpperCase();

        const newNode : Node = {
            id: newID,
            x: currentNode.x + 20,
            y: currentNode.y + 20,
            width: currentNode.width,
            height: currentNode.height,
            radius: currentNode.radius,
            opacity: currentNode.opacity,
            color: currentNode.color,
            title: currentNode.title,
            lock: currentNode.lock
        };

        setNodes([...nodes, newNode]);

        sendEvent({
            tipo: "nuevo_nodo",
            nodo: {
                id: newID,
                w: newNode.width,
                h: newNode.height,
                x: newNode.x,
                y: newNode.y,
                texto: newNode.title || "",
                color: newNode.color,
                opacidad: newNode.opacity,
                radius: newNode.radius,
                pin: newNode.lock
            }
        });
    }
}

export const addRemoteNode = (id: string, x : number, y : number, w : number, h : number, text : string, color : string, opacidad: number, radius: number, lock: boolean) => {

    const newNode : Node = {
        id: id,
        x: x,
        y: y,
        width: w,
        height: h,
        title: text,
        color: color,
        opacity: opacidad,
        radius: radius,
        lock: lock
    }

    setNodes([...nodes, newNode]);
}

export const updateNodePosition = (id: string, dx: number, dy: number) => {
    setNodes(
        (n) => n.id === id,
        (n) => ({ 
            ...n,
            x: n.x + dx,
            y: n.y + dy
        })
    );
};

export const updateNodoAbsolutePosition = (id:string, x:number, y:number) => {
    setNodes(
        (n) => n.id === id,
        (n) => ({ 
            ...n,
            x: x,
            y: y
        })
    );
}

export const finalizeNodePosition = (id: string) => {

    const node = nodes.find(n => n.id === id);

    if(node){
        const newX = snapToGrid(node.x);
        const newY = snapToGrid(node.y);

        setNodes(
            (n) => n.id === id,
            (n) => ({ 
                ...n,
                x: newX,
                y: newY
            })
        );

        sendEvent({
            tipo: 'mover_nodo',
            id: id,
            x: newX,
            y: newY
        });
    }
}

export const finalizeNodeSize = (id: string) => {
    setNodes(
        (n) => n.id === id,
        (n) => ({ 
            ...n,
            width: snapToGrid(Math.max(n.width, 60)),
            height: snapToGrid(Math.max(n.height, 40))
        })
    );

    const node = nodes.find(n => n.id === id);

    if(node){
        sendEvent({
            tipo: 'redimensionar_nodo',
            id: id,
            w: node.width,
            h: node.height,
            x: node.x,
            y: node.y
        });
    }
}

export const moveToFront = (id: string, send = true) => {
    setNodes((nodes) => {
        const index = nodes.findIndex(n => n.id === id);
        if (index === -1) return nodes;

        const nodeToMove = nodes[index];
        const newNodes = [...nodes];
        newNodes.splice(index, 1);
        newNodes.push(nodeToMove);

        return newNodes;
    });

    if(send){
        sendEvent({
            tipo: 'traer_al_frente',
            id: id
        });
    }
}

export const moveToBack = (id: string, send = true) => {
    setNodes((nodes) => {
        const index = nodes.findIndex(n => n.id === id);
        if(index === -1) return nodes;

        const nodeToMode = [nodes[index]];
        const newNodes = [...nodes];
        newNodes.splice(index, 1);

        return nodeToMode.concat(newNodes);
    });

    if(send){
        sendEvent({
            tipo: 'enviar_al_fondo',
            id: id
        });
    }
}

export const updateNodeSize = (id: string, newWidth: number, newHeight: number) => {
    setNodes(
        (n) => n.id === id,
        (n) => ({ 
            ...n,
            width: newWidth,
            height: newHeight
        })
    );
}

export const updateNodeColor = (id: string, newColor: string, send = true) => {
    setNodes(
        (n) => n.id === id,
        (n) => ({
            ...n,
            color: newColor
        })
    );

    if(send){
        sendEvent({
            tipo: 'cambiar_color_nodo',
            color: newColor,
            id: id
        })
    }
}

export const updateNodoTitle = (id: string, newTitle: string, send = true) => {
    setNodes(
        (n) => n.id === id,
        "title", newTitle
    );

    if(send)
    sendEvent({
        tipo: 'cambiar_texto_nodo',
        texto: newTitle,
        id: id
    })
};

export const deleteNode = (id: string, send = true) => {
    setNodes(nodes.filter(n => n.id !== id));

    setConnections(
        connections.filter(conn => conn.from != id && conn.to != id)
    );

    if(send)
    sendEvent({
        tipo: "eliminar_nodo",
        id: id
    })
}

export const updateNodeRemote = (id: string, tx: number, ty: number) => {
    setNodes(n => n.id === id, {targetX : tx, targetY: ty});
};

export const updateNodeOpacity = (id:string, newOpacity: number, send = true) => {
    setNodes(n => n.id === id, "opacity", newOpacity);

    if(send){
        sendEvent({
            tipo: "cambiar_opacidad_nodo",
            id: id,
            opacidad: newOpacity
        })
    }
}

export const updateNodeRadius = (id:string, newRadius: number, send = true) => {
    setNodes(n => n.id === id, "radius", newRadius);

    if(send){
        sendEvent({
            tipo: "cambiar_radius_nodo",
            id: id,
            radius: newRadius
        })
    }
}

export const updateHeightFromText = (id: string) => {
    const node = nodes.find(n => n.id === id);

    if(node){

        const CK = nodusCanvas.getCK();

        const textStyle = new CK.TextStyle({
            color: CK.Color(0,0,0),
            fontFamilies: ['Inter 28pt Mudium']
        });

        const paragraphStyle = new CK.ParagraphStyle({
            textStyle: textStyle,
            textAlign: CK.TextAlign.Center,
        });

        const builder = CK.ParagraphBuilder.Make(paragraphStyle, nodusCanvas.getFont()!);
        builder.addText(node.title || "Nuevo Nodo");

        const paragraph = builder.build();
        paragraph.layout(node.width - 20);

        updateNodeSize(id, node.width, paragraph.getHeight() + 20);
        finalizeNodeSize(id);
    }
}

export const lockNode = (id: string, send = true) => {
    setNodes(n => n.id === id, "lock", true);

    if(send){
        sendEvent({
            tipo: 'bloquear_nodo',
            id: id
        });
    }
}

export const unLockNode = (id: string, send = true) => {
    setNodes(n => n.id === id, "lock", false);

    if(send){
        sendEvent({
            tipo: 'desbloquear_nodo',
            id: id
        });
    }
}

export const jumpToNode = (node: Node) => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    setOffset(centerX - ((node.x + node.width / 2) * scale), centerY - ((node.y + node.height / 2) * scale));

    setSelectedNodeId(node.id);
    setSelectedConnectionId(null);
    setIsCommandPaletteOpen(false);
};