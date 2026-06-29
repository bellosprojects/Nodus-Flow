import { Canvas, CanvasKit, Paint, Path, Shader } from "canvaskit-wasm";
import { nodusCanvas } from "../../core/NodusCanvas"
import { drawGrid } from "../../core/renderer";
import { DEVICE_INFO, HEADER } from "../Lobby/components/Toolbars";
import { COPYRIGHT, CREATE_FLOW, RECENT_USED, USERNAME } from "./components/Toolbars";
import style from "./Lobby.module.css";
import { generateRandomRoomId } from "../../utils/network";
import { updateRoomId, userData } from "../../models/userStore";
import { setViewMouseHandlers } from "../../utils/mouse";
import { useLicense } from "../../services/license";
import { onCleanup, onMount, Show } from "solid-js";

let mousePos = {
    x: 0,
    y: 0
};

const RECT_SIZE = 40;

let gridScroll = 0;
let rectangles : {col:number, row: number, color: number[], alpha: number, count: number, decay: number}[] = [];

// Objetos reutilizables (se recrean solo al cambiar el tamaño)
let verticalPath: Path | null = null;
let horizontalPath: Path | null = null;
let gridPaint: Paint | null = null;
let shader1: Shader | null = null;
let shader2: Shader | null = null;
let rectPaint: Paint | null = null;
let lastW = 0,
    lastH = 0;

function rebuildGridPaths(w: number, h: number, ck: CanvasKit) {

    if(!ck) return;

    const centerX = w / 2;
    const centerY = h / 2;
    const step = RECT_SIZE * 2;
    const numVLines = Math.floor(w / step);
    const numHLines = Math.floor(h / step);

    // Crear o limpiar paths
    if (!verticalPath) verticalPath = new ck.Path();
    else verticalPath.reset();
    if (!horizontalPath) horizontalPath = new ck.Path();
    else horizontalPath.reset();

    // Construir líneas verticales
    for (let i = 0; i <= numVLines; i++) {
        const xPos1 = centerX + (i / numVLines) * centerX;
        const xPos2 = centerX - (i / numVLines) * centerX;
        verticalPath.moveTo(xPos1, 0);
        verticalPath.lineTo(xPos1, h);
        verticalPath.moveTo(xPos2, 0);
        verticalPath.lineTo(xPos2, h);
    }

    // Construir líneas horizontales
    for (let i = 0; i <= numHLines; i++) {
        const yPos1 = centerY + (i / numHLines) * centerY;
        const yPos2 = centerY - (i / numHLines) * centerY;
        horizontalPath.moveTo(0, yPos1);
        horizontalPath.lineTo(w, yPos1);
        horizontalPath.moveTo(0, yPos2);
        horizontalPath.lineTo(w, yPos2);
    }

    // Shaders (también se recrean al cambiar el tamaño)
    if (shader1) shader1.delete();
    if (shader2) shader2.delete();
    shader1 = ck.Shader.MakeLinearGradient(
        [0, centerY],
        [w, centerY],
        [ck.Color(0, 200, 200, 0.15), ck.Color(0, 200, 200, 0.0005), ck.Color(0, 200, 200, 0.15)],
        [0, 0.5, 1],
        ck.TileMode.Clamp
    );
    shader2 = ck.Shader.MakeLinearGradient(
        [centerX, 0],
        [centerX, h],
        [ck.Color(0, 200, 200, 0.15), ck.Color(0, 200, 200, 0.0005), ck.Color(0, 200, 200, 0.15)],
        [0, 0.5, 1],
        ck.TileMode.Clamp
    );

    // Paint para la cuadrícula (se reutiliza)
    if (!gridPaint) {
        gridPaint = new ck.Paint();
        gridPaint.setStyle(ck.PaintStyle.Stroke);
        gridPaint.setStrokeWidth(2);
    }
    // Paint para los rectángulos
    if (!rectPaint) {
        rectPaint = new ck.Paint();
        rectPaint.setStyle(ck.PaintStyle.Fill);
    }

    lastW = w;
    lastH = h;
}

export function initRectangles(w: number, h: number) {
    const count = 7;
    const maxCell = Math.floor(Math.min(w, h) / (2 * RECT_SIZE)) - 1; // para que no se salgan

    rectangles = [];
    for (let i = 0; i < count; i++) {
        // Elegir col y row aleatorios, excluyendo el 0
        let col, row;
        do {
            col = Math.floor(Math.random() * (2 * maxCell + 1)) - maxCell;
        } while (col === 0);
        do {
            row = Math.floor(Math.random() * (2 * maxCell + 1)) - maxCell;
        } while (row === 0);

        rectangles.push({
            col: col,
            row: row,
            color: [0, 200, 200],
            alpha: 0.2 + Math.random() * 0.3,
            count: 0,
            decay: 0.003 + Math.random() * 0.007
        });
    }
}

const drawInfiniteFloor = (canvas: Canvas, ck: CanvasKit) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const centerX = w / 2;
    const centerY = h / 2;
    const step = RECT_SIZE * 2;
    const numVLines = w / step;
    const numHLines = h / step;

    // Inicializar rectángulos si no existen
    if (rectangles.length === 0) {
        initRectangles(w, h);
    }

    // Actualizar scroll
    gridScroll += 0.032;
    if (gridScroll > 1) {
        gridScroll = 0;
        rectangles.forEach(rect => rect.count++);
    }

    // Crear/limpiar paths para este frame (reutilizar instancias)
    if (!verticalPath) verticalPath = new ck.Path();
    else verticalPath.reset();
    if (!horizontalPath) horizontalPath = new ck.Path();
    else horizontalPath.reset();

    // Construir verticales con gridScroll
    for (let i = 0; i <= numVLines; i++) {
        const offset = (i + gridScroll) / numVLines;
        const xPos1 = centerX + offset * centerX;
        const xPos2 = centerX - offset * centerX;
        verticalPath.moveTo(xPos1, 0);
        verticalPath.lineTo(xPos1, h);
        verticalPath.moveTo(xPos2, 0);
        verticalPath.lineTo(xPos2, h);
    }

    // Construir horizontales con gridScroll
    for (let i = 0; i <= numHLines; i++) {
        const offset = (i + gridScroll) / numHLines;
        const yPos1 = centerY + offset * centerY;
        const yPos2 = centerY - offset * centerY;
        horizontalPath.moveTo(0, yPos1);
        horizontalPath.lineTo(w, yPos1);
        horizontalPath.moveTo(0, yPos2);
        horizontalPath.lineTo(w, yPos2);
    }

    // Shaders (reutilizar o recrear si cambia el tamaño)
    if (!shader1 || lastW !== w || lastH !== h) {
        if (shader1) shader1.delete();
        if (shader2) shader2.delete();
        shader1 = ck.Shader.MakeLinearGradient(
            [0, centerY],
            [w, centerY],
            [ck.Color(0, 200, 200, 0.15), ck.Color(0, 200, 200, 0.0005), ck.Color(0, 200, 200, 0.15)],
            [0, 0.5, 1],
            ck.TileMode.Clamp
        );
        shader2 = ck.Shader.MakeLinearGradient(
            [centerX, 0],
            [centerX, h],
            [ck.Color(0, 200, 200, 0.15), ck.Color(0, 200, 200, 0.0005), ck.Color(0, 200, 200, 0.15)],
            [0, 0.5, 1],
            ck.TileMode.Clamp
        );
        lastW = w;
        lastH = h;
    }

    // Paint para la cuadrícula (reutilizar)
    if (!gridPaint) {
        gridPaint = new ck.Paint();
        gridPaint.setStyle(ck.PaintStyle.Stroke);
        gridPaint.setStrokeWidth(2);
    }

    // Dibujar verticales
    gridPaint.setShader(shader1);
    canvas.drawPath(verticalPath, gridPaint);

    // Dibujar horizontales
    gridPaint.setShader(shader2);
    canvas.drawPath(horizontalPath, gridPaint);

    // ---- Dibujar rectángulos ----
    if (!rectPaint) {
        rectPaint = new ck.Paint();
        rectPaint.setStyle(ck.PaintStyle.Fill);
    }

    for (let rect of rectangles) {
        rect.alpha -= rect.decay;
        if (rect.alpha <= 0) {
            rect.alpha = 0.2 + Math.random() * 0.3;
            const maxCell = Math.floor(Math.min(w, h) / (2 * RECT_SIZE)) - 1;
            do {
                rect.col = Math.floor(Math.random() * (2 * maxCell + 1)) - maxCell;
            } while (rect.col === 0);
            do {
                rect.row = Math.floor(Math.random() * (2 * maxCell + 1)) - maxCell;
            } while (rect.row === 0);
            rect.count = 0;
            rect.color = [0, 200, 200];
            rect.decay = 0.003 + Math.random() * 0.007;
        }

        const signX = rect.col > 0 ? 1 : -1;
        const signY = rect.row > 0 ? 1 : -1;
        const absCol = Math.abs(rect.col) + rect.count;
        const absRow = Math.abs(rect.row) + rect.count;

        const cx = centerX + signX * (absCol - 0.5) * RECT_SIZE + signX * gridScroll * RECT_SIZE;
        const cy = centerY + signY * (absRow - 0.5) * RECT_SIZE + signY * gridScroll * RECT_SIZE;

        const x = cx - RECT_SIZE / 2;
        const y = cy - RECT_SIZE / 2;

        const color = ck.Color(rect.color[0], rect.color[1], rect.color[2], rect.alpha);
        rectPaint.setColor(color);
        canvas.drawRect(ck.XYWHRect(x, y, RECT_SIZE, RECT_SIZE), rectPaint);
    }
};

export const Lobby = (props: { onNavigate: (v: 'lobby' | 'editor') => void}) => {

    const nodus = nodusCanvas;

    const {deviceId, daysLeft, expiryDate} = useLicense();

    const rebuildBgOnResize = () => {
        rebuildGridPaths(window.innerWidth, window.innerHeight, nodusCanvas.getCK());
    }

    onMount(() => {
        rebuildGridPaths(window.innerWidth, window.innerHeight, nodusCanvas.getCK());

        window.addEventListener('resize', rebuildBgOnResize);
    });

    onCleanup(() => {
        window.removeEventListener('resize', rebuildBgOnResize);

        verticalPath?.delete();
        horizontalPath?.delete();
        gridPaint?.delete();
        rectPaint?.delete();
        shader1?.delete();
        shader2?.delete();
    })

    nodus.setDraw(() => {
        drawInfiniteFloor(nodusCanvas.getCanvas(), nodusCanvas.getCK());
        drawGrid(mousePos);
        nodusCanvas.requestRedraw();
    });

    const startFlow = () => {
        const newDiagramId = generateRandomRoomId();
        updateRoomId(newDiagramId);
        props.onNavigate('editor');
    };

    const joinFlow = () => {
        const newDiagramId = (document.getElementById(style.roomIdInput) as HTMLInputElement).value;
        updateRoomId(newDiagramId);
        props.onNavigate('editor');
    };

    const recentUsed = () => {
        const newDiagramId = userData.lastRoom;
        updateRoomId(newDiagramId);
        props.onNavigate('editor');
    };

    setViewMouseHandlers({
        onMove: (e) => mousePos = {x: e.offsetX, y: e.offsetY}
    })

    nodusCanvas.camera.setOffsetX(0);
    nodusCanvas.camera.setOffsetY(0);
    nodusCanvas.camera.setZoom(1);

    return (
        
        <div class={style.lobbyContainer}>
            {/* Header */}
            <header class={style.header}>
            {HEADER()}
            <div class={style.navActions}>
                {RECENT_USED(recentUsed)}
                {USERNAME()}
            </div>
            </header>

            {/* Main: formulario centrado */}
            <main class={style.main}>
            {CREATE_FLOW(startFlow, joinFlow)}
            </main>

            {/* Footer */}
            <footer class={style.footer}>
            {COPYRIGHT()}
            <Show when={daysLeft() !== null && expiryDate() !== null}>
                <DEVICE_INFO
                deviceId={deviceId()!!}
                daysLeft={daysLeft()!!}
                expiryDate={expiryDate()!!}
                />
            </Show>
            </footer>
        </div>
        
    );
}