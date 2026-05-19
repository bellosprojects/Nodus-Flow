import { createStore } from "solid-js/store"

export interface User {
    nombre: string
    x: number,
    y: number,
    targetX?: number,
    targetY?: number,
    color: string,
    object?: string
};

export const [activeUsers, setActiveUsers] = createStore<User[]>([]);

export const updateCursor = (name: string, targetX: number, targetY : number) => {
    setActiveUsers(user => user.nombre === name, {
        targetX: targetX,
        targetY: targetY
    });
}