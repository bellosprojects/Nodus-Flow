import { randomColor } from "../utils/color";
import { throttle } from "../utils/network";
import { eventHandlers } from "./socketHandlers";
import { userData } from "../models/userStore";

export let socket : WebSocket | null = null;

export function closeSocket(){
    socket = null;
}

export function initSocket(){
    
    const URL_SOCKET = `wss://render-yqtz.onrender.com/ws/${userData.roomId}/${userData.name || "Anonymous"}`;

    console.log(`Entrando en sala ${userData.roomId}`);

    socket = new WebSocket(URL_SOCKET);

    socket.addEventListener('open', () => {
        sendEvent({
            tipo : 'asignar_color_user',
            color: randomColor()
        });
    });

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            const handler = eventHandlers[data.tipo];

            if(handler){
                handler(data);
            } else {
                console.warn(`Evento no reconocido: ${data.tipo}`);
            }
        } catch (e) {
            console.error("Error procesando mensaje del socket: ", e);
        }
    };

};

export const sendEvent = (payload: any) => {
    if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
    }
};

export interface move {
    x: number,
    y: number,
    id: string
}

export const moveNodeThrottle = throttle((nodes: move[]) => {

    sendEvent({
        tipo: "mover_nodos",
        nodos: nodes
    });

}, 16);