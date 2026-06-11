import { CanvasKit } from "canvaskit-wasm";
import { Node } from "../models/nodes";
import { Connection } from "../models/connections";
import { ANCHOR_POINT } from "../views/Editor/Editor";

const MARGIN = 50;
const PADDING = 5;

const getPoint = (controlPoint: ANCHOR_POINT, node: Node) => {
    switch(controlPoint) {
        case ANCHOR_POINT.TOP:
            return { x: node.x + node.width / 2, y: node.y - PADDING};
        case ANCHOR_POINT.BOTTOM:
            return { x: node.x + node.width / 2, y: node.y + node.height + PADDING};
        case ANCHOR_POINT.LEFT:
            return { x: node.x - PADDING, y: node.y + node.height / 2 };
        case ANCHOR_POINT.RIGHT:
            return { x: node.x + node.width + PADDING, y: node.y + node.height / 2 };
        case ANCHOR_POINT.TOP_LEFT:
            return { x: node.x - PADDING, y: node.y - PADDING };
        case ANCHOR_POINT.TOP_RIGHT:
            return { x: node.x + node.width + PADDING, y: node.y - PADDING };
        case ANCHOR_POINT.BOTTOM_LEFT:
            return { x: node.x - PADDING, y: node.y + node.height + PADDING };
        case ANCHOR_POINT.BOTTOM_RIGHT:
            return { x: node.x + node.width + PADDING, y: node.y + node.height + PADDING };
    }
};

function centerOf(node: Node){
    return {
        x: node.x + node.width / 2,
        y: node.y + node.height / 2
    }
}

function getBestSide(node: Node, targetCenter: {x: number, y: number}) {
    const c = centerOf(node);            // {x, y}
    const dx = targetCenter.x - c.x;
    const dy = targetCenter.y - c.y;

    // Productos escalares con las normales exteriores (derecha, izquierda, abajo, arriba)
    const dots = [
        { side: ANCHOR_POINT.RIGHT,  dot:  dx },               // (1, 0)
        { side: ANCHOR_POINT.LEFT,   dot: -dx },               // (-1,0)
        { side: ANCHOR_POINT.BOTTOM, dot:  dy },               // (0, 1)
        { side: ANCHOR_POINT.TOP,    dot: -dy }                // (0,-1)
    ];
    return dots.reduce((best, cur) => cur.dot > best.dot ? cur : best).side;
}

function getLocalSide(local?: string){
    switch(local){
        case "TOP": return ANCHOR_POINT.TOP;
        case "BOTTOM": return ANCHOR_POINT.BOTTOM;
        case "LEFT": return ANCHOR_POINT.LEFT;
        case "RIGHT": return ANCHOR_POINT.RIGHT;
        case "TOP_LEFT": return ANCHOR_POINT.TOP_LEFT;
        case "TOP_RIGHT": return ANCHOR_POINT.TOP_RIGHT;
        case "BOTTOM_LEFT": return ANCHOR_POINT.BOTTOM_LEFT;
        case "BOTTOM_RIGHT": return ANCHOR_POINT.BOTTOM_RIGHT;
        default: return null;
    }
}

function getOutDirection(side: ANCHOR_POINT) {
    switch(side) {
        case ANCHOR_POINT.RIGHT:        return { x: 1, y: 0 };
        case ANCHOR_POINT.LEFT:         return { x: -1, y: 0 };
        case ANCHOR_POINT.BOTTOM:       return { x: 0, y: 1 };
        case ANCHOR_POINT.TOP:          return { x: 0, y: -1 };
        case ANCHOR_POINT.TOP_LEFT:     return { x: -1, y: -1};
        case ANCHOR_POINT.TOP_RIGHT:    return { x: 1, y: -1};
        case ANCHOR_POINT.BOTTOM_LEFT:  return { x: -1, y: 1};
        case ANCHOR_POINT.BOTTOM_RIGHT: return { x: 1, y: 1};
    }
}

//const DIRECT_PATH = 0;
const CURVE_PATH = 1;
const CENTERS_PATH = 2;
const RECT_PATH = 3;
const RECT_PATH2 = 4;
const STEP_PATH = 5;
const STEP_PATH2 = 6;

export function NodeToNode(CK : CanvasKit, node1 : Node, node2: Node, conn: Connection) {

    const path = new CK.Path();
    
    const c1 = centerOf(node1);
    const c2 = centerOf(node2);

    const tipo = conn.tipo;

    if(tipo === CENTERS_PATH) return path.moveTo(c1.x, c1.y).lineTo(c2.x, c2.y);

    const side1 = getLocalSide(conn.properties.fromPoint) || getBestSide(node1, c2);
    const side2 = getLocalSide(conn.properties.toPoint) || getBestSide(node2, c1);

    const start = getPoint(side1, node1);
    const end   = getPoint(side2, node2);

    path.moveTo(start.x, start.y);

    if(tipo === CURVE_PATH){

        const outDir = getOutDirection(side1);           // salida
        const inDir  = getOutDirection(side2);           // normal exterior destino

        const dist = Math.hypot(end.x - start.x, end.y - start.y);
        const k = Math.min(50, dist * 0.4);              // longitud de la tangente

        const cp1 = { x: start.x + outDir.x * k, y: start.y + outDir.y * k };
        const cp2 = { x: end.x   + inDir.x * k, y: end.y   + inDir.y * k };

        path.cubicTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);

    } else if(tipo === RECT_PATH) {

        path.lineTo(start.x, end.y);

        path.lineTo(end.x, end.y);
    } else if(tipo === RECT_PATH2) {

        path.lineTo(end.x, start.y);
        path.lineTo(end.x, end.y);

    } else if(tipo === STEP_PATH) {
        path.lineTo(start.x, start.y + (end.y - start.y) / 2);
        path.lineTo(end.x, start.y + (end.y - start.y) / 2);

        path.lineTo(end.x, end.y);
    } else if(tipo === STEP_PATH2) {
        path.lineTo(start.x + (end.x - start.x) / 2, start.y);
        path.lineTo(start.x + (end.x - start.x) / 2, end.y);

        path.lineTo(end.x, end.y);
    } else {
        path.lineTo(end.x, end.y);
    }

    return path;
}

export const calculateDiagramBounds = (nodes: Node[]) => {
    if(nodes.length === 0) return {
        x: 0, y: 0, width: 100, height: 100
    };

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = - Infinity;

    nodes.forEach(node => {
        if(node.x < minX) minX = node.x;
        if(node.y < minY) minY = node.y;
        if(node.x + node.width > maxX) maxX = node.x + node.width;
        if(node.y + node.height > maxY) maxY = node.y + node.height;
    });

    return {
        x: minX - MARGIN,
        y: minY - MARGIN,
        width: (maxX - minX) + 2 * MARGIN,
        height: (maxY - minY) + 2 * MARGIN
    };
};