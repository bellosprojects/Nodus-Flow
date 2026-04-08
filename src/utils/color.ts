export function HexToColor(hex: string){

    hex = hex.replace("#", '').toUpperCase();
    const r = hex.substring(0, 2);
    const g = hex.substring(2, 4);
    const b = hex.substring(4, 6);

    const rInt = parseInt(r, 16);
    const gInt = parseInt(g, 16);
    const bInt = parseInt(b, 16);

    return [rInt, gInt, bInt];
}

const HEX_TABLE = [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
];

export function randomColor(){

    const rojo = HEX_TABLE[Math.round(Math.random() * 8)] + HEX_TABLE[Math.round(Math.random() * 15)];
    const verde = HEX_TABLE[Math.round(Math.random() * 5)] + HEX_TABLE[Math.round(Math.random() * 15)];
    const azul = HEX_TABLE[Math.round(Math.random() * 3)] + HEX_TABLE[Math.round(Math.random() * 15)];

    return "#" + rojo + verde + azul;
}

export function obtenerColorTexto(colorHex: string){

    const hex = colorHex.replace('#', '');

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

    return brightness > 0.5? "#000000" : "#FFFFFF";
}