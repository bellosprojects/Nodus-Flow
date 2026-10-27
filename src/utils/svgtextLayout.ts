/**
 * Simula el layout de texto de CanvasKit para SVG
 */

export interface TextLayout {
    text: string;
    width: number;
    height: number;
    lines: string[];
    lineHeight: number;
    truncated: boolean;
}

/**
 * Estima la altura de un texto para un ancho dado
 * Simula el comportamiento de Paragraph.layout() de CanvasKit
 */
export function estimateTextLayout(
    text: string, 
    maxWidth: number, 
    fontSize: number = 15,
    fontFamily: string = "Inter, sans-serif"
): TextLayout {
    if (!text || text.trim() === "") {
        return {
            text: "",
            width: 0,
            height: 0,
            lines: [],
            lineHeight: fontSize * 1.2,
            truncated: false
        };
    }

    // Estimar ancho promedio de caracteres (aproximado para Inter)
    const charWidth = fontSize * 0.55;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";
    let truncated = false;

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const estimatedWidth = testLine.length * charWidth;
        
        if (estimatedWidth <= maxWidth) {
            currentLine = testLine;
        } else {
            // Guardar línea actual y empezar nueva
            if (currentLine) {
                lines.push(currentLine);
            }
            // Si una palabra sola es más larga que el ancho, truncarla
            if (word.length * charWidth > maxWidth) {
                // Truncar la palabra con "..."
                const availableChars = Math.floor((maxWidth - 20) / charWidth);
                if (availableChars > 3) {
                    lines.push(word.substring(0, availableChars) + "...");
                } else {
                    lines.push(word.substring(0, 3) + "...");
                }
                truncated = true;
            } else {
                currentLine = word;
            }
        }
    }

    if (currentLine) {
        // Verificar si la última línea excede el ancho
        if (currentLine.length * charWidth > maxWidth) {
            const availableChars = Math.floor((maxWidth - 20) / charWidth);
            if (availableChars > 3) {
                lines.push(currentLine.substring(0, availableChars) + "...");
            } else {
                lines.push(currentLine.substring(0, 3) + "...");
            }
            truncated = true;
        } else {
            lines.push(currentLine);
        }
    }

    // Si no hay líneas, usar el texto original truncado
    if (lines.length === 0 && text) {
        const maxChars = Math.floor(maxWidth / charWidth);
        if (maxChars > 3) {
            lines.push(text.substring(0, maxChars) + "...");
        } else {
            lines.push(text.substring(0, 3) + "...");
        }
        truncated = true;
    }

    const lineHeight = fontSize * 1.2;
    const height = lines.length * lineHeight;

    return {
        text,
        width: maxWidth,
        height,
        lines,
        lineHeight,
        truncated
    };
}

/**
 * Genera los elementos SVG para texto con layout
 * @param x - Posición X (depende del align: center = centro, left = borde izquierdo, right = borde derecho)
 * @param y - Posición Y (centro vertical del bloque de texto)
 */
export function renderTextToSvg(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number = 15,
    color: string = "#ffffff",
    align: "left" | "center" | "right" = "center",
    fontFamily: string = "Inter, sans-serif",
    textDecoration: string = ""
): string {
    if (!text || text.trim() === "") return "";

    const layout = estimateTextLayout(text, maxWidth, fontSize, fontFamily);
    if (layout.lines.length === 0) return "";

    let svg = "";
    const lineHeight = layout.lineHeight;
    
    // Calcular offset para centrar verticalmente
    const totalHeight = layout.lines.length * lineHeight;
    const startY = y - totalHeight / 2 + lineHeight / 2;

    layout.lines.forEach((line, index) => {
        let textX = x;
        const textY = startY + index * lineHeight;
        const lineWidth = line.length * 0.40 * fontSize;

        // Alineación horizontal
        if (align === "center") {
            // x es el centro
            textX = x - lineWidth / 2;
        } else if (align === "right") {
            // x es el borde derecho, el texto se alinea a la derecha
            // SVG text-anchor="end" coloca el texto a la izquierda de x
            textX = x;
        } else {
            // left: x es el borde izquierdo
            textX = x - lineWidth;
        }

        svg += `
            <text x="${textX}" y="${textY}" 
                fill="${color}" 
                font-size="${fontSize}" 
                text-anchor="${align}" 
                font-family="${fontFamily}"
                ${textDecoration}
            >${line}</text>
        `;
    });

    return svg;
}

/**
 * Calcula la altura de un bloque de texto para un ancho dado
 */
export function getTextHeight(text: string, maxWidth: number, fontSize: number = 15): number {
    if (!text || text.trim() === "") return 0;
    const layout = estimateTextLayout(text, maxWidth, fontSize);
    return layout.height;
}