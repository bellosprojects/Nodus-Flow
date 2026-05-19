import { CanvasKit } from "canvaskit-wasm";
import { Node } from "../models/nodes";

const MARGIN = 50;
const PADDING = 5;

enum CONTROL_POINT {
    TOP = "TOP",
    BOTTOM = "BOTTOM",
    LEFT = "LEFT",
    RIGHT = "RIGHT"
}

const getPoint = (controlPoint: CONTROL_POINT, node: Node) => {
    switch(controlPoint) {
        case CONTROL_POINT.TOP:
            return { x: node.x + node.width / 2, y: node.y - PADDING};
        case CONTROL_POINT.BOTTOM:
            return { x: node.x + node.width / 2, y: node.y + node.height + PADDING};
        case CONTROL_POINT.LEFT:
            return { x: node.x - PADDING, y: node.y + node.height / 2 };
        case CONTROL_POINT.RIGHT:
            return { x: node.x + node.width + PADDING, y: node.y + node.height / 2 };
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
        { side: CONTROL_POINT.RIGHT,  dot:  dx },               // (1, 0)
        { side: CONTROL_POINT.LEFT,   dot: -dx },               // (-1,0)
        { side: CONTROL_POINT.BOTTOM, dot:  dy },               // (0, 1)
        { side: CONTROL_POINT.TOP,    dot: -dy }                // (0,-1)
    ];
    return dots.reduce((best, cur) => cur.dot > best.dot ? cur : best).side;
}

function getOutDirection(side: CONTROL_POINT) {
    switch(side) {
        case CONTROL_POINT.RIGHT:  return { x: 1, y: 0 };
        case CONTROL_POINT.LEFT:   return { x: -1, y: 0 };
        case CONTROL_POINT.BOTTOM: return { x: 0, y: 1 };
        case CONTROL_POINT.TOP:    return { x: 0, y: -1 };
    }
}

export function NodeToNode(CK : CanvasKit, node1 : Node, node2: Node){

    const path = new CK.Path();
    
    const c1 = centerOf(node1);
    const c2 = centerOf(node2);

    const side1 = getBestSide(node1, c2);
    const side2 = getBestSide(node2, c1);

    const start = getPoint(side1, node1);
    const end   = getPoint(side2, node2);

    const outDir = getOutDirection(side1);           // salida
    const inDir  = getOutDirection(side2);           // normal exterior destino

    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    const k = Math.min(50, dist * 0.4);              // longitud de la tangente

    const cp1 = { x: start.x + outDir.x * k, y: start.y + outDir.y * k };
    const cp2 = { x: end.x   + inDir.x * k, y: end.y   + inDir.y * k };

    path.moveTo(start.x, start.y);
    path.cubicTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);

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