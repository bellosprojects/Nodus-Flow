import { throttle } from "../utils/network";
import { eventHandlers } from "./socketHandlers";
import { userData } from "../models/userStore";
import { removeToast, showToast, ToastType } from "../models/toast";
import { authStore } from "../models/authStore";
import { randomColor } from "../utils/color";

export let initToastId : number | null = null;

export const resetToast = () => {
    initToastId = null;
}

class WebSocketService {

    private socket : WebSocket | null = null;
    private reconnetAttemps = 0;
    private maxReconnectAttemps = 10;
    private baseDelay = 1000;
    private offlineQueue: any[] = [];
    private pingIntervalId: any = null;
    private isIntencionallyClosed = false;
    private reconnectTimeoutId: any = null;
    private isConnecting = false;
    private toastId: number = -1;

    public initSocket() {

        initToastId = showToast("Cargando Sala", ToastType.PROCESSING);

        // Evitar múltiples conexiones simultáneas
        if (this.isConnecting) return;
        if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
        if (this.socket && this.socket.readyState === WebSocket.CONNECTING) return;

        this.isConnecting = true;
        this.isIntencionallyClosed = false;

        const token = authStore.token;
        if (!token) {
            console.error("No auth token, cannot connect WebSocket");
            this.isConnecting = false;
            return;
        }

        const URL_SOCKET = `wss://render-yqtz.onrender.com/ws/${userData.roomId}?token=${token}`;
        console.log(`[WS] Conectando a la sala ${userData.roomId}...`);
        
        this.socket = new WebSocket(URL_SOCKET);
        this.setupEventListeners();
    }

    private setupEventListeners() {
        if (!this.socket) return;

        this.socket.addEventListener('open', () => {
            console.log(`[WS] Conectado con éxito`);
            this.isConnecting = false;
            this.reconnetAttemps = 0;
            
            // Limpiar el timeout de reconexión si existe
            if (this.reconnectTimeoutId) {
                clearTimeout(this.reconnectTimeoutId);
                this.reconnectTimeoutId = null;
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
                if (data.tipo === 'pong') return;
                
                const handler = eventHandlers[data.tipo];
                if (handler) {
                    handler(data);
                } else {
                    console.warn(`[WS] Evento no reconocido: ${data.tipo}`);
                }
            } catch (e) {
                console.error("[WS] Error procesando mensaje:", e);
            }
        });

        this.socket.addEventListener('close', (event) => {
            this.stopHeartbeat();
            this.isConnecting = false;
            
            // Limpiar cualquier timeout pendiente
            if (this.reconnectTimeoutId) {
                clearTimeout(this.reconnectTimeoutId);
                this.reconnectTimeoutId = null;
            }

            if (this.isIntencionallyClosed) {
                console.log("[WS] Desconexión intencional por el usuario");
                this.offlineQueue = [];
                return;
            }

            console.warn(`[WS] Conexión cerrada. Código: ${event.code}. Razón: ${event.reason}`);
            
            // Si es rate limiting, esperar más tiempo
            const isRateLimit = event.reason?.includes("rate") || event.reason?.includes("Too many");
            const delay = isRateLimit ? 5000 : Math.pow(2, this.reconnetAttemps) * this.baseDelay;
            
            this.handleReconnect(delay);
        });

        this.socket.addEventListener('error', (error) => {
            console.error("[WS] Error en el socket:", error);
            // No cerrar aquí, el evento 'close' manejará la reconexión
        });
    }

    private handleReconnect(delay?: number) {
        if (this.reconnetAttemps >= this.maxReconnectAttemps) {
            showToast(
                "No se pudo restablecer la conexión. Los cambios se guardaron localmente.",
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
        const actualDelay = delay || Math.pow(2, this.reconnetAttemps) * this.baseDelay + Math.random() * 1000;

        console.log(`[WS] Reintentando conexión en ${actualDelay}ms (intento ${this.reconnetAttemps}/${this.maxReconnectAttemps})`);

        // Mostrar toast solo en intentos importantes
        if (this.reconnetAttemps > 2) {

            this.toastId = showToast(
                `Reconectando... (Intento ${this.reconnetAttemps}/${this.maxReconnectAttemps})`,
                ToastType.PROCESSING
            );
        }

        // Programar reconexión
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
        }
        
        this.reconnectTimeoutId = setTimeout(() => {
            if (!this.isIntencionallyClosed) {
                this.initSocket();
            }
            this.reconnectTimeoutId = null;
            if(this.toastId > 0){
                removeToast(this.toastId);
                this.toastId = -1;
            }
        }, actualDelay);
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
        
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }

        if (this.socket) {
            if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
                this.socket.close(1000, "Cierre voluntario del cliente");
            }
            this.socket = null;
        }
        this.isConnecting = false;
    }

    public isReady(){
        return this.socket && this.socket.readyState === WebSocket.OPEN;
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
