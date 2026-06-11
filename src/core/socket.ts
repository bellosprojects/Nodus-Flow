import { randomColor } from "../utils/color";
import { throttle } from "../utils/network";
import { eventHandlers } from "./socketHandlers";
import { userData } from "../models/userStore";
import { removeToast, showToast, ToastType } from "../models/toast";

class WebSocketService {

    private socket : WebSocket | null = null;
    private reconnetAttemps = 0;
    private maxReconnectAttemps = 5;
    private baseDelay = 1000;
    private offlineQueue: any[] = [];
    private pingIntervalId: any = null;
    private isIntencionallyClosed = false;
    private confilctResolver: Map<string, number> = new Map();
    private lastSyncTimestamp: number = 0;

    public initSocket(){
        if(this.socket && this.socket.readyState == WebSocket.OPEN) return;

        this.isIntencionallyClosed = false;

        const URL_SOCKET = `wss://render-yqtz.onrender.com/ws/${userData.roomId}/${userData.name || "Anonymous"}`;

        console.log(`[WS] Conectando a la sala ${userData.roomId}...`);
        this.socket = new WebSocket(URL_SOCKET);

        this.setupEventListeners();
    }

    private setupEventListeners(){

        if(!this.socket) return;

        this.socket.addEventListener('open', () => {
            console.log(`[WS] Conectado con exito`);
            this.reconnetAttemps = 0;

            if(this.reconnetAttemps > 0){
                showToast("Conexion restablecida. Sincronizando...", ToastType.SUCCES);
            }

            this.sendEvent({
                tipo: 'asignar_color_user',
                color: randomColor()
            });

            this.flushOfflineQueue();

            this.startHeartbeat();
        });

        this.socket.addEventListener('message', (event) => {

            try {

                const data = JSON.parse(event.data);

                if(data.tipo === 'pong') return;

                const handler = eventHandlers[data.tipo];

                if(handler){
                    handler(data);
                } else {
                    console.warn(`[WS] Evento no reconocido: ${data.tipo}`);
                }

            } catch (e) {
                console.error("[WS] Error procesando mensaje de socket: ", e);
            }

        });

        this.socket.addEventListener('close', (event) => {

            this.stopHeartbeat();

            if(this.isIntencionallyClosed){
                console.log("[WS] Desconexion intencional por el usuario");
                return;
            }

            console.warn(`[WS] Conexion cerrada. Codigo: ${event.code}. Razon: ${event.reason}`);
            this.handleReconnect();

        });

        this.socket.addEventListener('error', (error) => {

            console.error("[WS] Error en el socket: ", error);

        });

    }

    private handleReconnect() {
        if(this.reconnetAttemps >= this.maxReconnectAttemps){
            showToast(
                "No se pudo restablecer la conexion. Los cambios se guardaron localmente.",
                ToastType.ERROR,
                {
                    label: "Guardar JSON",
                    action: () => {
                        import("../models/userStore").then(({ exportAsJson }) => exportAsJson());
                    }
                }
            );
            return;
        }

        this.reconnetAttemps++;

        const delay = Math.pow(2, this.reconnetAttemps) * this.baseDelay + Math.random() * 1000;

        const toastId = showToast(
            `Conexion perdida. Reconectando... (Intento ${this.reconnetAttemps}/${this.maxReconnectAttemps})`,
            ToastType.PROCESSING
        );

        setTimeout(() => {
            removeToast(toastId);
            this.initSocket();
        }, delay);
    }

    public sendEvent(payload: any, addToOfflineQueue = true){
        if(this.socket && this.socket.readyState === WebSocket.OPEN){
            this.socket.send(JSON.stringify(payload));
        } else if(addToOfflineQueue){
            console.warn("[WS] Socket Cerrado. Guardando evento en la cola offline.");

            this.offlineQueue.push(payload);

            showToast("Trabajando sin conexion. Tus cambios se guardaran localmente", ToastType.INFO);
        }
    }

    private flushOfflineQueue(){
        if(this.offlineQueue.length === 0) return;

        console.log(`[WS] Enviando ${this.offlineQueue.length} eventos pendientes...`);
        while(this.offlineQueue.length > 0 && this.socket?.readyState === WebSocket.OPEN){
            const nextEvent = this.offlineQueue.shift();
            this.socket.send(JSON.stringify(nextEvent));
        }
    }

    private startHeartbeat(){
        this.stopHeartbeat();
        this.pingIntervalId = setInterval(() => {

            if(this.socket && this.socket.readyState === WebSocket.OPEN){
                this.socket.send(JSON.stringify({ tipo: 'ping'}));
            }

        }, 3000);
    }

    private stopHeartbeat() {

        if(this.pingIntervalId){
            clearInterval(this.pingIntervalId);
            this.pingIntervalId = null;
        }

    }

    public closeSocket() {
        this.isIntencionallyClosed = true;
        this.stopHeartbeat();
        this.offlineQueue = [];

        if(this.socket){
            if(this.socket.readyState === WebSocket.OPEN){
                this.socket.close(1000, "Cierre voluntario del cliente");
            }
            this.socket = null;
        }
    }

    public isReady(){
        return this.socket && this.socket.readyState === WebSocket.OPEN;
    }

    private handleConflict(data: any): void {
        const confilctId = data.conflictId || `node_${data.nodeId}`;
        const serverVersion = data.serverVersion;
        const clientVersion = this.confilctResolver.get(confilctId) || 0;

        if(serverVersion > clientVersion){
            console.warn(`[WS] Conflicto detectado en ${confilctId}. Servidor tiene version mas reciente.`);

            showToast(
                `Conclicto detectado: ${data.description || "cambios en conflicto"}`,
                ToastType.ERROR,
                {
                    label: "Resolver",
                    action: () => {
                        this.sendEvent({ tipo: 'solicitar_estado_completo' });
                    }
                }
            );

            const pendingChanges = this.offlineQueue.filter(q => q.conflictId === confilctId || q.id === data.nodeId);

            if(pendingChanges.length > 0){
                localStorage.setItem(`pending_conflict_${confilctId}`, JSON.stringify(pendingChanges));
            }
        }
    }

}

export interface move {
    x: number,
    y: number,
    id: string
}

export const wsService = new WebSocketService();

export const moveNodeThrottle = throttle((nodes: move[]) => {

    wsService.sendEvent({
        tipo: "mover_nodos",
        nodos: nodes
    }, false);

}, 16);
