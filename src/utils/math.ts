export const GRID_SIZE = 20;

export const snapToGrid = (value : number) => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
};

export const snapPoint = (x: number, y : number) => ({
    x: snapToGrid(x),
    y: snapToGrid(y),
});

export const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;