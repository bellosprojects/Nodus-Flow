export const GRID_SIZE = 20;

export const snapToGrid = (value : number) => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
};

export const snapPoint = (x: number, y : number) => ({
    x: snapToGrid(x),
    y: snapToGrid(y),
});

export const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';
const longitud = 12;

export const generarUUID = () => {
    
    const array = new Uint8Array(longitud);

    crypto.getRandomValues(array);

    let id = '';

    for(let i=0; i<array.length; i++){
        id += caracteres[array[i] % caracteres.length];
    }

    return id;
}