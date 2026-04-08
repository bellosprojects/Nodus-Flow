import { createSignal } from "solid-js";
import { addRemoteNode, deleteNode, updateNodeColor, updateNodeOpacity, updateNodeRadius, updateNodeRemote, updateNodeSize, updateNodoTitle } from "../models/nodes";
import { randomColor } from "../utils/color";
import { throttle } from "../utils/network";
import { USER_AVATAR } from "../views/Editor/components/Toolbars";
import { createRemoteConnection } from "../models/connections";
import { updateCurrentProjectName, userData } from "../models/userStore";


export let socket : WebSocket | null = null;

export interface User {
    nombre: string,
    color: string
}

export const [users, setUsers] = createSignal<User[]>([]);

export function closeSocket(){
    socket = null;
}

export function initSocket(){
    
    const URL_SOCKET = `wss://render-yqtz.onrender.com/ws/${userData.roomId}/${userData.name || "Anonymous"}`;

    console.log(userData.roomId);

    socket = new WebSocket(URL_SOCKET);

    socket.addEventListener('open', () => {
        sendEvent({
            tipo : 'asignar_color_user',
            color: randomColor()
        });
    })

    socket.onmessage = (event) => {

        const data = JSON.parse(event.data);

        switch(data.tipo){
            case 'nuevo_nodo':
                const nodo = data.nodo;
                addRemoteNode(nodo.id, nodo.x, nodo.y, nodo.w, nodo.h, nodo.texto, nodo.color, nodo.opacidad, nodo.radius);
                break;
            case 'estado_inicial':
                for(let nodo of data.nodos){
                    addRemoteNode(nodo.id, nodo.x, nodo.y, nodo.w, nodo.h, nodo.texto, nodo.color, nodo.opacidad, nodo.radius);
                }
                for(let conn of data.conexiones){
                    createRemoteConnection(conn.id, conn.origenId, conn.destinoId, conn.style);
                }
                updateCurrentProjectName(data.nombre);
                break;
            case 'mover_nodo':
                updateNodeRemote(data.id, data.x, data.y);
                break;
            case 'eliminar_nodo':
                deleteNode(data.id, false);
                break;
            case 'cambiar_texto_nodo':
                updateNodoTitle(data.id, data.texto, false);
                break;
            case 'cambiar_color_nodo':
                updateNodeColor(data.id, data.color, false);
                break;
            case 'users':
                const newUsersList : User[] = [];
                for(let user of data.usuarios){
                    const newUser: User = {
                        nombre: user.nombre,
                        color: user.color
                    }
                    newUsersList.push(newUser);
                    setUsers(newUsersList);
                    updatePresence();
                }
                break;
            case 'crear_conexion':
                const conn = data.conexion;
                createRemoteConnection(conn.id, conn.origenId, conn.destinoId, conn.style);
                break;
            case 'cambiar_opacidad_nodo':
                updateNodeOpacity(data.id, data.opacidad, false);
                break;
            case 'cambiar_radius_nodo':
                updateNodeRadius(data.id, data.radius, false);
                break;
            case 'cambiar_nombre_proyecto':
                updateCurrentProjectName(data.nombre, false);
                break;
            case 'redimensionar_nodo':
                updateNodeSize(data.id, data.w, data.h);
                break;
        };

    };

};

function updatePresence(){
    const usersList = document.getElementById('users');

    if(usersList){
        usersList.innerHTML = '';

        for(let user of users()){
            const user_avatar = USER_AVATAR(user.nombre, user.color);
            usersList.appendChild(user_avatar as HTMLElement);
        }
    }
}

export const sendEvent = (payload: any) => {
    if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
    }
};

export const moveNodeThrottle = throttle((id: string, x : number, y : number) => {

    sendEvent({
        tipo: "mover_nodo",
        x: x,
        y: y,
        id: id
    });

}, 16);