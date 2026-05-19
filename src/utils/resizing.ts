import { ANCHOR_POINT, focusedPoint } from "../core/renderer";
import { selectedNodes, updateNodeSize, updateNodoAbsolutePosition } from "../models/nodes";
import { referencePoint, resizingBox, resizingNodesCopy } from "../views/Editor/Editor";

/*

unidad * X + 60 = grande

X = (grande - 60) / unidad


*/

export const manageResizing = (mousePos: {x: number, y: number}) => {

    if(focusedPoint() === null || referencePoint() === null || resizingBox() === null){
        return;
    }

    if(focusedPoint()?.direction === ANCHOR_POINT.RIGHT){

        const box = resizingBox()!;
        const newAncho = mousePos.x - box.x;

        selectedNodes().forEach(node => {
            const originalNode = resizingNodesCopy.find(originalNode => originalNode.id === node.id);

            if(originalNode){
                const originalLeft = originalNode.x - box.x - 30;
                const originalRight = originalNode.x + originalNode.width - box.x - 30;

                const newLeft = box.x + 30 + (originalLeft === 0? 0 : (newAncho - 60));
                const newRight = box.x + 30 + (originalRight === 0? 0 : (newAncho - 60));
                const newWidth = Math.max(20, newRight - newLeft);

                updateNodoAbsolutePosition(node.id, newLeft, node.y);
                updateNodeSize(node.id, newWidth, node.height);
            }
        });

    } else if(focusedPoint()?.direction === ANCHOR_POINT.BOTTOM){

        selectedNodes().forEach(node => {
            
            updateNodeSize(node.id, node.width, mousePos.y - node.y - 30);

        });

    }

};