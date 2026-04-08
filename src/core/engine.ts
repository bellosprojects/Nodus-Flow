// src/core/engine.ts
let fontData: ArrayBuffer | null = null;

export const getFontData = async () => {
    if (!fontData) {
        const response = await fetch('/fonts/Inter-Regular.ttf');
        fontData = await response.arrayBuffer();
    }
    return fontData;
};