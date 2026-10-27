import { Canvas, CanvasKit, FontMgr, Paint, Paragraph, Path } from "canvaskit-wasm";

// Habilitar logs de diagnóstico para depuración de problemas con superficies/redimensionado
const DIAG_LOGS = true;
import { getNode, Node, nodes, ocupadoPor, selectedNodesIds } from "../models/nodes";
import { calculateDiagramBounds, getConnectionPathData, getSVGPathFromConnectionData, NodeToNode } from "../utils/path";
import { HexToColor } from "../utils/color";
import { obtenerColorTexto } from "../utils/color";
import { GRID_SIZE } from "../utils/math";
import { dataFlowResult, flowConecctions, selectionRect } from "../views/Editor/Editor";
import { nodusCanvas } from "../core/NodusCanvas";
import { Connection, connections, selectedConnectionId } from "../models/connections";
import { pings } from "../models/ping";
import { removeToast, showToast, ToastType } from "../models/toast";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { createSignal } from "solid-js";
import { userData } from "../models/userStore";
import { estimateTextLayout, renderTextToSvg } from "../utils/svgtextLayout";

// Cache de pinturas reutilizables
const paintCache = new Map<string, Paint>();
const pathCache = new Map<string, Path>();
const paragraphCache = new Map<string, Paragraph>();

let cacheVersion = 0;

function addCacheVersion(key: string){
    return `v${cacheVersion}_${key}`;
}

function getPaint(CK: CanvasKit, key: string, init: (paint: Paint) => void): Paint {

    key = addCacheVersion(key);

    let paint = paintCache.get(key);

    if(!paint){
        paint = new CK.Paint();

        paintCache.set(key, paint);
    }
    
    init(paint);

    return paint;
}

function getPath(CK: CanvasKit, key: string): Path {
    key = addCacheVersion(key);

    let path = pathCache.get(key);

    if(!path){
        path = new CK.Path();

        pathCache.set(key, path);
    }
    
    return path;
}

function getParagraph(CK: CanvasKit, text: string, style: any, fontMgr: FontMgr, key: string): Paragraph {

    key = addCacheVersion(key);

    let paragraph = paragraphCache.get(key);

    if(!paragraph){
        const builder = CK.ParagraphBuilder.Make(style, fontMgr);
        builder.addText(text);
        paragraph = builder.build();
        builder.delete();

        paragraphCache.set(key, paragraph);
    }
    return paragraph;
}

// Limpiar caché cuando cambia el zoom (para textos que dependen del tamaño)
export function invalidateParagraphCache() {
    
    paragraphCache.forEach(paragraph => {
        if(!paragraph.isDeleted()) paragraph.delete();
    });

    paragraphCache.clear();

}

export function invalidateAllResources() {

    cacheVersion++;

    paintCache.forEach(paint => {
        if(!paint.isDeleted()) paint.delete();
    });

    paintCache.clear();

    pathCache.forEach(path => {
        if(!path.isDeleted()) path.delete();
    });

    pathCache.clear();
}

export const drawNodeOpcionalText = (CK: CanvasKit, node: Node, exportCanvas?: Canvas) => {

    if(!nodusCanvas.canDraw() && !exportCanvas) return;

    const canvas = exportCanvas || nodusCanvas.getCanvas();

    if(node.properties.textAbove){
        const textAboveStyle = new CK.TextStyle({
            color: CK.parseColorString(node.properties.textAboveColor || node.color),
            fontSize: node.properties.textAboveFontSize || 12,
            fontFamilies: ['Inter 28pt Mudium']
        });

        const textAboveParagraphStyle = new CK.ParagraphStyle({
            textStyle: textAboveStyle,
            textAlign: CK.TextAlign.Center,
        });

        const textAboveParagraph = getParagraph(CK, node.properties.textAbove, textAboveParagraphStyle, nodusCanvas.getFont()!, `text_above_${node.id}_${node.properties.textAbove}`);

        textAboveParagraph.layout(node.width);
        canvas.drawParagraph(textAboveParagraph, node.x, node.y - textAboveParagraph.getHeight() - (node.properties.textOffset || 5));
    }

    if(node.properties.textBelow){
        const textBelowStyle = new CK.TextStyle({
            color: CK.parseColorString(node.properties.textBelowColor || node.color),
            fontSize: node.properties.textBelowFontSize || 12,
            fontFamilies: ['Inter 28pt Mudium']
        });

        const textBelowParagraphStyle = new CK.ParagraphStyle({
            textStyle: textBelowStyle,
            textAlign: CK.TextAlign.Center,
        });

        const textBelowParagraph = getParagraph(CK, node.properties.textBelow, textBelowParagraphStyle, nodusCanvas.getFont()!, `text_below_${node.id}_${node.properties.textAbove}`);

        textBelowParagraph.layout(node.width);
        canvas.drawParagraph(textBelowParagraph, node.x, node.y + node.height + (node.properties.textOffset || 5));
    }

    if(node.properties.textLeft){
        const textLeftStyle = new CK.TextStyle({
            color: CK.parseColorString(node.properties.textLeftColor || node.color),
            fontSize: node.properties.textLeftFontSize || 12,
            fontFamilies: ['Inter 28pt Mudium']
        });

        const textLeftParagraphStyle = new CK.ParagraphStyle({
            textStyle: textLeftStyle,
            textAlign: CK.TextAlign.Right,
        });

        const textLeftParagraph = getParagraph(CK, node.properties.textLeft, textLeftParagraphStyle, nodusCanvas.getFont()!, `text_left_${node.id}_${node.properties.textAbove}`);

        textLeftParagraph.layout(200);
        canvas.drawParagraph(textLeftParagraph, node.x - textLeftParagraph.getMaxWidth() - (node.properties.textOffset || 5), node.y + (node.height / 2) - (textLeftParagraph.getHeight() / 2));

    }

    if(node.properties.textRight){
        const textRightStyle = new CK.TextStyle({
            color: CK.parseColorString(node.properties.textRightColor || node.color),
            fontSize: node.properties.textRightFontSize || 12,
            fontFamilies: ['Inter 28pt Mudium']
        });

        const textRightParagraphStyle = new CK.ParagraphStyle({
            textStyle: textRightStyle,
            textAlign: CK.TextAlign.Left,
        });
        
        const textRightParagraph = getParagraph(CK, node.properties.textRight, textRightParagraphStyle, nodusCanvas.getFont()!, `text_right_${node.id}_${node.properties.textAbove}`);

        textRightParagraph.layout(200);
        canvas.drawParagraph(textRightParagraph, node.x + node.width + (node.properties.textOffset || 5), node.y + (node.height / 2) - (textRightParagraph.getHeight() / 2));
    }
};

export const drawNode = (CK: CanvasKit, node: Node, exportCanvas? : Canvas) => {

    if(!nodusCanvas.canDraw() && !exportCanvas) return;
    const canvas = exportCanvas || nodusCanvas.getCanvas();

    const color = HexToColor(node.color);
    const fillColor = CK.Color(color[0], color[1], color[2], node.opacity);

    const safeRadius = Number(node.radius) || 0;

    const rectBounds = CK.LTRBRect(node.x, node.y, node.x + node.width, node.y + node.height);

    if(node.properties.dashedBorder){
        const paint = getPaint(CK, `dashed_border_${node.id}`, (p) => {
            p.setAntiAlias(true);
            p.setDither(true);
            p.setStyle(CK.PaintStyle.Stroke);
            p.setColor(CK.parseColorString(node.color));
        });
        
        let dash = 3;

        try{
            dash = parseInt(node.properties.dashedBorder) || 3;

        } catch (_) {

        }

        if(!dash || dash == null){
            dash = 3;
        }

        const dashPathEffect = CK.PathEffect.MakeDash([dash, dash], 0);
        const borderWidth = node.properties.borderWidth || 2;
        const path = getPath(CK, `dashed_border_${node.id}`);
        path.rewind();

        switch(node.style){
            case 2:
                path.addOval(rectBounds);
                break;
            case 3:
                const cx = node.x + node.width / 2;
                const cy = node.y + node.height / 2;
                path.moveTo(cx, node.y);
                path.lineTo(node.x + node.width, cy);
                path.lineTo(cx, node.y + node.height);
                path.lineTo(node.x, cy);
                path.close();
                break;
            default:
                const rrect = CK.RRectXY(rectBounds, safeRadius, safeRadius);
                path.addRRect(rrect);
        }

        paint.setPathEffect(dashPathEffect);
        paint.setStrokeWidth(borderWidth);
        canvas.drawPath(path, paint);
        paint.setPathEffect(null);
        dashPathEffect.delete();
    } else {
        const fillPaint = getPaint(CK, `fill_${node.id}`, (p) => {
            p.setAntiAlias(true);
            p.setDither(true);
            p.setStyle(CK.PaintStyle.Fill);
            p.setColor(fillColor);
        });

        switch(node.style){
            case 2:
                canvas.drawOval(rectBounds, fillPaint);
                break;
            case 3:
                const shapePath = getPath(CK, `shape_fill_${node.id}`);
                shapePath.rewind();
                const cx = node.x + node.width / 2;
                const cy = node.y + node.height / 2;
                shapePath.moveTo(cx, node.y);
                shapePath.lineTo(node.x + node.width, cy);
                shapePath.lineTo(cx, node.y + node.height);
                shapePath.lineTo(node.x, cy);
                shapePath.close();
                canvas.drawPath(shapePath, fillPaint);
                break;
            default:
                const rrect = CK.RRectXY(rectBounds, safeRadius, safeRadius);

                canvas.drawRRect(rrect, fillPaint);
        }
    }
    
    if(node.properties.doubleBorder && !node.properties.dashedBorder){
        const borderPaint = getPaint(CK, `double_border_${node.id}`, (p) => {
            p.setStyle(CK.PaintStyle.Stroke);
            p.setStrokeWidth(3);
            p.setAntiAlias(true);
            p.setColor(fillColor);
        });

        switch(node.style){
            case 2:
                canvas.drawOval(CK.LTRBRect(node.x - 6, node.y - 6, node.x + node.width + 6, node.y + node.height + 6), borderPaint);
                break;
            case 3:
                const diamondPath = getPath(CK, `double_border_${node.id}`);
                diamondPath.rewind();
                const cx = node.x + node.width / 2;
                const cy = node.y + node.height / 2;
                diamondPath.moveTo(cx, node.y - 6);
                diamondPath.lineTo(node.x + node.width + 6, cy);
                diamondPath.lineTo(cx, node.y + node.height + 6);
                diamondPath.lineTo(node.x - 6, cy);
                diamondPath.close();
                canvas.drawPath(diamondPath, borderPaint);
                break;
            default:
                const rrectBorder = CK.RRectXY(CK.LTRBRect(node.x - 6, node.y - 6, node.x + node.width + 6, node.y + node.height + 6), safeRadius + 6, safeRadius + 6);
                canvas.drawRRect(rrectBorder, borderPaint);
        }
    }

    if(node.properties.disjointMembership){
        const semiPaint = getPaint(CK, `disjount_membership_${node.id}`, (p) => {
            p.setStyle(CK.PaintStyle.Stroke);
            p.setStrokeWidth(2);
            p.setAntiAlias(true);
            p.setColor(CK.parseColorString(node.color));
        });
        const semiPath = getPath(CK, `disjount_membership_${node.id}`);
        semiPath.rewind();
        const cx = node.x + node.width / 2;
        const height = node.y + node.height;
        semiPath.moveTo(node.x - 60, height + 40);
        semiPath.quadTo(cx, node.y + node.height + 100, node.x + node.width + 60, height + 40);
        canvas.drawPath(semiPath, semiPaint);
    } else if(node.properties.overlappingMembership){
        const overlapPaint = getPaint(CK, `disjount_membership_${node.id}`, (p) => {
            p.setStyle(CK.PaintStyle.Stroke);
            p.setStrokeWidth(2);
            p.setAntiAlias(true);
            p.setColor(CK.parseColorString(node.color));
        });
        const overlapPath = getPath(CK, `overlap_membership_${node.id}`);
        overlapPath.rewind();
        const y = node.y + node.height + 40;
        overlapPath.moveTo(node.x - 60, y);
        overlapPath.lineTo(node.x + node.width + 60, y);
        overlapPath.dash(5, 5, 0);
        canvas.drawPath(overlapPath, overlapPaint);
    }

    if(!exportCanvas){
        const user = ocupadoPor(node.id);
        if(user){
            const occupiedPaint = getPaint(CK, `occupies_paint_${node.id}`, (p) => {
                p.setAlphaf(1);
                p.setStyle(CK.PaintStyle.Stroke);
                p.setStrokeWidth(5);
                p.setAntiAlias(true);
                p.setColor(CK.parseColorString(user.color));
            });

            if(node.style === 2){
                canvas.drawOval(CK.LTRBRect(node.x - 5, node.y - 5, node.x + node.width + 5, node.y + node.height + 5), occupiedPaint);
            } else if(node.style === 3){
                const bigPath = getPath(CK, `occupied_${node.id}`);
                bigPath.rewind();
                const bx = node.x + node.width / 2;
                const by = node.y + node.height / 2;
                bigPath.moveTo(bx, node.y - 5);
                bigPath.lineTo(node.x + node.width + 5, by);
                bigPath.lineTo(bx, node.y + node.height + 5);
                bigPath.lineTo(node.x - 5, by);
                bigPath.close();
                canvas.drawPath(bigPath, occupiedPaint);
            } else {
                const rect2 = CK.RRectXY(CK.LTRBRect(node.x - 5, node.y - 5, node.x + node.width + 5, node.y + node.height + 5), safeRadius + 5, safeRadius + 5);
                canvas.drawRRect(rect2, occupiedPaint);
            }

            const textStyle = new CK.TextStyle({
                color: CK.Color(200,200,200),
                fontSize: 14,
                fontFamilies: ['Inter 28pt Mudium']        
            });
            const paragraphStyle = new CK.ParagraphStyle({
                textStyle: textStyle,
                textAlign: CK.TextAlign.Left,
            });
            const textParagraph = getParagraph(CK, `Occupied by: ${user.nombre}`, paragraphStyle, nodusCanvas.getFont()!, `occupied_name_${node.id}`);

            textParagraph.layout(300);
            canvas.drawParagraph(textParagraph, node.x + 10, node.y - 22);

        } else if(selectedNodesIds().includes(node.id)){
            const colorText = obtenerColorTexto(node.color);
            const selectedPaint = getPaint(CK, `selected_${node.id}`, (p) => {
                p.setAlphaf(1);
                p.setStyle(CK.PaintStyle.Stroke);
                p.setStrokeWidth(4);
                p.setAntiAlias(true);
                p.setColor(CK.parseColorString(colorText));
            });

            if(node.style === 2){
                canvas.drawOval(CK.LTRBRect(node.x - 2, node.y - 2, node.x + node.width + 2, node.y + node.height + 2), selectedPaint);
            } else if(node.style === 3){
                const selPath = getPath(CK, `selected_${node.id}`);
                selPath.rewind();
                const sx = node.x + node.width / 2;
                const sy = node.y + node.height / 2;
                selPath.moveTo(sx, node.y - 2);
                selPath.lineTo(node.x + node.width + 2, sy);
                selPath.lineTo(sx, node.y + node.height + 2);
                selPath.lineTo(node.x - 2, sy);
                selPath.close();
                canvas.drawPath(selPath, selectedPaint);
            } else {
                const rectSel = CK.RRectXY(CK.LTRBRect(node.x - 2, node.y - 2, node.x + node.width + 2, node.y + node.height + 2), safeRadius + 4, safeRadius + 4);
                canvas.drawRRect(rectSel, selectedPaint);
            }
        }
    }

    drawNodeOpcionalText(CK, node, exportCanvas);
};

export const drawNodeGrid = (CK: CanvasKit, node: Node) => {

    if(!nodusCanvas.canDraw()) return;

    const canvas = nodusCanvas.getCanvas();

    const paint = getPaint(CK, `grid_${node.id}`, (p) => {
        p.setStyle(CK.PaintStyle.Stroke);
        p.setStrokeWidth(1 / nodusCanvas.camera.zoom());
        p.setAntiAlias(true);
        p.setColor(CK.Color(155,155,255,0.3));
    });

    const startX = -nodusCanvas.camera.offsetX() / nodusCanvas.camera.zoom();
    const startY = -nodusCanvas.camera.offsetY() / nodusCanvas.camera.zoom();
    const endX = startX + nodusCanvas.camera.getWordlSize().width;
    const endY = startY + nodusCanvas.camera.getWordlSize().height;
    
    canvas.drawLine(node.x + node.width, startY, node.x + node.width, endY, paint);
    canvas.drawLine(node.x, startY, node.x, endY, paint);
    canvas.drawLine(startX, node.y, endX, node.y, paint);
    canvas.drawLine(startX, node.y + node.height, endX, node.y + node.height, paint);
};

export const drawSnapGuides = (
    CK: CanvasKit,
    guides: {axis: "x" | "y", position: number, from: {x: number, y: number}, to: {x: number, y: number}}[]
) => {
    if(!nodusCanvas.canDraw() || guides.length === 0) return;

    const canvas = nodusCanvas.getCanvas();
    const zoom = nodusCanvas.camera.zoom();
    const startX = -nodusCanvas.camera.offsetX() / zoom;
    const startY = -nodusCanvas.camera.offsetY() / zoom;
    const endX = startX + nodusCanvas.camera.getWordlSize().width;
    const endY = startY + nodusCanvas.camera.getWordlSize().height;

    const paint = getPaint(CK, "snap_alignment_guides", p => {
        p.setStyle(CK.PaintStyle.Stroke);
        p.setStrokeWidth(1 / zoom);
        p.setAntiAlias(true);
        p.setColor(CK.Color(56, 189, 248, 0.9));
    });

    const verticalPositions = new Set<number>();
    const horizontalPositions = new Set<number>();
    const anchorPositions = new Map<string, {x: number, y: number}>();
    for(const guide of guides){
        if(guide.axis === "x"){
            verticalPositions.add(guide.position);
        } else {
            horizontalPositions.add(guide.position);
        }

        for(const point of [guide.from, guide.to]){
            anchorPositions.set(`${point.x.toFixed(3)},${point.y.toFixed(3)}`, point);
        }
    }

    verticalPositions.forEach(x => canvas.drawLine(x, startY, x, endY, paint));
    horizontalPositions.forEach(y => canvas.drawLine(startX, y, endX, y, paint));

    const anchorPaint = getPaint(CK, "snap_alignment_anchors", p => {
        p.setStyle(CK.PaintStyle.Fill);
        p.setAntiAlias(true);
        p.setColor(CK.Color(56, 189, 248, 0.95));
    });
    anchorPositions.forEach(point => canvas.drawCircle(point.x, point.y, 3 / zoom, anchorPaint));
};

export enum ANCHOR_POINT{
    TOP = "TOP",
    BOTTOM = "BOTTOM",
    LEFT = "LEFT",
    RIGHT = "RIGHT",
    TOP_LEFT = "TOP_LEFT",
    TOP_RIGHT = "TOP_RIGHT",
    BOTTOM_LEFT = "BOTTOM_LEFT",
    BOTTOM_RIGHT = "BOTTOM_RIGHT"
};

const MARGIN_BOX = -20;
const anchorPoints = [
    {x: 0, y: 0, direction: ANCHOR_POINT.TOP_LEFT},
    {x: 0.5, y: 0, direction: ANCHOR_POINT.TOP},
    {x: 1, y: 0, direction: ANCHOR_POINT.TOP_RIGHT},
    {x: 1, y: 0.5, direction: ANCHOR_POINT.RIGHT},
    {x: 1, y: 1, direction: ANCHOR_POINT.BOTTOM_RIGHT},
    {x: 0.5, y: 1, direction: ANCHOR_POINT.BOTTOM},
    {x: 0, y: 1, direction: ANCHOR_POINT.BOTTOM_LEFT},
    {x: 0, y: 0.5, direction: ANCHOR_POINT.LEFT}
];

export const [resizingDots, setResizingDots] = createSignal<{x: number, y: number, direction: ANCHOR_POINT}[]>([]);
export const [focusedPoint, setFocusedPoint] = createSignal<{x: number, y:number, direction: ANCHOR_POINT} | null>(null);
export const [sourceAnchorPoint, setSourceAnchorPoint] = createSignal<{x: number, y:number, direction: ANCHOR_POINT} | null>(null);

export const drawResizingBox = (CK: CanvasKit, nodes: Node[]) => {

    if(!nodusCanvas.canDraw()) return;

    const canvas = nodusCanvas.getCanvas();

    const bounds = calculateDiagramBounds(nodes);
    const rect = CK.XYWHRect(bounds.x - MARGIN_BOX, bounds.y - MARGIN_BOX, bounds.width + MARGIN_BOX * 2, bounds.height + MARGIN_BOX * 2);

    const paint = getPaint(CK, "resizing_box", (p) => {
        p.setStyle(CK.PaintStyle.Stroke);
        p.setStrokeWidth(1 / nodusCanvas.camera.zoom());
        p.setAntiAlias(true);
    });
    paint.setColor(CK.Color(64, 150, 255));
    canvas.drawRect(rect, paint);
    
    const newDots: {x:number, y:number, direction: ANCHOR_POINT}[] = [];
    const fillPaint = getPaint(CK, "resizing_dot_fill", (p) => {
        p.setStyle(CK.PaintStyle.Fill);
        p.setStrokeWidth(1 / nodusCanvas.camera.zoom());
    });
    const strokePaint = getPaint(CK, "resizing_dot_stroke", (p) => {
        p.setStyle(CK.PaintStyle.Stroke);
        p.setStrokeWidth(1 / nodusCanvas.camera.zoom());
    });
    
    anchorPoints.forEach(point => {
        fillPaint.setColor(CK.Color(240,240,240));
        strokePaint.setColor(CK.Color(7,5,5));
        
        const absolutePointPosition = {
            x: bounds.x - MARGIN_BOX + (bounds.width + MARGIN_BOX * 2) * point.x,
            y: bounds.y - MARGIN_BOX + (bounds.height + MARGIN_BOX * 2) * point.y
        };

        const pointSize = 4 / nodusCanvas.camera.zoom();

        const anchorRect = CK.XYWHRect(absolutePointPosition.x - pointSize, absolutePointPosition.y - pointSize, pointSize * 2, pointSize * 2);

        canvas.drawRect(anchorRect, fillPaint);
        canvas.drawRect(anchorRect, strokePaint);

        newDots.push({
            x: absolutePointPosition.x,
            y: absolutePointPosition.y,
            direction: point.direction
        });
    });

    setResizingDots(newDots);
};

export const drawConnection = (CK: CanvasKit, fromNode: Node, toNode: Node, conn: Connection, exportCanvas?: Canvas) => {

    if(!nodusCanvas.canDraw() && !exportCanvas) return;

    const canvas = exportCanvas || nodusCanvas.getCanvas();

    const linePaint = getPaint(CK, `conn_${conn.id}`, (p) => {
        p.setStyle(CK.PaintStyle.Stroke);
        p.setAntiAlias(true);
        p.setDither(true);
    });
    linePaint.setColor(CK.Color(255,255,255)); 
    
    const fromColor = CK.Color(HexToColor(fromNode.color)[0], HexToColor(fromNode.color)[1], HexToColor(fromNode.color)[2]);
    const toColor = CK.Color(HexToColor(toNode.color)[0], HexToColor(toNode.color)[1], HexToColor(toNode.color)[2]);

    const path = NodeToNode(CK, fromNode, toNode, conn);

    const shader = CK.Shader.MakeLinearGradient(
            [fromNode.x + fromNode.width / 2, fromNode.y + fromNode.height / 2],
            [toNode.x + toNode.width / 2, toNode.y + toNode.height / 2],
            [fromColor, toColor, fromColor],
            [2 * flowConecctions - 1, 2 * flowConecctions - 0.5, 2 * flowConecctions],
            CK.TileMode.Clamp
        );

    if(selectedConnectionId() !== conn.id || exportCanvas){
        if(conn.properties.dashed){
            path.dash(10, 5, conn.properties.noFlow ? 0 : - flowConecctions * 15);
        }

        if(conn.properties.color){
            linePaint.setColor(CK.parseColorString(conn.properties.color));
        } else {
            linePaint.setShader(shader);
        }

        linePaint.setStrokeWidth(conn.properties.thickness || 4);
        const blurMask = CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 4, false);
        linePaint.setMaskFilter(blurMask);
        canvas.drawPath(path, linePaint);
        linePaint.setStrokeWidth(1);
        linePaint.setMaskFilter(null);
        canvas.drawPath(path, linePaint);
        blurMask.delete();
    } else {
        linePaint.setStrokeWidth(5);
        const blurMask = CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 5, false);
        linePaint.setMaskFilter(blurMask);
        canvas.drawPath(path, linePaint);
        linePaint.setStrokeWidth(4);
        linePaint.setShader(shader);
        linePaint.setMaskFilter(null);
        canvas.drawPath(path, linePaint);
        blurMask.delete();
    }

    linePaint.setShader(null);

    if(conn.properties.label){
        const textStyle = new CK.TextStyle({
            color: CK.parseColorString(conn.properties.labelColor || "#ffffff"),
            fontSize: conn.properties.fontSize || 14,
            fontFamilies: ['Inter 28pt Mudium']
        });
        const textParagraphStyle = new CK.ParagraphStyle({
            textStyle: textStyle,
            textAlign: CK.TextAlign.Center,
        });
        const textParagraph = getParagraph(CK, conn.properties.label, textParagraphStyle, nodusCanvas.getFont()!, `text_conn_${conn.id}_${conn.properties.label}`);

        const fromCenter = {
            x: fromNode.x + fromNode.width / 2,
            y: fromNode.y + fromNode.height / 2
        };
        const toCenter = {
            x: toNode.x + toNode.width / 2,
            y: toNode.y + toNode.height / 2
        };
        const midPoint = {
            x: (fromCenter.x + toCenter.x) / 2,
            y: (fromCenter.y + toCenter.y) / 2,
        };


        textParagraph.layout(200);
        canvas.save();
        canvas.translate(midPoint.x, midPoint.y);
        canvas.drawParagraph(textParagraph, -textParagraph.getMaxWidth() / 2, -textParagraph.getHeight() / 2 - (conn.properties.labelPosition || 5));
        canvas.restore();

    }

    path.delete();
    shader.delete();
};

export const drawNodeText = (CK: CanvasKit, node: Node, fontMgr: FontMgr | null, exportCanvas?: Canvas) => {

    if(!nodusCanvas.canDraw() && !exportCanvas) return;
    if(!fontMgr) return;
    const canvas = exportCanvas || nodusCanvas.getCanvas();

    const color = obtenerColorTexto(node.color);
    const haveUnderline = node.properties.underline || false;
    const isDashedUnderline = node.properties.dashedUnderline || false;

    const textStyle = new CK.TextStyle({
        color: CK.parseColorString(color),
        fontSize: node.properties.fontSize || 15,
        fontFamilies: ['Inter 28pt Mudium'],
        decoration: haveUnderline ? CK.UnderlineDecoration : CK.NoDecoration,
        decorationColor: CK.parseColorString(color),
        decorationThickness: haveUnderline? 2 : 1,
        decorationStyle: isDashedUnderline ? CK.DecorationStyle.Dashed : CK.DecorationStyle.Solid
    });

    const paragraphStyle = new CK.ParagraphStyle({
        textStyle: textStyle,
        textAlign: CK.TextAlign.Center,
    });

    const paragraph = getParagraph(CK, node.title || "", paragraphStyle, fontMgr, `title_node_${node.id}_${node.title}`);

    paragraph.layout(node.width - 20);
    canvas.drawParagraph(paragraph, node.x + 10, node.y + (node.height / 2) - paragraph.getHeight() / 2);

};

export const drawElasticLine = (CK: CanvasKit, fromNode: Node, mousePos: any, startPoint?: {x:number,y:number}, exportCanvas?: Canvas) => {

    if(!nodusCanvas.canDraw() && !exportCanvas) return;

    const canvas = exportCanvas || nodusCanvas.getCanvas();

    const p = getPath(CK, "elastic_line");
    p.rewind();
    const startX = startPoint ? startPoint.x : fromNode.x + fromNode.width / 2;
    const startY = startPoint ? startPoint.y : fromNode.y + fromNode.height / 2;
    
    p.moveTo(startX, startY);
    const cpOffset = (mousePos.x - startX) / 2;
    p.quadTo(startX + cpOffset, startY, mousePos.x, mousePos.y);
    
    const linePaint = getPaint(CK, "elastic_line", (p) => {
        p.setStyle(CK.PaintStyle.Stroke);
        p.setStrokeWidth(2);
        p.setAntiAlias(true);
    });
    linePaint.setColor(CK.Color(51, 156, 255, 0.5));
    canvas.drawPath(p, linePaint);
};

let gridDotSize = 2;

export const drawGrid = (activePos: {x: number, y: number}) => {

    if(!nodusCanvas.canDraw()) return;

    const scale = nodusCanvas.camera.zoom();
    const offestX = nodusCanvas.camera.offsetX();
    const offestY = nodusCanvas.camera.offsetY();
    const CK = nodusCanvas.getCK();
    const canvas = nodusCanvas.getCanvas();

    const minScreenSpacing = 20;
    const gridSpacing = Math.ceil(minScreenSpacing / (scale * GRID_SIZE)) * GRID_SIZE;
    const dotSize = gridDotSize / scale;
    
    const wordlWidth = window.innerWidth / scale;
    const wordlHeight = window.innerHeight / scale;
    const startX = Math.floor((-offestX / scale) / gridSpacing) * gridSpacing;
    const startY = Math.floor((-offestY / scale) / gridSpacing) * gridSpacing;
    const endX = startX + Math.ceil(wordlWidth / gridSpacing) * gridSpacing;
    const endY = startY + Math.ceil(wordlHeight / gridSpacing) * gridSpacing;

    const paint = getPaint(CK, "dot_grid_unique", (_) => {});
    
    const shader = CK.Shader.MakeRadialGradient(
            [activePos.x, activePos.y],
            350 / scale,
            [CK.Color(180, 180, 180, 0.45), CK.TRANSPARENT],
            [0,1],
            CK.TileMode.Clamp
    );

    paint.setShader(shader);

    for(let x = startX; x < endX; x += gridSpacing){
        for(let y = startY; y < endY; y += gridSpacing){
            canvas.drawCircle(x - dotSize / 2, y - dotSize / 2, dotSize, paint);
        }
    }

    paint.setShader(null);
    shader.delete();
};

export const drawExternalCursor = (x: number, y: number, color: string, name: string) => {

    if(!nodusCanvas.canDraw()) return;

    const scale = nodusCanvas.camera.zoom();
    const CK = nodusCanvas.getCK();
    const canvas = nodusCanvas.getCanvas();

    const paint = getPaint(CK, `cursor_${name}`, (p) => p.setAntiAlias(true));
    const path = getPath(CK, `cursor_path_${name}`);
    path.rewind();
    path.moveTo(0, 0);
    path.lineTo(15 / scale, 12 / scale);
    path.lineTo(5 / scale, 11 / scale);
    path.lineTo(0, 20 / scale);
    path.close();

    canvas.save();
    canvas.translate(x, y);
    
    paint.setStyle(CK.PaintStyle.Stroke);
    paint.setStrokeWidth(2 / scale);
    const blurMask = CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 1, false);
    paint.setMaskFilter(blurMask);
    paint.setColor(CK.Color(255,255,255,0.6));
    canvas.drawPath(path, paint);

    paint.setColor(CK.parseColorString(color));
    paint.setStyle(CK.PaintStyle.Fill);
    paint.setMaskFilter(null);
    canvas.drawPath(path, paint);
    blurMask.delete();

    const textStyle = new CK.TextStyle({
        color: CK.WHITE,
        fontSize: 14 / scale,
        fontFamilies: ['Inter 28pt Mudium']        
    });
    const paragraphStyle = new CK.ParagraphStyle({
        textStyle: textStyle,
        textAlign: CK.TextAlign.Left,
    });
    const paragraph = getParagraph(CK, name, paragraphStyle, nodusCanvas.getFont()!, `cursor_${name}`);
    if (paragraph) {
        try {
            paragraph.layout(300 / scale);
            canvas.drawParagraph(paragraph, 12 / scale, 20 / scale);
        } catch (e) {
            console.warn('drawGrid label: skipped drawing due to error', e);
        }
    } else if (DIAG_LOGS) {
        console.warn(`drawGrid label: missing paragraph for name=${name}`);
    }

    canvas.restore();
};

export const drawPings = () => {

    if(!nodusCanvas.canDraw()) return;

    const scale = nodusCanvas.camera.zoom();
    const now = Date.now();
    const CK = nodusCanvas.getCK();
    const paint = getPaint(CK, "pings", (p) => {
        p.setStyle(CK.PaintStyle.Stroke);
        p.setStrokeWidth(2 / scale);
        p.setAntiAlias(true);
    });

    const canvas = nodusCanvas.getCanvas();

    pings.forEach(ping => {
        const elapsed = now - ping.startTime;
        const progess = elapsed / 1500;

        if (progess >= 1) return;

        const radius = progess * 60 / scale;
        const opacity = 1 - progess;

        paint.setColor(CK.parseColorString(ping.color));
        paint.setAlphaf(opacity);

        canvas.drawCircle(ping.x, ping.y, radius, paint);
        
        if(progess < 0.8){
            canvas.drawCircle(ping.x, ping.y, radius * 0.6, paint);
        }

        paint.setStyle(CK.PaintStyle.Fill);
        canvas.drawCircle(ping.x, ping.y, (4 / scale) * (1 - progess), paint);
        paint.setStyle(CK.PaintStyle.Stroke);
    });
};

export const drawFloatingDataFlow = () => {
  if (!nodusCanvas.canDraw()) return;

  const result = dataFlowResult();
  if (!result) return;

  const ck = nodusCanvas.getCK();
  const canvas = nodusCanvas.getCanvas();
  const center = nodusCanvas.camera.getWorldCenter();

  // 1. Configuración de dimensiones
  const paddingX = 14;
  const paddingY = 8;
  const borderRadius = 8;
  const fontSize = 13;

  const font = new ck.Font(null, fontSize);

  // 2. Medición exacta en CanvasKit JS (Glyphs + FontMetrics)
  const glyphs = font.getGlyphIDs(result);
  const widths = font.getGlyphWidths(glyphs); // Devuelve Float32Array con el ancho de cada carácter
  const textWidth = widths.reduce((acc: number, w: number) => acc + w, 0);

  const metrics = font.getMetrics(); 
  // metrics.ascent es negativo (ej: -10) y metrics.descent es positivo (ej: +3)
  const textHeight = metrics.descent - metrics.ascent;

  // 3. Dimensiones de la píldora flotante
  const pillWidth = Math.max(textWidth + paddingX * 2, 40);
  const pillHeight = textHeight + paddingY * 2;

  const left = center.x - pillWidth / 2;
  const top = center.y - pillHeight / 2;
  const right = center.x + pillWidth / 2;
  const bottom = center.y + pillHeight / 2;

  const rrect = ck.RRectXY(
    ck.LTRBRect(left, top, right, bottom),
    borderRadius,
    borderRadius
  );

  // 4. Pinturas (Paints)
  const shadowPaint = new ck.Paint();
  shadowPaint.setColor(ck.parseColorString('#38BDF8')); // Cyan
  shadowPaint.setAlphaf(0.35);
  shadowPaint.setMaskFilter(
    ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, 6, true)
  );

  const bgPaint = new ck.Paint();
  bgPaint.setColor(ck.parseColorString('#0F172A')); // Fondo muy oscuro
  bgPaint.setStyle(ck.PaintStyle.Fill);
  bgPaint.setAntiAlias(true);

  const borderPaint = new ck.Paint();
  borderPaint.setColor(ck.parseColorString('#38BDF8'));
  borderPaint.setStyle(ck.PaintStyle.Stroke);
  borderPaint.setStrokeWidth(1.5);
  borderPaint.setAntiAlias(true);

  const textPaint = new ck.Paint();
  textPaint.setColor(ck.parseColorString('#FFFFFF'));
  textPaint.setAntiAlias(true);

  // 5. Renderizado en capas
  canvas.drawRRect(rrect, shadowPaint);
  canvas.drawRRect(rrect, bgPaint);
  canvas.drawRRect(rrect, borderPaint);

  // Centrado geométrico exacto usando la línea base y la métrica de la fuente
  const textX = center.x - textWidth / 2;
  const textY = center.y - (metrics.ascent + metrics.descent) / 2;

  canvas.drawText(result, textX, textY, textPaint, font);

  // 6. Liberación de memoria en Wasm
  font.delete();
  shadowPaint.delete();
  bgPaint.delete();
  borderPaint.delete();
  textPaint.delete();
};


export const drawSelectionRect = () => {

    if(!nodusCanvas.canDraw()) return;

    const CK = nodusCanvas.getCK();
    const canvas = nodusCanvas.getCanvas();
    const rect = CK.RRectXY(CK.LTRBRect(selectionRect.x0, selectionRect.y0, selectionRect.x1, selectionRect.y1), 0, 0);

    const fillPaint = getPaint(CK, "selection_fill", (p) => p.setAntiAlias(true));
    fillPaint.setColor(CK.Color(64,150,255, 0.3));
    canvas.drawRRect(rect, fillPaint);

    const strokePaint = getPaint(CK, "selection_stroke", (p) => {
        p.setStyle(CK.PaintStyle.Stroke);
        p.setStrokeWidth(1);
        p.setAntiAlias(true);
    });
    strokePaint.setColor(CK.Color(64,150,255,0.8));
    canvas.drawRRect(rect, strokePaint);
};

export const drawConnectionPoint = (CK: CanvasKit, point: {x: number, y: number}, color: string = "#ffffff", exportCanvas?: Canvas) => {

    if(!nodusCanvas.canDraw() && !exportCanvas) return;

    const canvas = exportCanvas || nodusCanvas.getCanvas();

    const fillPaint = getPaint(CK, `point_fill_${color}`, (p) => p.setStyle(CK.PaintStyle.Fill));
    fillPaint.setColor(CK.parseColorString(color));
    canvas.drawCircle(point.x, point.y, 5 / nodusCanvas.camera.zoom(), fillPaint);

    const strokePaint = getPaint(CK, "point_stroke", (p) => {
        p.setStyle(CK.PaintStyle.Stroke);
        p.setStrokeWidth(1 / nodusCanvas.camera.zoom());
    });
    strokePaint.setColor(CK.parseColorString("#000000"));
    canvas.drawCircle(point.x, point.y, 5 / nodusCanvas.camera.zoom(), strokePaint);
};

export const exportDiagramAsPng = async (_scale?: any) => {

    let scale = 0;

    try {
        scale = parseInt(_scale || 1);
    } catch (e){
        showToast(`Parametro de escala ${_scale} invalido`, ToastType.ERROR);
        return;
    }

    if(!scale || scale === null){
        showToast(`Parametro de escala ${_scale} invalido`, ToastType.ERROR);
        return;
    }

    if(scale > 10){
        showToast(`Parametro de escala ${_scale} debe ser menor o igual a 10`, ToastType.ERROR);
        return;
    }

    const toastId = showToast("Preparing for export...", ToastType.PROCESSING);
    const bounds = calculateDiagramBounds(nodes);
    const CK = nodusCanvas.getCK();
    const realScale = scale || 1;
    const surfaceWidth = bounds.width * realScale;
    const surfaceHeight = bounds.height * realScale;

    console.log(`Exporting with scale factor ${realScale} (${surfaceWidth}x${surfaceHeight})`);

    const sufrace = CK.MakeSurface(surfaceWidth, surfaceHeight);
    if(!sufrace){
        removeToast(toastId);
        showToast("Error creating rendering surface", ToastType.ERROR);
        return;
    }

    const canvas = sufrace.getCanvas();
    canvas.clear((userData.currentProjectProperties as any).backgroundColor ? CK.parseColorString((userData.currentProjectProperties as any).backgroundColor) : CK.TRANSPARENT);
    canvas.scale(realScale, realScale);
    canvas.translate(-bounds.x, -bounds.y);

    nodes.filter(node => node.lock).forEach(node => {
        drawNode(CK, node, canvas);
        drawNodeText(CK, node, nodusCanvas.getFont(), canvas);
    });

    connections.forEach(conn => {
        const fromNode = getNode(conn.from);
        const toNode = getNode(conn.to);
        if(fromNode && toNode){
            drawConnection(CK, fromNode, toNode, conn, canvas);
        }
    });

    nodes.filter(node => !node.lock).forEach(node => {
        drawNode(CK, node, canvas);
        drawNodeText(CK, node, nodusCanvas.getFont(), canvas);
    });

    sufrace.flush();
    const image = sufrace.makeImageSnapshot();
    const pngBytes = image.encodeToBytes();

    const filePath = await save({
        filters: [{ name: 'Image', extensions: ['png'] }],
        defaultPath: `${userData.currentProjectName}_scale(${scale})_nodus_flow.png`
    });

    if(filePath && pngBytes){
        try {
            await writeFile(filePath, pngBytes);
            removeToast(toastId);
            showToast("Saved PNG!", ToastType.SUCCES);
        } catch (error) {
            removeToast(toastId);
            showToast(`Error saving: ${error}`, ToastType.ERROR);
        }
    } else {
        removeToast(toastId);
    }

    image.delete();
    sufrace.delete();
};

export const exportDiagramAsSVG = async () => {

    const toastId = showToast("Generando SVG...", ToastType.PROCESSING);

    await new Promise(resolve => setTimeout(resolve, 50));

    try{

        const bounds = calculateDiagramBounds([...nodes]);
        const margin = 50;
        const width = bounds.width + margin*2;
        const height = bounds.height + margin*2;
        const bgColor = (userData.currentProjectProperties as any)?.backgroundColor || '#021830';

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 ${width} ${height}" 
            width="${width}" 
            height="${height}"
            style="background-color: ${bgColor}; font-family: 'Inter', sans-serif;"
            >`;

        const nodesNormalize = [...nodes].map(node => ({
            ...node,
            "x": node.x - bounds.x + margin,
            "y": node.y - bounds.y + margin
        }))

        const getNormalizedNode = (id: string) => {
            return nodesNormalize.find(n => n.id === id);
        };
        
        // ----- 2. DIBUJAR NODOS (BLOQUEADOS) -----
        nodesNormalize.filter(node => node.lock).forEach(node => {
            svg += drawNodeSvg(node);
        });

        [...connections].forEach(conn => {
            const fromNode = getNormalizedNode(conn.from);
            const toNode = getNormalizedNode(conn.to);

            if(!fromNode || !toNode) return;

            const pathData = getConnectionPathData(fromNode, toNode, conn);
            const d = getSVGPathFromConnectionData(pathData);

            const color = conn.properties?.color || fromNode.color;
            const thickness = conn.properties?.thickness || 2;
            const dashed = conn.properties?.dashed ? `stroke-dasharray="8,4"` : '';

            const opacity = 1;

            svg += `
                <path d="${d}" 
                    stroke="${color}" 
                    stroke-width="${thickness + 2}" 
                    fill="none" 
                    opacity="0.2"
                    ${dashed}
                />
                <path d="${d}" 
                    stroke="${color}" 
                    stroke-width="${thickness}" 
                    fill="none" 
                    opacity="${opacity}"
                    ${dashed}
                />
            `;

            if (conn.properties?.label) {
                const { start, end } = pathData;
                const cx = (start.x + end.x) / 2 + margin;
                const cy = (start.y + end.y) / 2 + margin;
                const labelColor = conn.properties?.labelColor || '#ffffff';
                const fontSize = conn.properties?.fontSize || 14;
                const labelPosition = conn.properties?.labelPosition || 5;
                
                svg += `
                    <text x="${cx}" y="${cy - labelPosition}" 
                        fill="${labelColor}" 
                        font-size="${fontSize}" 
                        text-anchor="middle" 
                        font-family="Inter, sans-serif"
                    >${conn.properties.label}</text>
                `;
            }
        });

        
        // ----- 3. DIBUJAR NODOS (NO BLOQUEADOS) -----
        nodesNormalize.filter(node => !node.lock).forEach(node => {
            svg += drawNodeSvg(node);
        });
        
        svg += `</svg>`;

        // Descargar
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${userData.currentProjectName || 'nodus_flow'}_diagram.svg`;
        link.click();
        URL.revokeObjectURL(url);
        
        removeToast(toastId);
        showToast(`SVG exportado! (${nodes.length} nodos, ${connections.length} conexiones)`, ToastType.SUCCES);
        
    } catch (error) {
        removeToast(toastId);
        console.error("SVG Export error:", error);
        showToast(`Error al exportar SVG: ${error}`, ToastType.ERROR);
    }

}

// ----- FUNCIÓN AUXILIAR PARA DIBUJAR NODO EN SVG -----
function drawNodeSvg(node: Node): string {
    const x = node.x;
    const y = node.y;
    const w = node.width;
    const h = node.height;
    const color = node.color;
    const opacity = node.opacity || 1;
    const radius = node.radius || 8;
    const title = node.title || "";
    const fontSize = node.properties?.fontSize || 15;
    const textColor = obtenerColorTexto(color);
    
    let shape = '';
    const style = node.style || 1;
    
    // Borde con estilo (dashed, double, etc.)
    const borderWidth = node.properties?.borderWidth || 2;
    const dashedBorder = node.properties?.dashedBorder;
    const doubleBorder = node.properties?.doubleBorder;
    
    // Cuerpo del nodo
    if (style === 2) {
        // Elipse
        shape = `<ellipse cx="${x + w/2}" cy="${y + h/2}" rx="${w/2}" ry="${h/2}" 
            fill="${color}" opacity="${opacity}"/>`;
    } else if (style === 3) {
        // Diamante
        shape = `<polygon points="${x + w/2},${y} ${x + w},${y + h/2} ${x + w/2},${y + h} ${x},${y + h/2}" 
            fill="${color}" opacity="${opacity}"/>`;
    } else {
        // Rectángulo redondeado (default)
        shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" ry="${radius}" 
            fill="${color}" opacity="${opacity}"/>`;
    }
    
    let result = shape;
    
    // Borde punteado (dashedBorder)
    if (dashedBorder) {
        const dash = parseInt(dashedBorder) || 3;
        // Dibujar un borde punteado encima
        if (style === 1) {
            result += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" ry="${radius}" 
                fill="none" stroke="${color}" stroke-width="${borderWidth + 1}" 
                stroke-dasharray="${dash},${dash}" opacity="${opacity}"/>`;
        } else if (style === 2) {
            result += `<ellipse cx="${x + w/2}" cy="${y + h/2}" rx="${w/2}" ry="${h/2}" 
                fill="none" stroke="${color}" stroke-width="${borderWidth + 1}" 
                stroke-dasharray="${dash},${dash}" opacity="${opacity}"/>`;
        }
    }
    
    // Doble borde
    if (doubleBorder && !dashedBorder) {
        if (style === 1) {
            result += `<rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" 
                rx="${radius + 6}" ry="${radius + 6}" 
                fill="none" stroke="${color}" stroke-width="3" opacity="${opacity}"/>`;
        } else if (style === 2) {
            result += `<ellipse cx="${x + w/2}" cy="${y + h/2}" rx="${w/2 + 6}" ry="${h/2 + 6}" 
                fill="none" stroke="${color}" stroke-width="3" opacity="${opacity}"/>`;
        }
    }
    
    const textMaxWidth = w - 20; // 10px de padding a cada lado
    
    if (title) {
        const textY = y + (h / 2);
        
        result += renderTextToSvg(
            title,
            x + w / 2,        // <-- Centro del nodo
            textY,            // <-- Centro vertical del nodo
            textMaxWidth,
            fontSize,
            textColor,
            "center",         // <-- Centrado horizontal
            "Inter, sans-serif",
            node.properties?.underline ? 'text-decoration="underline"' : ''
        );
    }
    
    // ----- TEXTOS OPCIONALES -----
    
    // Text Above: centrado sobre el nodo
    if (node.properties?.textAbove) {
        const aboveFontSize = node.properties.textAboveFontSize || 12;
        const aboveColor = node.properties.textAboveColor || color;
        const aboveMaxWidth = w;
        const aboveLayout = estimateTextLayout(node.properties.textAbove, aboveMaxWidth, aboveFontSize);
        const aboveHeight = aboveLayout.height || aboveFontSize;
        const aboveY = y - 8 - aboveHeight / 2;  // Centrado verticalmente sobre el nodo
        
        result += renderTextToSvg(
            node.properties.textAbove,
            x + w / 2,        // <-- Centro del nodo
            aboveY,           // <-- Centro vertical del texto
            aboveMaxWidth,
            aboveFontSize,
            aboveColor,
            "center"          // <-- Centrado horizontal
        );
    }
    
    // Text Below: centrado bajo el nodo
    if (node.properties?.textBelow) {
        const belowFontSize = node.properties.textBelowFontSize || 12;
        const belowColor = node.properties.textBelowColor || color;
        const belowMaxWidth = w;
        const belowLayout = estimateTextLayout(node.properties.textBelow, belowMaxWidth, belowFontSize);
        const belowHeight = belowLayout.height || belowFontSize;
        const belowY = y + h + 8 + belowHeight / 2;  // Centrado verticalmente bajo el nodo
        
        result += renderTextToSvg(
            node.properties.textBelow,
            x + w / 2,        // <-- Centro del nodo
            belowY,           // <-- Centro vertical del texto
            belowMaxWidth,
            belowFontSize,
            belowColor,
            "center"          // <-- Centrado horizontal
        );
    }
    
    // Text Left: alineado a la derecha, centrado verticalmente
    if (node.properties?.textLeft) {
        const leftFontSize = node.properties.textLeftFontSize || 12;
        const leftColor = node.properties.textLeftColor || color;
        const leftMaxWidth = 200;
        const leftX = x - 8;                    // <-- Borde derecho del texto (text-anchor="end")
        const leftY = y + h / 2;                // <-- Centro vertical del nodo
        
        result += renderTextToSvg(
            node.properties.textLeft,
            leftX,            // <-- Borde derecho del texto
            leftY,            // <-- Centro vertical
            leftMaxWidth,
            leftFontSize,
            leftColor,
            "right"           // <-- Alineado a la derecha (text-anchor="end")
        );
    }
    
    // Text Right: alineado a la izquierda, centrado verticalmente
    if (node.properties?.textRight) {
        const rightFontSize = node.properties.textRightFontSize || 12;
        const rightColor = node.properties.textRightColor || color;
        const rightMaxWidth = 200;
        const rightX = x + w + 8;               // <-- Borde izquierdo del texto (text-anchor="start")
        const rightY = y + h / 2;               // <-- Centro vertical del nodo
        
        result += renderTextToSvg(
            node.properties.textRight,
            rightX,           // <-- Borde izquierdo del texto
            rightY,           // <-- Centro vertical
            rightMaxWidth,
            rightFontSize,
            rightColor,
            "left"            // <-- Alineado a la izquierda (text-anchor="start")
        );
    }
    
    // ----- MEMBERSHIPS (E/R) - Versión mejorada -----
    if (node.properties?.disjointMembership) {
        const cx = node.x + node.width / 2;
        const bottomY = node.y + node.height;
        const arcStartX = node.x - 60;
        const arcEndX = node.x + node.width + 60;
        
        // Arco semicircular
        result += `
            <path d="M ${arcStartX} ${bottomY + 40} 
                Q ${cx} ${bottomY + 100} ${arcEndX} ${bottomY + 40}" 
                fill="none" 
                stroke="${color}" 
                stroke-width="2"
            />
        `;
    }

    if (node.properties?.overlappingMembership) {
        const bottomY = node.y + node.height;
        const lineStartX = node.x - 60;
        const lineEndX = node.x + node.width + 60;
        
        // Línea punteada horizontal
        result += `
            <line x1="${lineStartX}" y1="${bottomY + 40}" 
                x2="${lineEndX}" y2="${bottomY + 40}" 
                stroke="${color}" 
                stroke-width="2.5" 
                stroke-dasharray="6,4"
            />
        `;
    }

    return result;
}