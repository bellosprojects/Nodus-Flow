import { Canvas } from "canvaskit-wasm";
import { createSignal } from "solid-js"
import { calculateDiagramBounds } from "../utils/path";
import { nodes } from "../models/nodes";

export const createCameraStore = () => {
    
    const [offsetX, _setOffsetX] = createSignal(0);
    const [offsetY, _setOffsetY] = createSignal(0);
    const [zoom, _setZoom] = createSignal(1);

    // --- INTERCEPTORES SEGUROS ---
    const setZoom = (value: number | ((prev: number) => number)) => {
        const next = typeof value === 'function' ? value(zoom()) : value;
        // Evitar NaN, Infinity, valores negativos o zooms absurdamente gigantes/pequeños
        if (isNaN(next) || !isFinite(next) || next <= 0.05 || next > 15) {
            console.warn("⚠️ Zoom extremo o inválido bloqueado:", next);
            return;
        }
        _setZoom(next);
    };

    const setOffsetX = (value: number | ((prev: number) => number)) => {
        const next = typeof value === 'function' ? value(offsetX()) : value;
        if (isNaN(next) || !isFinite(next)) {
            console.warn("⚠️ OffsetX inválido (NaN/Infinity) bloqueado");
            return;
        }
        _setOffsetX(next);
    };

    const setOffsetY = (value: number | ((prev: number) => number)) => {
        const next = typeof value === 'function' ? value(offsetY()) : value;
        if (isNaN(next) || !isFinite(next)) {
            console.warn("⚠️ OffsetY inválido (NaN/Infinity) bloqueado");
            return;
        }
        _setOffsetY(next);
    };

    const getDPR = () => Math.round(window.devicePixelRatio || 1);

    const centerOnPoint = (wordlX: number, wordlY: number) => {
        const z = zoom();
        // Validar que los puntos de entrada sean reales antes de operar
        if (!isFinite(wordlX) || !isFinite(wordlY)) return;

        const newOffsetX = - wordlX * z + window.innerWidth / 2;
        const newOffsetY = - wordlY * z + window.innerHeight / 2;

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
    const z = zoom();
    const x = offsetX();
    const y = offsetY();

    // Validar rigurosamente que los números sean reales y finitos
    if (!isFinite(z) || z <= 0 || !isFinite(x) || !isFinite(y)) {
        // Alerta en consola para que captures qué función del Editor está inyectando el NaN
        console.warn("⚠️ Cámara con valores inválidos (NaN/Infinity) prevenida:", { z, x, y });
        return; // Evita aplicar transformaciones corruptas al canvas
    }

    canvas.translate(x, y);
    canvas.scale(z, z);
}

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
        // Caso de seguridad: Si no hay nodos, no podemos enfocar nada. Ponemos valores por defecto seguros.
        if (!nodes || nodes.length === 0) {
            setOffsetX(0);
            setOffsetY(0);
            setZoom(1);
            return;
        }

        const bound = calculateDiagramBounds([...nodes]);
        
        // Si los límites son inválidos o colapsados (0px)
        if (bound.width <= 0 || bound.height <= 0 || !isFinite(bound.width) || !isFinite(bound.height)) {
            setOffsetX(0);
            setOffsetY(0);
            setZoom(1);
            return;
        }

        const fitZoom = zoomToFit(bound.width, bound.height);
        setZoom(Math.min(fitZoom, 1));
        
        const center = getDiagramCenter();
        if (isFinite(center.x) && isFinite(center.y)) {
            centerOnPoint(center.x, center.y);
        }
    }

    const getWordlSize = () => {
        const width = window.innerWidth / zoom();
        const height = window.innerHeight / zoom();
        return {width, height};
    }

    const getViewportBounds = () => {
        const wordlSize = getWordlSize();

        return {
            x: offsetX(),
            y: offsetY(),
            width: wordlSize.width,
            height: wordlSize.height
        }
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
        getWordlSize,
        getViewportBounds
    };
}