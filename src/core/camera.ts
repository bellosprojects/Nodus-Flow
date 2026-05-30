import { Canvas } from "canvaskit-wasm";
import { createSignal } from "solid-js"
import { calculateDiagramBounds } from "../utils/path";
import { nodes } from "../models/nodes";

export const createCameraStore = () => {
    
    const [offsetX, setOffsetX] = createSignal(0);
    const [offsetY, setOffsetY] = createSignal(0);
    const [zoom, setZoom] = createSignal(1);

    const getDPR = () => Math.round(window.devicePixelRatio || 1);

    const centerOnPoint = (wordlX: number, wordlY: number) => {
        const newOffsetX = - wordlX * zoom() + window.innerWidth / 2;
        const newOffsetY = - wordlY * zoom() + window.innerHeight / 2;

        setOffsetX(newOffsetX);
        setOffsetY(newOffsetY);
    };

    const offsetToCenterPoint = (wordlX: number, wordlY: number, optionalZoom?: number) => {
        const offsetX = - wordlX * (optionalZoom || zoom()) + window.innerWidth / 2;
        const offsetY = - wordlY * (optionalZoom || zoom()) + window.innerHeight / 2;

        return {
            offsetX,
            offsetY
        }
    }

    const applyToCanvas = (canvas: Canvas) => {

        canvas.translate(offsetX(), offsetY());
        canvas.scale(zoom(), zoom());
    };

    const screenToWordl = (screenX: number, screenY: number) => {
        return {
            x: (screenX - offsetX()) / zoom(),
            y: (screenY - offsetY()) / zoom()
        };
    };

    const wordlToScreen = (wordlX: number, wordlY: number) => {
        return {
            x: (wordlX  * zoom() + offsetX()),
            y: (wordlY  * zoom() + offsetY())
        }
    }

    const zoomToFit = (width: number, height: number) => {
        const zoomX = (window.innerWidth - 40) / width;
        const zoomY = (window.innerHeight - 40) / height;

        return Math.max(0.1, Math.min(zoomX, zoomY, 5));
    }

    const getDiagramCenter = () => {
        const bounds = calculateDiagramBounds([...nodes]);
        return {x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2};
    }

    const getWorldCenter  = () => {
        return screenToWordl(window.innerWidth / 2, window.innerHeight / 2);
    }

    const isPointVisible = (wordlX: number, wordlY: number) => {
        const screen = wordlToScreen(wordlX, wordlY);
        return screen.x >= 0 && screen.y <= window.innerWidth && screen.y >= 0 && screen.y <= window.innerHeight;
    }

    const animateTo = (targetOffsetX: number, targetOffsetY: number, targetZoom: number, duration: number = 420) => {
        const startX = offsetX();
        const startY = offsetY();
        const startZoom = zoom();
        const startTime = Date.now();
        
        const animate = () => {
            const now = Date.now();
            const elapse = now - startTime;
            
            const t = Math.min(1, elapse / duration);

            const ease = t;

            setOffsetX(startX + (targetOffsetX - startX) * ease);
            setOffsetY(startY + (targetOffsetY - startY) * ease);
            setZoom(startZoom + (targetZoom - startZoom) * ease);

            if ( t < 1) requestAnimationFrame(animate);
            else {
                setOffsetX(targetOffsetX);
                setOffsetY(targetOffsetY);
                setZoom(targetZoom);
            }
        };

        requestAnimationFrame(animate);
    }

    const centerCameraNow = () => {
        const bound = calculateDiagramBounds([...nodes]);
        setZoom(Math.min(zoomToFit(bound.width, bound.height), 1));
        const center = getDiagramCenter();
        centerOnPoint(center.x, center.y);
    }

    const getWordlSize = () => {
        const width = window.innerWidth / zoom();
        const height = window.innerHeight / zoom();
        return {width, height};
    }

    return {
        offsetX, offsetY, zoom,
        setOffsetX, setOffsetY, setZoom,
        centerOnPoint,
        applyToCanvas,
        screenToWordl,
        wordlToScreen,
        getDPR,
        getWorldCenter,
        zoomToFit,
        isPointVisible,
        getDiagramCenter,
        animateTo,
        offsetToCenterPoint,
        centerCameraNow,
        getWordlSize
    };
}