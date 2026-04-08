import { createStore } from "solid-js/store";
import { sendEvent } from "../core/socket";

export interface Connection {
    id: string,
    from: string,
    to: string,
    tipo: number
}

export const [connections, setConnections] = createStore<Connection[]>([]);

export const addConnection = (fromId: string, toId: string) => {
    if(fromId === toId) return;

    const exist = connections.some(c => (c.from === fromId && c.to === toId));
    if(exist) return;

    const newID = Math.random().toString(36).substring(6);

    setConnections([...connections, {from: fromId, to: toId, id: newID, tipo: 1 }]);

    sendEvent({
        tipo: 'crear_conexion',
        conexion: {
            id: newID,
            style: 1,
            origenId: fromId,
            destinoId: toId
        }
    });
}

export const createRemoteConnection = (id: string, origen: string, destino: string, style: number) => {

    const newConn : Connection = {
        id: id,
        from: origen,
        to: destino,
        tipo: style
    };

    setConnections([...connections, newConn]);
}