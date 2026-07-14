import { addConnectionProperty, changeConnectionStyle, createRemoteConnection, deleteConnection, deleteConnectionProperty } from "../models/connections";
import { addNodeProperty, addRemoteNode, changeNodeStyle, deleteNode, deleteNodeProperty, lockNode, moveToBack, moveToFront, unLockNode, updateNodeColor, updateNodeOpacity, updateNodeRadius, updateNodeRemote, updateNodeSize, updateNodoTitle } from "../models/nodes";
import { addPing } from "../models/ping";
import { removeToast, showToast, ToastType } from "../models/toast";
import { setActiveUsers, updateCursor, User } from "../models/users";
import { addCurrentProjectProperty, deleteCurrentProjectProperty, setUserData, updateCurrentProjectName } from "../models/userStore";
import { nodusCanvas } from "./NodusCanvas";
import { initToastId, resetToast } from "./socket";

type SokectHandler = (data: any) => void;

export const eventHandlers: Record<string, SokectHandler> = {
    'nuevo_nodo': (data) => {
        const nodo = data.nodo;
        addRemoteNode(nodo.id, nodo.x, nodo.y, nodo.w, nodo.h, nodo.texto, nodo.color, nodo.opacidad, nodo.radius, nodo.pin, nodo.style, nodo.properties);
    },
    'estado_inicial': (data) => {
        for(let nodo of data.nodos){
            addRemoteNode(nodo.id, nodo.x, nodo.y, nodo.w, nodo.h, nodo.texto, nodo.color, nodo.opacidad, nodo.radius, nodo.pin, nodo.style, nodo.properties);
        }
        for(let conn of data.conexiones){
            createRemoteConnection(conn.id, conn.origenId, conn.destinoId, conn.style || 1, conn.properties || {});
        }
        setUserData("currentProjectProperties", data.propiedades);
        updateCurrentProjectName(data.nombre, false);
        nodusCanvas.camera.centerCameraNow();
        if(initToastId){
            removeToast(initToastId);
            resetToast();
        }
        showToast("Sala Cargada", ToastType.SUCCES);
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
                object: user.objeto,
                user_id: user.user_id
            }
            newUsersList.push(newUser);
        }
        setActiveUsers(newUsersList);
    },
    'crear_conexion': (data) => {
        const conn = data.conexion;
        createRemoteConnection(conn.id, conn.origenId, conn.destinoId, conn.style || 1, conn.properties || {});
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
        updateNodeRemote(data.id, data.x, data.y);
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
    },
    'cambiar_estilo_conexion': (data) => {
        changeConnectionStyle(data.id, data.estilo, false);
    },
    'cambiar_estilo_nodo': (data) => {
        changeNodeStyle(data.id, data.estilo, false);
    },
    'cambiar_nodo_property': (data) => {
        addNodeProperty(data.id, data.propertyName, data.propertyValue, false);
    },
    'deletear_nodo_property': (data) => {
        deleteNodeProperty(data.id, data.propertyName, false);
    },
    'cambiar_conexion_property': (data) => {
        addConnectionProperty(data.id, data.propertyName, data.propertyValue, false);
    },
    'deletear_conexion_property': (data) => {
        deleteConnectionProperty(data.id, data.propertyName, false);
    },
    'cambiar_proyecto_property': (data) => {
        addCurrentProjectProperty(data.propertyName, data.propertyValue, false);
    },
    'deletear_proyecto_property': (data) => {
        deleteCurrentProjectProperty(data.propertyName, false);
    }
};