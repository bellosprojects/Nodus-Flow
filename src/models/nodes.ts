import { createStore } from "solid-js/store";
import { generarUUID, snapToGrid } from "../utils/math";
import { createEffect, createMemo, createSignal } from "solid-js";
import { connections, connectionsByNode, selectedConnectionId, setConnections, setSelectedConnectionId } from "./connections";
import { nodusCanvas } from "../core/NodusCanvas";
import {  setIsCommandPaletteOpen } from "../views/Editor/Editor";
import { activeUsers, useUser } from "./users";
import { showToast, ToastType } from "./toast";
import { calculateDiagramBounds } from "../utils/path";
import { wsService } from "../core/socket";
import { invalidateParagraphCache } from "../core/renderer";

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
    lock: boolean,
    style: number,
    properties: any
}

export const [nodes, setNodes] = createStore<Node[]>([]);

export const [selectedNodesIds, setSelectedNodesIds] = createSignal<string[]>([]);

export const selectedNodes = createMemo(() => {
    const ids = new Set(selectedNodesIds());

    return [...nodes].filter(node => ids.has(node.id));
});

createEffect(() => {
    const currentNodes = [...nodes];
    const currentIds = selectedNodesIds();

    const validIds = currentIds.filter(id => currentNodes.some(n => n.id === id));

    if(validIds.length !== currentIds.length)
    setSelectedNodesIds(validIds);
});

export const showPropertiesPanel = createMemo(() => selectedNodes().length === 1 || selectedConnectionId() !== null);

export const activeNode = createMemo(() => {
    const ids = selectedNodesIds();
    if (ids.length === 1) {
        const found = nodes.find(n => n.id === ids[0]);
        return found || null;
    }
    return null;
});

export const toolBeltPosition = createMemo(() => {
    const nodes = selectedNodes();
    if(nodes.length === 0) return null;

    const bounds = calculateDiagramBounds(nodes);
    const wordlPosition = nodusCanvas.camera.wordlToScreen(
        bounds.x + 50,
        bounds.y + 50
    );

    return {x: wordlPosition.x + 20, y: wordlPosition.y - 95};
});

export const [draggedNodeId, setDraggedNodeId] = createSignal<string | null>(null);

export const draggedNode = () => nodes.find(n => n.id === draggedNodeId());

export const getNode = (id: string) => nodes.find(n => n.id === id);

export const ocupadoPor = (id: string | null) => activeUsers.find(u => u.object === id && u.user_id !== useUser().id());

export const ocupar = (id:string | null) => {
    if(ocupadoPor(id)){

        showToast("Nodo bloqueado", ToastType.ERROR);

        return false;
    }

    if(id){
        const node = getNode(id);
        if(node){
            setSelectedNodesIds([node.id]);
        }
    }

    return true;
}

export const addNode = (x: number, y : number, name? : string) => {

    const newID = generarUUID();

    const newNode: Node = {
        id: newID,
        x,
        y,
        width: 160,
        height: 80,
        color: "#21a2a6",
        opacity: 1,
        radius: 8,
        lock: false,
        title: name,
        style: 1,
        properties: {}
    };

    setNodes([...nodes, newNode]);

    console.log("Nodo agregado:", newNode);

    wsService.sendEvent({
        tipo: "nuevo_nodo",
        nodo: {
            id: newID,
            w: 160, 
            h: 80,
            x: x,
            y: y,
            texto: name || "",
            color: "#21a2a6",
            opacidad: 1,
            radius: 8,
            pin: false,
            style: 1,
            properties: {}
        }
    });

    return newNode;
    
};

export const copyNode = (id: string, forceNewId? : string) => {
    const currentNode = nodes.find(n => n.id === id);

    if(currentNode){

        const newID = forceNewId || generarUUID();

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
            lock: currentNode.lock,
            style: currentNode.style,
            properties: {...currentNode.properties}
        };

        setNodes([...nodes, newNode]);

        wsService.sendEvent({
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
                pin: newNode.lock,
                style: newNode.style,
                properties: newNode.properties
            }
        });

        return newID;
    }
}

export const addRemoteNode = (
    id: string,
    x : number, 
    y : number, 
    w : number, 
    h : number, 
    text : string, 
    color : string, 
    opacidad: number, 
    radius: number, 
    lock: boolean, 
    style: number, 
    properties: any
) => {

    if([...nodes].some(n => n.id === id)) return;

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
        lock: lock,
        style: style,
        properties: properties
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

        wsService.sendEvent({
            tipo: 'mover_nodos',
            nodos: [{
                id: id,
                x: newX,
                y: newY
            }]
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

    const newNode = nodes.find(n => n.id === id);

    if(newNode){
        wsService.sendEvent({
            tipo: 'redimensionar_nodo',
            id: id,
            w: newNode.width,
            h: newNode.height,
            x: newNode.x,
            y: newNode.y
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
        wsService.sendEvent({
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
        wsService.sendEvent({
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
        wsService.sendEvent({
            tipo: 'cambiar_color_nodo',
            color: newColor,
            id: id
        });
    }
}

export const updateNodoTitle = (id: string, newTitle: string, send = true) => {

    setNodes(
        (n) => n.id === id,
        "title", newTitle
    );

    if(send){
        wsService.sendEvent({
            tipo: 'cambiar_texto_nodo',
            texto: newTitle,
            id: id
        });

    }
};

export const deleteNode = (id: string, send = true) => {

    setNodes(nodes.filter(n => n.id !== id));

    setConnections(
        connections.filter(conn => conn.from != id && conn.to != id)
    );

    if(send){
        wsService.sendEvent({
            tipo: "eliminar_nodo",
            id: id
        });

    }
}

export const updateNodeRemote = (id: string, tx: number, ty: number) => {
    setNodes(n => n.id === id, {targetX : tx, targetY: ty, x: tx, y: ty});
};

export const updateNodeOpacity = (id:string, newOpacity: number, send = true) => {

    setNodes(n => n.id === id, "opacity", newOpacity);

    if(send){
        wsService.sendEvent({
            tipo: "cambiar_opacidad_nodo",
            id: id,
            opacidad: newOpacity
        });

    }
}

export const updateNodeRadius = (id:string, newRadius: number, send = true) => {

    setNodes(n => n.id === id, "radius", newRadius);

    if(send){
        wsService.sendEvent({
            tipo: "cambiar_radius_nodo",
            id: id,
            radius: newRadius
        });
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
        wsService.sendEvent({
            tipo: 'bloquear_nodo',
            id: id
        });
    }

    moveToBack(id);
}

export const unLockNode = (id: string, send = true) => {

    setNodes(n => n.id === id, "lock", false);

    if(send){
        wsService.sendEvent({
            tipo: 'desbloquear_nodo',
            id: id
        });

    }
}

export const changeNodeStyle = (id: string, newStyle: number, send = true) => {

    setNodes(n => n.id === id, "style", newStyle);

    if(send)
    wsService.sendEvent({
        tipo: 'cambiar_estilo_nodo',
        id: id,
        estilo: newStyle
    });

}

export const jumpToNode = (node?: Node) => {

    if(!node) return;

    const offset = nodusCanvas.camera.offsetToCenterPoint(node.x + node.width / 2, node.y + node.height / 2, 1);
    nodusCanvas.camera.animateTo(offset.offsetX, offset.offsetY, 1);

    ocupar(node.id);
    setSelectedConnectionId(null);
    setIsCommandPaletteOpen(false);
};

export const deleteAllDisconnected = () => {
    [...nodes].forEach(node => {
        if(connectionsByNode(node.id).length === 0){
            deleteNode(node.id);
        }
    });
}

export const bulkDelete = () => {
    const targets = selectedNodes();
    targets.forEach(node => {
        deleteNode(node.id);
    });
    showToast(`${targets.length} nodes removed`);
};

export const bulkFitHeight = () => {
    const targets = selectedNodes();
    targets.forEach(node => {
        updateHeightFromText(node.id);
    });
};

export const bulkCopy = () => {
    const targets = selectedNodes();
    targets.forEach(node => {
        copyNode(node.id);
    });
};

export const bulkLock = () => {
    const targets = selectedNodes();
    targets.forEach(node => {
        lockNode(node.id);
    });
};

export const bulkUnLock = () => {
    const targets = selectedNodes();
    targets.forEach(node => {
        unLockNode(node.id);
    });
};

export const bulkToFront = () => {
    const targets = selectedNodes();
    targets.forEach(node => {
        moveToFront(node.id);
    });
}

export const bulkToBack = () => {
    const targets = selectedNodes();
    targets.forEach(node => {
        moveToBack(node.id);
    });
}

export const addNodeProperty = (id: string, propertyName: string, propertyValue: any, send = true) => {

    setNodes(n => n.id === id, (n) => ({
        ...n,
        properties: {
            ...n.properties,
            [propertyName]: propertyValue
        }
    }));

    invalidateParagraphCache();

    if(send){
        wsService.sendEvent({
            tipo: "cambiar_nodo_property",
            id: id,
            propertyName: propertyName,
            propertyValue: propertyValue
        });

    }
}

export const deleteNodeProperty = (id: string, propertyName: string, send = true) => {

    setNodes(n => n.id === id, (n) => {
        const newProperties = {...n.properties};
        delete newProperties[propertyName];
        return {
            ...n,
            properties: newProperties
        };
    });

    invalidateParagraphCache();

    if(send){
        wsService.sendEvent({
            tipo: "deletear_nodo_property",
            id: id,
            propertyName: propertyName
        });

    }
}       