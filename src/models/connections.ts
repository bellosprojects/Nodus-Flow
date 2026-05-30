import { createStore } from "solid-js/store";
import { sendEvent } from "../core/socket";
import { pushAction } from "../core/history";
import { createSignal } from "solid-js";

export interface Connection {
    id: string,
    from: string,
    to: string,
    tipo: number,
    properties: any
}

export const [connections, setConnections] = createStore<Connection[]>([]);

export const [selectedConnectionId, setSelectedConnectionId] = createSignal<string | null>(null);

export const selectedConnection = () => connections.find(conn => conn.id === selectedConnectionId());

export const addConnection = (fromId: string, toId: string) => {
    if(fromId === toId) return;

    const exist = connections.some(c => (c.from === fromId && c.to === toId));
    if(exist) return;

    const newID = Math.random().toString(36).substring(6);
    const newConn: Connection = { from: fromId, to: toId, id: newID, tipo: 1, properties: {} };

    setConnections([...connections, newConn]);

    sendEvent({
        tipo: 'crear_conexion',
        conexion: {
            id: newID,
            style: 1,
            origenId: fromId,
            destinoId: toId,
            properties: {}
        }
    });

    // history
    pushAction({
        label: `Connect '${fromId}' ↔ '${toId}'`,
        undo: () => {
            setConnections(conns => conns.filter(c => c.id !== newID));
            sendEvent({ tipo: "eliminar_conexion", id: newID });
        },
        redo: () => {
            setConnections(conns => [...conns, newConn]);
            sendEvent({
                tipo: 'crear_conexion',
                conexion: {
                    id: newID,
                    style: 1,
                    origenId: fromId,
                    destinoId: toId,
                    properties: {}
                }
            });
        }
    });
}

export const createRemoteConnection = (id: string, origen: string, destino: string, style: number, properties: any) => {

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
    const conn = connections.find(c => c.id === id);

    setConnections(connections.filter(conn => conn.id != id));

    if(send){
        sendEvent({
            tipo: "eliminar_conexion",
            id: id
        });

        // history
        pushAction({
            label: `Delete connection ${id}`,
            undo: () => {
                if(conn) {
                    setConnections(conns => [...conns, conn!]);
                    sendEvent({
                        tipo: 'crear_conexion',
                        conexion: {
                            id: conn!.id,
                            style: conn!.tipo,
                            origenId: conn!.from,
                            destinoId: conn!.to,
                            properties: conn!.properties
                        }
                    });
                }
            },
            redo: () => {
                setConnections(conns => conns.filter(c => c.id !== id));
                sendEvent({ tipo: "eliminar_conexion", id: id });
            }
        });
    }
}

export const changeConnectionStyle = (id: string, newStyle: number) => {
    const conn = connections.find(c => c.id === id);
    const prevStyle = conn ? conn.tipo : undefined;

    setConnections(conn => conn.id === id, "tipo", newStyle);

    sendEvent({
        tipo: "cambiar_estilo_conexion",
        id: id,
        estilo: newStyle
    });

    // history
    pushAction({
        label: `Change connection ${id} style to ${newStyle}`,
        undo: () => {
            if(prevStyle !== undefined){
                setConnections(c => c.id === id, "tipo", prevStyle);
                sendEvent({ tipo: "cambiar_estilo_conexion", id: id, estilo: prevStyle });
            }
        },
        redo: () => {
            setConnections(c => c.id === id, "tipo", newStyle);
            sendEvent({ tipo: "cambiar_estilo_conexion", id: id, estilo: newStyle });
        }
    });

}

export const connectionsByNode = (nodeId: string) => {
    return connections.filter(conn => conn.from === nodeId || conn.to == nodeId);
}

export const areConnected = (nodeId1: string, nodeId2: string) => {
    return connections.filter(conn => (conn.from === nodeId1 && conn.to === nodeId2) || (conn.from === nodeId2 && conn.to === nodeId1)).length > 0;
}

export const addConnectionProperty = (connId: string, propertyName: string, propertyValue: any, send = true) => {
    const conn = connections.find(c => c.id === connId);
    const prevValue = conn?.properties ? conn.properties[propertyName] : undefined;

    setConnections(conn => conn.id === connId, "properties", (props) => ({...props, [propertyName]: propertyValue}));

    if(send){
        sendEvent({
            tipo: "cambiar_conexion_property",
            id: connId,
            propertyName: propertyName,
            propertyValue: propertyValue
        });

        pushAction({
            label: `Set '${propertyName}'='${String(propertyValue)}' on connection ${connId}`,
            undo: () => {
                setConnections(c => c.id === connId, "properties", (props) => {
                    const newProps = {...props};
                    if(prevValue === undefined) delete newProps[propertyName];
                    else newProps[propertyName] = prevValue;
                    return newProps;
                });

                if(prevValue === undefined){
                    sendEvent({ tipo: "deletear_conexion_property", id: connId, propertyName: propertyName });
                } else {
                    sendEvent({ tipo: "cambiar_conexion_property", id: connId, propertyName: propertyName, propertyValue: prevValue });
                }
            },
            redo: () => {
                setConnections(c => c.id === connId, "properties", (props) => ({...props, [propertyName]: propertyValue}));
                sendEvent({ tipo: "cambiar_conexion_property", id: connId, propertyName: propertyName, propertyValue: propertyValue });
            }
        });
    }
}

export const deleteConnectionProperty = (connId: string, propertyName: string, send = true) => {
    const conn = connections.find(c => c.id === connId);
    const prevValue = conn?.properties ? conn.properties[propertyName] : undefined;

    setConnections(conn => conn.id === connId, "properties", (props) => {
        const newProps = {...props};
        delete newProps[propertyName];
        return newProps;
    });

    if(send){
        sendEvent({
            tipo: "deletear_conexion_property",
            id: connId,
            propertyName: propertyName
        });

        pushAction({
            label: `Delete '${propertyName}' from connection ${connId} (was: '${String(prevValue)}')`,
            undo: () => {
                if(prevValue !== undefined){
                    setConnections(c => c.id === connId, "properties", (props) => ({ ...props, [propertyName]: prevValue }));
                    sendEvent({ tipo: "cambiar_conexion_property", id: connId, propertyName: propertyName, propertyValue: prevValue });
                }
            },
            redo: () => {
                setConnections(c => c.id === connId, "properties", (props) => {
                    const newProps = {...props};
                    delete newProps[propertyName];
                    return newProps;
                });
                sendEvent({ tipo: "deletear_conexion_property", id: connId, propertyName: propertyName });
            }
        });
    }
}