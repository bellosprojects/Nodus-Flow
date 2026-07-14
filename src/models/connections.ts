import { createStore } from "solid-js/store";
import { wsService } from "../core/socket";
import { createMemo, createSignal } from "solid-js";
import { generarUUID } from "../utils/math";

export interface Connection {
    id: string,
    from: string, 
    to: string,
    tipo: number,
    properties: any
}

export const [connections, setConnections] = createStore<Connection[]>([]);

export const [selectedConnectionId, setSelectedConnectionId] = createSignal<string | null>(null);

export const selectedConnection = createMemo(() => connections.find(c => c.id === selectedConnectionId()));

export const addConnection = (fromId: string, toId: string) => {
    if(fromId === toId) return;

    const newID = generarUUID();
    const newConn: Connection = { from: fromId, to: toId, id: newID, tipo: 1, properties: {} };

    setConnections([...connections, newConn]);

    wsService.sendEvent({
        tipo: 'crear_conexion',
        conexion: {
            id: newID,
            style: 1,
            origenId: fromId,
            destinoId: toId,
            properties: {}
        }
    });

    return newConn;
}

export const createRemoteConnection = (id: string, origen: string, destino: string, style: number, properties: any) => {

    if([...connections].some(c => c.id === id)) return;

    const newConn : Connection = {
        id: id,
        from: origen,
        to: destino,
        tipo: style,
        properties: properties
    };

    setConnections([...connections, newConn]);
}

export const deleteConnection = (id: string, send = true) => {

    setConnections(connections.filter(conn => conn.id != id));

    if(send){
        wsService.sendEvent({
            tipo: "eliminar_conexion",
            id: id
        });
    }
}

export const changeConnectionStyle = (id: string, newStyle: number, send = true) => {

    setConnections(conn => conn.id === id, "tipo", newStyle);

    if(send)
    wsService.sendEvent({
        tipo: "cambiar_estilo_conexion",
        id: id,
        estilo: newStyle
    });

}

export const connectionsByNode = (nodeId: string) => {
    return connections.filter(conn => conn.from === nodeId || conn.to == nodeId);
}

export const areConnected = (nodeId1: string, nodeId2: string) => {
    return connections.filter(conn => (conn.from === nodeId1 && conn.to === nodeId2) || (conn.from === nodeId2 && conn.to === nodeId1)).length > 0;
}

export const addConnectionProperty = (connId: string, propertyName: string, propertyValue: any, send = true) => {

    setConnections(conn => conn.id === connId, "properties", (props) => ({...props, [propertyName]: propertyValue}));

    if(send){
        wsService.sendEvent({
            tipo: "cambiar_conexion_property",
            id: connId,
            propertyName: propertyName,
            propertyValue: propertyValue
        });
    }
}

export const deleteConnectionProperty = (connId: string, propertyName: string, send = true) => {

    setConnections(c => c.id === connId, (n) => {
        const newProperties = {...n.properties};
        delete newProperties[propertyName];
        return {
            ...n,
            properties: newProperties
        };
    });

    if(send){
        wsService.sendEvent({
            tipo: "deletear_conexion_property",
            id: connId,
            propertyName: propertyName
        });
    }
}