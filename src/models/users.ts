import { createStore } from "solid-js/store"

export interface User {
    nombre: string
    x: number,
    y: number,
    color: string,
    object?: string
};

export const [activeUsers, setActiveUsers] = createStore<User[]>([]);