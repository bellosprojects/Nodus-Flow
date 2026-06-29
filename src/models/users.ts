import { createStore } from "solid-js/store"
import { authStore } from "./authStore";

export interface User {
    nombre: string,
    user_id?: string,
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

export const useUser = () => {
    const displayName = () => authStore.user?.display_name || "Anonymous"
    const userId = () => authStore.user?.id || null
    const isAuthenticated = () => authStore.isAuthenticated

    return {
        name: displayName,
        id: userId,
        isAuthenticated
    };
};