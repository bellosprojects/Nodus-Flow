import { createStore } from "solid-js/store";
import { wsService } from "../core/socket";
import { nodes } from "./nodes";
import { connections } from "./connections";
import { showToast, ToastType } from "./toast";


const roomId = localStorage.getItem("nodus_room_id") || "0000000000";
const lastUsedRoom = localStorage.getItem("last_used_room") || "";

const [userData, setUserData] = createStore({
    roomId: roomId,
    lastRoom: lastUsedRoom,
    currentProjectName: '',
    oldProjectName: '',
    currentProjectProperties: {} as Record<string, any>
});


export const updateRoomId = (newRoomId: string) => {
    setUserData("roomId", newRoomId);
    localStorage.setItem("nodus_room_id", newRoomId);
    updateLastRoomUsed(newRoomId);
}

export const updateLastRoomUsed = (newRoomId: string) => {
    setUserData("lastRoom", newRoomId);
    localStorage.setItem("last_used_room", newRoomId);
};

export const updateCurrentProjectName = (newProjectName: string, send = true) => {
    setUserData("currentProjectName", newProjectName);

    if(send)
    wsService.sendEvent({
        'tipo': 'cambiar_nombre_proyecto',
        'nombre': newProjectName
    });
};

export const addCurrentProjectProperty = (propertyName: string, propertyValue: any, send = true) => {

    const properties = {
        ...userData.currentProjectProperties,
        [propertyName]: propertyValue
    };

    setUserData("currentProjectProperties", properties);

    if(send){
        wsService.sendEvent({
            'tipo': 'cambiar_proyecto_property',
            'propertyName': propertyName,
            'propertyValue': propertyValue
        });
    }

};

export const deleteCurrentProjectProperty = (propertyName: string, send = true) => {

    const properties = {
        ...userData.currentProjectProperties,
        [propertyName]: undefined
    };

    setUserData("currentProjectProperties", properties);

    console.log("Nuevas propiedades:", userData.currentProjectProperties);

    if(send){
        wsService.sendEvent({
            'tipo': 'deletear_proyecto_property',
            'propertyName': propertyName
        });
    }
};

export { userData, setUserData };

export const exportAsJson = () => {
    const data = {
        version: "1.0",
        name: userData.currentProjectName,
        nodes: nodes.map(node => ({
            id: node.id,
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
            color: node.color,
            opacity: node.opacity,
            radius: node.radius,
            lock: node.lock,
            title: node.title,
            style: node.style,
            properties: node.properties
        })),
        connections: connections.map(conn => ({
            id: conn.id,
            from: conn.from,
            to: conn.to,
            tipo: conn.tipo,
            properties: conn.properties
        })),
        properties: userData.currentProjectProperties,
        exportDate: new Date().toISOString(),
        nodeCount: nodes.length,
        connectionCount: connections.length
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${userData.currentProjectName || "nodus_project"}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    console.log("Exporting JSON with", data.nodes.length, "nodes and", data.connections.length, "connections");
    showToast(`Exportado: ${data.nodes.length} nodos, ${data.connections.length} conexiones`, ToastType.SUCCES);
};