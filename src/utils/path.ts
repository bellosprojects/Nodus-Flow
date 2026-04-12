import { CanvasKit } from "canvaskit-wasm";
import { Node } from "../models/nodes";

export function NodeToNode(CK : CanvasKit, node1 : Node, node2: Node){

    const p = new CK.Path();
    
    const startX = node1.x + node1.width;
    const startY = node1.y + node1.height / 2;
    
    const endX = node2.x;
    const endY = node2.y + node2.height / 2;
    
    const controlP = startX + (endX - startX) / 2;
    
    p.moveTo(startX, startY);
    p.cubicTo(controlP, startY, controlP, endY, endX, endY);

    return p;
}