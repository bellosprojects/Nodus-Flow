import { offsetX, offsetY, scale } from "../views/Editor/Editor";

export const GRID_SIZE = 20;

export const snapToGrid = (value : number) => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
};

export const snapPoint = (x: number, y : number) => ({
    x: snapToGrid(x),
    y: snapToGrid(y),
});

export const screenToWorld = (mouseX: number, mouseY: number) => {
    const dpr = window.devicePixelRatio || 1;
    return {
        x: (mouseX - offsetX / dpr) / (scale),
        y: (mouseY - offsetY / dpr) / (scale)
    };
};

export const center = () => {
    return screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
}

export const wordlToScreen = (wordlX: number, wordlY: number) => {
    const dpr = window.devicePixelRatio || 1;
    return {
        x: wordlX * scale + offsetX / dpr,
        y: wordlY * scale + offsetY / dpr
    }
}