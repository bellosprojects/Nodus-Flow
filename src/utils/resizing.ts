import { ANCHOR_POINT, focusedPoint } from "../core/renderer";
import { selectedNodes, updateNodeSize, updateNodoAbsolutePosition } from "../models/nodes";
import { referencePoint, resizingBox, resizingNodesCopy } from "../views/Editor/Editor";

/*

(unidad / anchoOriginal) * nuevoAncho

*/

export const manageResizing = (mousePos: {x: number, y: number}) => {

    if(focusedPoint() === null || referencePoint() === null || resizingBox() === null){
        return;
    }

    if(focusedPoint()?.direction === ANCHOR_POINT.RIGHT){

        const box = resizingBox()!;
        const nuevoAncho = mousePos.x - box.x - 60;
        const anchoOriginal = referencePoint()!.x - box.x - 60;

        const calc = (unidad: number) => (unidad / anchoOriginal) * nuevoAncho;

        selectedNodes().forEach(node => {
            const originalNode = resizingNodesCopy.find(originalNode => originalNode.id === node.id);

            if(originalNode){

                const newX = box.x + 30 + calc(originalNode.x - box.x - 30);

                updateNodoAbsolutePosition(node.id, newX, originalNode.y);
                updateNodeSize(node.id, Math.max(calc(originalNode.width), 60), Math.max(originalNode.height, 40));
            }
        });

    } else if(focusedPoint()?.direction === ANCHOR_POINT.BOTTOM){

        const box = resizingBox()!;
        const nuevoAlto = mousePos.y - box.y - 60;
        const altoOriginal = referencePoint()!.y - box.y - 60;

        const calc = (unidad: number) => (unidad / altoOriginal) * nuevoAlto;

        selectedNodes().forEach(node => {
            const originalNode = resizingNodesCopy.find(originalNode => originalNode.id === node.id);

            if(originalNode){

                const newY = box.y + 30 + calc(originalNode.y - box.y - 30);

                updateNodoAbsolutePosition(node.id, originalNode.x, newY);
                updateNodeSize(node.id, Math.max(originalNode.width, 60), Math.max(calc(originalNode.height), 40));
            }
        });

    } else if(focusedPoint()?.direction == ANCHOR_POINT.BOTTOM_RIGHT){

        const box = resizingBox()!;
        const nuevoAlto = mousePos.y - box.y - 60;
        const altoOriginal = referencePoint()!.y - box.y - 60;
        const nuevoAncho = mousePos.x - box.x - 60;
        const anchoOriginal = referencePoint()!.x - box.x - 60;

        const calcY = (unidad: number) => (unidad / altoOriginal) * nuevoAlto;
        const calcX = (unidad: number) => (unidad / anchoOriginal) * nuevoAncho;

        selectedNodes().forEach(node => {
            const originalNode = resizingNodesCopy.find(originalNode => originalNode.id === node.id);

            if(originalNode){

                const newY = box.y + 30 + calcY(originalNode.y - box.y - 30);
                const newX = box.x + 30 + calcX(originalNode.x - box.x - 30);

                updateNodoAbsolutePosition(node.id, newX, newY);
                updateNodeSize(node.id, Math.max(calcX(originalNode.width), 60), Math.max(calcY(originalNode.height), 40));
            }
        });

    } else if(focusedPoint()?.direction == ANCHOR_POINT.LEFT){

        const box = resizingBox()!;
        const nuevoAncho = box.x + box.width - mousePos.x - 60;
        const anchoOriginal = box.x + box.width - referencePoint()!.x - 60;

        const calc = (unidad: number) => (unidad / anchoOriginal) * nuevoAncho;

        selectedNodes().forEach(node => {
            const originalNode = resizingNodesCopy.find(originalNode => originalNode.id === node.id);

            if(originalNode){

                const newX = mousePos.x + 30 + calc(originalNode.x - box.x - 30);

                updateNodoAbsolutePosition(node.id, newX, originalNode.y);
                updateNodeSize(node.id, Math.max(calc(originalNode.width), 60), Math.max(originalNode.height, 40));
            }
        });

    } else if(focusedPoint()?.direction == ANCHOR_POINT.TOP){

        const box = resizingBox()!;
        const nuevoAlto = box.y + box.height - mousePos.y - 60;
        const altoOriginal = box.y + box.height - referencePoint()!.y - 60;

        const calc = (unidad: number) => (unidad / altoOriginal) * nuevoAlto;

        selectedNodes().forEach(node => {
            const originalNode = resizingNodesCopy.find(originalNode => originalNode.id === node.id);

            if(originalNode){

                const newY = mousePos.y + 30 + calc(originalNode.y - box.y - 30);

                updateNodoAbsolutePosition(node.id, originalNode.x, newY);
                updateNodeSize(node.id, Math.max(originalNode.width, 60), Math.max(calc(originalNode.height), 40));
            }
        });

    } else if(focusedPoint()?.direction == ANCHOR_POINT.TOP_RIGHT){

        const box = resizingBox()!;
        const nuevoAlto = box.y + box.height - mousePos.y - 60;
        const altoOriginal = box.y + box.height - referencePoint()!.y - 60;
        const nuevoAncho = mousePos.x - box.x - 60;
        const anchoOriginal = referencePoint()!.x - box.x - 60;

        const calcY = (unidad: number) => (unidad / altoOriginal) * nuevoAlto;
        const calcX = (unidad: number) => (unidad / anchoOriginal) * nuevoAncho;

        selectedNodes().forEach(node => {
            const originalNode = resizingNodesCopy.find(originalNode => originalNode.id === node.id);

            if(originalNode){

                const newY = mousePos.y + 30 + calcY(originalNode.y - box.y - 30);
                const newX = box.x + 30 + calcX(originalNode.x - box.x - 30);

                updateNodoAbsolutePosition(node.id, newX, newY);
                updateNodeSize(node.id, Math.max(calcX(originalNode.width), 60), Math.max(calcY(originalNode.height), 40));
            }
        });

    } else if(focusedPoint()?.direction == ANCHOR_POINT.BOTTOM_LEFT){

        const box = resizingBox()!;
        const nuevoAlto = mousePos.y - box.y - 60;
        const altoOriginal = referencePoint()!.y - box.y - 60;
        const nuevoAncho = box.x + box.width - mousePos.x - 60;
        const anchoOriginal = box.x + box.width - referencePoint()!.x - 60;

        const calcY = (unidad: number) => (unidad / altoOriginal) * nuevoAlto;
        const calcX = (unidad: number) => (unidad / anchoOriginal) * nuevoAncho;

        selectedNodes().forEach(node => {
            const originalNode = resizingNodesCopy.find(originalNode => originalNode.id === node.id);

            if(originalNode){

                const newY = box.y + 30 + calcY(originalNode.y - box.y - 30);
                const newX = mousePos.x + 30 + calcX(originalNode.x - box.x - 30);

                updateNodoAbsolutePosition(node.id, newX, newY);
                updateNodeSize(node.id, Math.max(calcX(originalNode.width), 60), Math.max(calcY(originalNode.height), 40));
            }
        });

    } else if(focusedPoint()?.direction == ANCHOR_POINT.TOP_LEFT){

        const box = resizingBox()!;
        const nuevoAlto = box.y + box.height - mousePos.y - 60;
        const altoOriginal = box.y + box.height - referencePoint()!.y - 60;
        const nuevoAncho = box.x + box.width - mousePos.x - 60;
        const anchoOriginal = box.x + box.width - referencePoint()!.x - 60;

        const calcY = (unidad: number) => (unidad / altoOriginal) * nuevoAlto;
        const calcX = (unidad: number) => (unidad / anchoOriginal) * nuevoAncho;

        selectedNodes().forEach(node => {
            const originalNode = resizingNodesCopy.find(originalNode => originalNode.id === node.id);

            if(originalNode){

                const newY = mousePos.y + 30 + calcY(originalNode.y - box.y - 30);
                const newX = mousePos.x + 30 + calcX(originalNode.x - box.x - 30);

                updateNodoAbsolutePosition(node.id, newX, newY);
                updateNodeSize(node.id, Math.max(calcX(originalNode.width), 60), Math.max(calcY(originalNode.height), 40));
            }
        });

    }

};