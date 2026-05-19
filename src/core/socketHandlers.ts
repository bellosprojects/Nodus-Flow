import { createRemoteConnection, deleteConnection } from "../models/connections";
import { addRemoteNode, deleteNode, lockNode, moveToBack, moveToFront, unLockNode, updateNodeColor, updateNodeOpacity, updateNodeRadius, updateNodeRemote, updateNodeSize, updateNodoTitle } from "../models/nodes";
import { addPing } from "../models/ping";
import { setActiveUsers, updateCursor, User } from "../models/users";
import { updateCurrentProjectName } from "../models/userStore";
import { nodusCanvas } from "./NodusCanvas";

type SokectHandler = (data: any) => void;

export const eventHandlers: Record<string, SokectHandler> = {
    'nuevo_nodo': (data) => {
        const nodo = data.nodo;
        addRemoteNode(nodo.id, nodo.x, nodo.y, nodo.w, nodo.h, nodo.texto, nodo.color, nodo.opacidad, nodo.radius, nodo.pin);
    },
    'estado_inicial': (data) => {
        for(let nodo of data.nodos){
            addRemoteNode(nodo.id, nodo.x, nodo.y, nodo.w, nodo.h, nodo.texto, nodo.color, nodo.opacidad, nodo.radius, nodo.pin);
        }
        for(let conn of data.conexiones){
            createRemoteConnection(conn.id, conn.origenId, conn.destinoId, conn.style);
        }
        updateCurrentProjectName(data.nombre, false);
        nodusCanvas.camera.centerCameraNow();
    },
    'mover_nodos': (data) => {
        for(let nodo of data.nodos){
            updateNodeRemote(nodo.id, nodo.x, nodo.y);
        }
    },  
    'eliminar_nodo': (data) => {
        deleteNode(data.id, false);
    },
    'cambiar_texto_nodo': (data) => {
        updateNodoTitle(data.id, data.texto, false);
    },
    'cambiar_color_nodo': (data) => {
        updateNodeColor(data.id, data.color, false);
    },
    'users': (data) => {
        const newUsersList : User[] = [];
        for(let user of data.usuarios){
            const newUser: User = {
                nombre: user.nombre,
                color: user.color,
                x: user.x,
                y: user.y,
                object: user.objeto
            }
            newUsersList.push(newUser);
        }
        setActiveUsers(newUsersList);
    },
    'crear_conexion': (data) => {
        const conn = data.conexion;
        createRemoteConnection(conn.id, conn.origenId, conn.destinoId, conn.style);
    },
    'cambiar_opacidad_nodo': (data) => {
        updateNodeOpacity(data.id, data.opacidad, false);
    },
    'cambiar_radius_nodo': (data) => {
        updateNodeRadius(data.id, data.radius, false);
    },
    'cambiar_nombre_proyecto': (data) => {
        updateCurrentProjectName(data.nombre, false);
    },
    'redimensionar_nodo': (data) => {
        updateNodeSize(data.id, data.w, data.h);
    },
    'enviar_al_fondo': (data) => {
        moveToBack(data.id, false);
    },
    'traer_al_frente': (data) => {
        moveToFront(data.id, false);
    },
    'bloquear_nodo': (data) => {
        lockNode(data.id, false);
    },
    'desbloquear_nodo': (data) => {
        unLockNode(data.id, false);
    },
    'eliminar_conexion': (data) => {
        deleteConnection(data.id, false);
    },
    'mover_cursor': (data) => {
        updateCursor(data.nombre, data.x, data.y);
    },
    'ping_atencion': (data) => {
        addPing(data.x, data.y, data.color, data.nombre, false);
    }
};