import { createStore } from "solid-js/store"
import { userData } from "./userStore";
import { nodusCanvas } from "../core/NodusCanvas";
import { showToast, ToastType } from "./toast";
import { wsService } from "../core/socket";
import { useUser } from "./users";

export interface Ping {
    id: string,
    x: number,
    y: number,
    color: string,
    startTime: number,
    name: string
}

export const [pings, setPings] = createStore<Ping[]>([]);

export const addPing = (x:number, y: number, color: string, name: string, send = true) => {
    
    if(!nodusCanvas.camera.isPointVisible(x, y) && !send){
        showToast(`"${name}" Sent a ping for attention`, ToastType.INFO, {
            action: () => {
                const offset = nodusCanvas.camera.offsetToCenterPoint(x, y, 1);
                nodusCanvas.camera.animateTo(offset.offsetX, offset.offsetY, 1);
            },
            label: "Go"
        });
    }

    const newId = Math.random().toString(36).substring(6).toUpperCase();
    
    const newPing : Ping = {
        id: newId,
        x: x,
        y: y,
        color: color,
        startTime: Date.now(),
        name: name
    }

    setPings([...pings, newPing]);

    setTimeout(() => {
        setPings(p => p.filter(item => item.id !== newId));
    }, 1500);

    if(send){
        wsService.sendEvent({
            tipo: "ping_atencion",
            x: x,
            y: y,
            color: color,
            nombre: useUser().name()
        });
    }
};