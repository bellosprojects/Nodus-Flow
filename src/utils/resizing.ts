import { focusedPoint } from "../core/renderer";
import { selectedNodes, updateNodeSize, updateNodoAbsolutePosition } from "../models/nodes";
import { referencePoint, resizingBox, resizingNodesCopy, ANCHOR_POINT } from "../views/Editor/Editor";

const MIN_NODE_WIDTH = 60;
const MIN_NODE_HEIGHT = 40;

export const manageResizing = (mousePos: {x: number, y: number}) => {
    const point = focusedPoint();
    const box = resizingBox();
    const handle = referencePoint();

    if(!point || !box || !handle || box.width <= 0 || box.height <= 0) return;

    const direction = point.direction;
    const resizeFromLeft = direction === ANCHOR_POINT.LEFT ||
        direction === ANCHOR_POINT.TOP_LEFT ||
        direction === ANCHOR_POINT.BOTTOM_LEFT;
    const resizeFromRight = direction === ANCHOR_POINT.RIGHT ||
        direction === ANCHOR_POINT.TOP_RIGHT ||
        direction === ANCHOR_POINT.BOTTOM_RIGHT;
    const resizeFromTop = direction === ANCHOR_POINT.TOP ||
        direction === ANCHOR_POINT.TOP_LEFT ||
        direction === ANCHOR_POINT.TOP_RIGHT;
    const resizeFromBottom = direction === ANCHOR_POINT.BOTTOM ||
        direction === ANCHOR_POINT.BOTTOM_LEFT ||
        direction === ANCHOR_POINT.BOTTOM_RIGHT;

    const rightEdge = box.x + box.width;
    const bottomEdge = box.y + box.height;

    const requestedWidth = resizeFromLeft
        ? rightEdge - mousePos.x - box.x + handle.x
        : mousePos.x + rightEdge - handle.x - box.x;
    const requestedHeight = resizeFromTop
        ? bottomEdge - mousePos.y - box.y + handle.y
        : mousePos.y + bottomEdge - handle.y - box.y;

    const minScaleX = resizingNodesCopy.reduce(
        (minimum, node) => Math.max(minimum, MIN_NODE_WIDTH / node.width),
        0
    );
    const minScaleY = resizingNodesCopy.reduce(
        (minimum, node) => Math.max(minimum, MIN_NODE_HEIGHT / node.height),
        0
    );
    const scaleX = resizeFromLeft || resizeFromRight
        ? Math.max(minScaleX, requestedWidth / box.width)
        : 1;
    const scaleY = resizeFromTop || resizeFromBottom
        ? Math.max(minScaleY, requestedHeight / box.height)
        : 1;

    selectedNodes().forEach(node => {
        const originalNode = resizingNodesCopy.find(original => original.id === node.id);
        if(!originalNode) return;

        const newX = resizeFromLeft
            ? rightEdge - (rightEdge - originalNode.x) * scaleX
            : resizeFromRight
                ? box.x + (originalNode.x - box.x) * scaleX
                : originalNode.x;
        const newY = resizeFromTop
            ? bottomEdge - (bottomEdge - originalNode.y) * scaleY
            : resizeFromBottom
                ? box.y + (originalNode.y - box.y) * scaleY
                : originalNode.y;

        updateNodoAbsolutePosition(node.id, newX, newY);
        updateNodeSize(
            node.id,
            resizeFromLeft || resizeFromRight ? originalNode.width * scaleX : originalNode.width,
            resizeFromTop || resizeFromBottom ? originalNode.height * scaleY : originalNode.height
        );
    });
};
