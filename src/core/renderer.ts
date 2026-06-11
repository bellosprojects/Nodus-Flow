import { Canvas, CanvasKit, FontMgr } from "canvaskit-wasm";
import { getNode, Node, nodes, ocupadoPor, selectedNodesIds } from "../models/nodes";
import { calculateDiagramBounds, NodeToNode } from "../utils/path";
import { HexToColor } from "../utils/color";
import { obtenerColorTexto } from "../utils/color";
import { GRID_SIZE } from "../utils/math";
import { flowConecctions, selectionRect, ANCHOR_POINT } from "../views/Editor/Editor";
import { nodusCanvas } from "../core/NodusCanvas";
import { Connection, connections, selectedConnectionId } from "../models/connections";
import { pings } from "../models/ping";
import { removeToast, showToast, ToastType } from "../models/toast";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { createSignal } from "solid-js";
import { userData } from "../models/userStore";

// Cache de pinturas reutilizables
const paintCache = new Map<string, any>();
const pathCache = new Map<string, any>();
const shaderCache = new Map<string, any>();
const paragraphCache = new Map<string, any>();

function getPaint(CK: CanvasKit, key: string, init: (paint: any) => void): any {
    let paint = paintCache.get(key);
    if (!paint) {
        paint = new CK.Paint();
        paintCache.set(key, paint);
    }
    init(paint);
    return paint;
}

function getPath(CK: CanvasKit, key: string): any {
    let path = pathCache.get(key);
    if (!path) {
        path = new CK.Path();
        pathCache.set(key, path);
    }
    return path;
}

function getShader(_: CanvasKit, key: string, init: () => any): any {
    let shader = shaderCache.get(key);
    if (!shader) {
        shader = init();
        shaderCache.set(key, shader);
    }
    return shader;
}

function getParagraph(CK: CanvasKit, text: string, style: any, fontMgr: FontMgr): any {
    const key = `${text}_${JSON.stringify(style)}`;
    let paragraph = paragraphCache.get(key);
    if (!paragraph) {
        const builder = CK.ParagraphBuilder.Make(style, fontMgr);
        builder.addText(text);
        paragraph = builder.build();
        paragraphCache.set(key, paragraph);
    }
    return paragraph;
}

// Limpiar caché cuando cambia el zoom (para textos que dependen del tamaño)
export function invalidateParagraphCache() {
    paragraphCache.forEach(p => p.delete());
    paragraphCache.clear();
}

export const drawNodeOpcionalText = (CK: CanvasKit, canvas: Canvas, node: Node) => {
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

        const textAboveParagraph = getParagraph(CK, node.properties.textAbove, textAboveParagraphStyle, nodusCanvas.getFont()!);
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

        const textBelowParagraph = getParagraph(CK, node.properties.textBelow, textBelowParagraphStyle, nodusCanvas.getFont()!);
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

        const textLeftParagraph = getParagraph(CK, node.properties.textLeft, textLeftParagraphStyle, nodusCanvas.getFont()!);
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
        
        const textRightParagraph = getParagraph(CK, node.properties.textRight, textRightParagraphStyle, nodusCanvas.getFont()!);
        textRightParagraph.layout(200);
        canvas.drawParagraph(textRightParagraph, node.x + node.width + (node.properties.textOffset || 5), node.y + (node.height / 2) - (textRightParagraph.getHeight() / 2));
    }
};

export const drawNode = (CK: CanvasKit, canvas: Canvas, node: Node, isExport = false) => {
    const color = HexToColor(node.color);
    const fillColor = CK.Color(color[0], color[1], color[2], node.opacity);
    const rectBounds = CK.LTRBRect(node.x, node.y, node.x + node.width, node.y + node.height);

    if(node.properties.dashedBorder){
        const paint = getPaint(CK, `dashed_${node.id}`, (p) => {
            p.setAntiAlias(true);
            p.setDither(true);
            p.setStyle(CK.PaintStyle.Stroke);
        });
        
        const dash = node.properties.dashedBorder || 3;
        const dashPathEffect = CK.PathEffect.MakeDash([dash, dash], 0);
        const borderWidth = node.properties.borderWidth || 2;
        const path = getPath(CK, `dashed_path_${node.id}`);
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
                const rrect = CK.RRectXY(rectBounds, node.radius, node.radius);
                path.addRRect(rrect);
        }

        paint.setPathEffect(dashPathEffect);
        paint.setStrokeWidth(borderWidth);
        canvas.drawPath(path, paint);
        paint.setPathEffect(null);
        dashPathEffect.delete();
    } else {
        const fillPaint = getPaint(CK, `fill_${node.id}_${node.opacity}`, (p) => {
            p.setAntiAlias(true);
            p.setDither(true);
            p.setStyle(CK.PaintStyle.Fill);
        });
        fillPaint.setColor(fillColor);

        switch(node.style){
            case 2:
                canvas.drawOval(rectBounds, fillPaint);
                break;
            case 3:
                const shapePath = getPath(CK, `diamond_${node.id}`);
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
                const rrect = CK.RRectXY(rectBounds, node.radius, node.radius);
                canvas.drawRRect(rrect, fillPaint);
        }
    }
    
    if(node.properties.doubleBorder && !node.properties.dashedBorder){
        const borderPaint = getPaint(CK, `border_${node.id}`, (p) => {
            p.setStyle(CK.PaintStyle.Stroke);
            p.setStrokeWidth(3);
            p.setAntiAlias(true);
        });
        borderPaint.setColor(fillColor);

        switch(node.style){
            case 2:
                canvas.drawOval(CK.LTRBRect(node.x - 6, node.y - 6, node.x + node.width + 6, node.y + node.height + 6), borderPaint);
                break;
            case 3:
                const diamondPath = getPath(CK, `double_border_diamond_${node.id}`);
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
                const rrectBorder = CK.RRectXY(CK.LTRBRect(node.x - 6, node.y - 6, node.x + node.width + 6, node.y + node.height + 6), node.radius + 6, node.radius + 6);
                canvas.drawRRect(rrectBorder, borderPaint);
        }
    }

    if(node.properties.disjointMembership){
        const semiPaint = getPaint(CK, `semi_${node.id}`, (p) => {
            p.setStyle(CK.PaintStyle.Stroke);
            p.setStrokeWidth(2);
            p.setAntiAlias(true);
            p.setColor(CK.parseColorString(node.color));
        });
        const semiPath = getPath(CK, `semi_path_${node.id}`);
        semiPath.rewind();
        const cx = node.x + node.width / 2;
        const height = node.y + node.height;
        semiPath.moveTo(node.x - 60, height + 40);
        semiPath.quadTo(cx, node.y + node.height + 100, node.x + node.width + 60, height + 40);
        canvas.drawPath(semiPath, semiPaint);
    } else if(node.properties.overlappingMembership){
        const overlapPaint = getPaint(CK, `overlap_${node.id}`, (p) => {
            p.setStyle(CK.PaintStyle.Stroke);
            p.setStrokeWidth(2);
            p.setAntiAlias(true);
            p.setColor(CK.parseColorString(node.color));
        });
        const overlapPath = getPath(CK, `overlap_path_${node.id}`);
        overlapPath.rewind();
        const y = node.y + node.height + 40;
        overlapPath.moveTo(node.x - 60, y);
        overlapPath.lineTo(node.x + node.width + 60, y);
        overlapPath.dash(5, 5, 0);
        canvas.drawPath(overlapPath, overlapPaint);
    }

    if(!isExport){
        const user = ocupadoPor(node.id);
        if(user){
            const occupiedPaint = getPaint(CK, `occupied_${node.id}`, (p) => {
                p.setAlphaf(1);
                p.setStyle(CK.PaintStyle.Stroke);
                p.setStrokeWidth(5);
                p.setAntiAlias(true);
            });
            occupiedPaint.setColor(CK.parseColorString(user.color));

            if(node.style === 2){
                canvas.drawOval(CK.LTRBRect(node.x - 5, node.y - 5, node.x + node.width + 5, node.y + node.height + 5), occupiedPaint);
            } else if(node.style === 3){
                const bigPath = getPath(CK, `occupied_diamond_${node.id}`);
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
                const rect2 = CK.RRectXY(CK.LTRBRect(node.x - 5, node.y - 5, node.x + node.width + 5, node.y + node.height + 5), node.radius + 5, node.radius + 5);
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
            const textParagraph = getParagraph(CK, `Occupied by: ${user.nombre}`, paragraphStyle, nodusCanvas.getFont()!);
            textParagraph.layout(300);
            canvas.drawParagraph(textParagraph, node.x + 10, node.y - 22);
        } else if(selectedNodesIds().includes(node.id)){
            const colorText = obtenerColorTexto(node.color);
            const selectedPaint = getPaint(CK, `selected_${node.id}`, (p) => {
                p.setAlphaf(1);
                p.setStyle(CK.PaintStyle.Stroke);
                p.setStrokeWidth(4);
                p.setAntiAlias(true);
            });
            selectedPaint.setColor(CK.parseColorString(colorText));

            if(node.style === 2){
                canvas.drawOval(CK.LTRBRect(node.x - 2, node.y - 2, node.x + node.width + 2, node.y + node.height + 2), selectedPaint);
            } else if(node.style === 3){
                const selPath = getPath(CK, `selected_diamond_${node.id}`);
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
                const rectSel = CK.RRectXY(CK.LTRBRect(node.x - 2, node.y - 2, node.x + node.width + 2, node.y + node.height + 2), node.radius + 4, node.radius + 4);
                canvas.drawRRect(rectSel, selectedPaint);
            }
        }
    }

    drawNodeOpcionalText(CK, canvas, node);
};

export const drawNodeGrid = (CK: CanvasKit, canvas: Canvas, node: Node) => {
    const paint = getPaint(CK, `grid_${node.id}`, (p) => {
        p.setStyle(CK.PaintStyle.Stroke);
        p.setStrokeWidth(1);
        p.setAntiAlias(true);
    });
    paint.setColor(CK.Color(155,155,255,0.5));

    const startX = -nodusCanvas.camera.offsetX() / nodusCanvas.camera.zoom();
    const startY = -nodusCanvas.camera.offsetY() / nodusCanvas.camera.zoom();
    const endX = startX + nodusCanvas.camera.getWordlSize().width;
    const endY = startY + nodusCanvas.camera.getWordlSize().height;
    
    canvas.drawLine(node.x + node.width, startY, node.x + node.width, endY, paint);
    canvas.drawLine(node.x, startY, node.x, endY, paint);
    canvas.drawLine(startX, node.y, endX, node.y, paint);
    canvas.drawLine(startX, node.y + node.height, endX, node.y + node.height, paint);
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

export const drawResizingBox = (CK: CanvasKit, canvas: Canvas, nodes: Node[]) => {
    const bounds = calculateDiagramBounds(nodes);
    const rect = CK.XYWHRect(bounds.x - MARGIN_BOX, bounds.y - MARGIN_BOX, bounds.width + MARGIN_BOX * 2, bounds.height + MARGIN_BOX * 2);

    const paint = getPaint(CK, "resizing_box", (p) => {
        p.setStyle(CK.PaintStyle.Stroke);
        p.setAntiAlias(true);
    });
    paint.setColor(CK.Color(64, 150, 255));
    canvas.drawRect(rect, paint);
    
    const newDots: {x:number, y:number, direction: ANCHOR_POINT}[] = [];
    const fillPaint = getPaint(CK, "resizing_dot_fill", (p) => p.setStyle(CK.PaintStyle.Fill));
    const strokePaint = getPaint(CK, "resizing_dot_stroke", (p) => {
        p.setStyle(CK.PaintStyle.Stroke);
        p.setStrokeWidth(1);
    });
    
    anchorPoints.forEach(point => {
        fillPaint.setColor(CK.Color(240,240,240));
        strokePaint.setColor(CK.Color(7,5,5));
        
        const absolutePointPosition = {
            x: bounds.x - MARGIN_BOX + (bounds.width + MARGIN_BOX * 2) * point.x,
            y: bounds.y - MARGIN_BOX + (bounds.height + MARGIN_BOX * 2) * point.y
        };
        const anchorRect = CK.XYWHRect(absolutePointPosition.x - 4, absolutePointPosition.y - 4, 8, 8);

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

export const drawConnection = (CK: CanvasKit, canvas: Canvas, fromNode: Node, toNode: Node, conn: Connection, isExport = false) => {
    const linePaint = getPaint(CK, `conn_${conn.id}`, (p) => {
        p.setStyle(CK.PaintStyle.Stroke);
        p.setAntiAlias(true);
        p.setDither(true);
    });
    linePaint.setColor(CK.Color(255,255,255)); 
    
    const fromColor = CK.Color(HexToColor(fromNode.color)[0], HexToColor(fromNode.color)[1], HexToColor(fromNode.color)[2]);
    const toColor = CK.Color(HexToColor(toNode.color)[0], HexToColor(toNode.color)[1], HexToColor(toNode.color)[2]);

    const path = NodeToNode(CK, fromNode, toNode, conn);

    const shader = getShader(CK, `gradient_${fromNode.id}_${toNode.id}`, () => 
        CK.Shader.MakeLinearGradient(
            [fromNode.x + fromNode.width / 2, fromNode.y + fromNode.height / 2],
            [toNode.x + toNode.width / 2, toNode.y + toNode.height / 2],
            [fromColor, toColor, fromColor],
            [2 * flowConecctions - 1, 2 * flowConecctions - 0.5, 2 * flowConecctions],
            CK.TileMode.Clamp
        )
    );

    if(selectedConnectionId() !== conn.id || isExport){
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
        const textParagraph = getParagraph(CK, conn.properties.label, textParagraphStyle, nodusCanvas.getFont()!);

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
};

export const drawBackground = () => {
    const nodus = nodusCanvas;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const CK = nodus.getCK();
    const canvas = nodus.getCanvas();
    
    const diagonal = Math.sqrt(width * width + height * height);
    const paint = getPaint(CK, "background", (p) => {
        p.setDither(true);
        p.setAntiAlias(true);
    });

    const gradient = getShader(CK, "bg_gradient1", () => 
        CK.Shader.MakeRadialGradient(
            [0, 0], diagonal, 
            [CK.Color(30, 14, 36), CK.Color(0,0,0,0)],
            [0, 1],
            CK.TileMode.Clamp
        )
    );

    const gradient2 = getShader(CK, "bg_gradient2", () => 
        CK.Shader.MakeRadialGradient(
            [width, height], diagonal, 
            [CK.Color(12, 42, 26), CK.Color(0,0,0,0)],
            [0, 1],
            CK.TileMode.Clamp
        )
    );

    paint.setShader(gradient);
    canvas.drawRect(CK.LTRBRect(0, 0, diagonal, diagonal), paint);
    
    paint.setShader(gradient2);
    canvas.drawRect(CK.LTRBRect(width - diagonal, height - diagonal, width, height), paint);
};

export const drawNodeText = (CK: CanvasKit, canvas: Canvas, node: Node, fontMgr: FontMgr | null) => {
    if(!fontMgr) return;

    const color = obtenerColorTexto(node.color);
    const haveUnderline = node.properties.underline || false;
    const isDashedUnderline = node.properties.dashedUnderline || false;

    const textStyle = new CK.TextStyle({
        color: CK.parseColorString(color),
        fontSize: node.properties.fontSize || 15,
        fontFamilies: ['Inter 28pt Mudium'],
        decoration: haveUnderline ? CK.UnderlineDecoration : CK.NoDecoration,
        decorationColor: CK.parseColorString(color),
        decorationThickness: 1,
        decorationStyle: isDashedUnderline ? CK.DecorationStyle.Dashed : CK.DecorationStyle.Solid
    });

    const paragraphStyle = new CK.ParagraphStyle({
        textStyle: textStyle,
        textAlign: CK.TextAlign.Center,
    });

    const paragraph = getParagraph(CK, node.title || "Nuevo Nodo", paragraphStyle, fontMgr);
    paragraph.layout(node.width - 20);
    canvas.drawParagraph(paragraph, node.x + 10, node.y + (node.height / 2) - paragraph.getHeight() / 2);
};

export const drawElasticLine = (CK: CanvasKit, canvas: Canvas, fromNode: Node, mousePos: any, startPoint?: {x:number,y:number}) => {
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

let lastGridActivePos = { x: 0, y: 0 };
let lastGridScale = 0;
let gridDotSize = 1.5;
let gridSpacing = 20;

export const drawGrid = (activePos: {x: number, y: number}) => {
    const scale = nodusCanvas.camera.zoom();
    const offsetX = nodusCanvas.camera.offsetX();
    const offsetY = nodusCanvas.camera.offsetY();

    // Actualizar valores de grid solo cuando cambia el zoom
    if (lastGridScale !== scale) {
        lastGridScale = scale;
        gridSpacing = Math.max(Math.round(GRID_SIZE / scale), 20);
        gridDotSize = 1.5 / scale;
    }

    const CK = nodusCanvas.getCK();
    const canvas = nodusCanvas.getCanvas();

    const startX = -offsetX / scale;
    const startY = -offsetY / scale;

    const paint = getPaint(CK, "grid", (_) => {});
    
    // Solo recrear shader si la posición activa cambió significativamente
    if(activePos && (Math.abs(activePos.x - lastGridActivePos.x) > 50 || Math.abs(activePos.y - lastGridActivePos.y) > 50)) {
        lastGridActivePos = { x: activePos.x, y: activePos.y };
        const oldShader = shaderCache.get("grid_gradient");
        if(oldShader) oldShader.delete();
        shaderCache.delete("grid_gradient");
    }
    
    if(activePos){
        const shader = getShader(CK, "grid_gradient", () => 
            CK.Shader.MakeRadialGradient(
                [activePos.x, activePos.y],
                350 / scale,
                [CK.Color(180, 180, 180, 0.45), CK.TRANSPARENT],
                [0,1],
                CK.TileMode.Clamp
            )
        );
        paint.setShader(shader);
    } else {
        return;
    }

    // Optimización: calcular límites de bucle una sola vez
    const canvasWidth = window.innerWidth / scale;
    const canvasHeight = window.innerHeight / scale;
    const maxX = canvasWidth + startX;
    const maxY = canvasHeight + startY;
    
    for(let x = startX; x < maxX; x += gridSpacing){
        for(let y = startY; y < maxY; y += gridSpacing){
            canvas.drawCircle(x, y, gridDotSize, paint);
        }
    }
};

export const drawExternalCursor = (x: number, y: number, color: string, name: string) => {
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
    const paragraph = getParagraph(CK, name, paragraphStyle, nodusCanvas.getFont()!);
    paragraph.layout(300 / scale);
    canvas.drawParagraph(paragraph, 12 / scale, 20 / scale);

    canvas.restore();
};

export const drawPings = () => {
    const scale = nodusCanvas.camera.zoom();
    const now = Date.now();
    const CK = nodusCanvas.getCK();
    const paint = getPaint(CK, "pings", (p) => {
        p.setStyle(CK.PaintStyle.Stroke);
        p.setStrokeWidth(2 / scale);
        p.setAntiAlias(true);
    });

    pings.forEach(ping => {
        const elapsed = now - ping.startTime;
        const progess = elapsed / 1500;

        if (progess >= 1) return;

        const radius = progess * 60 / scale;
        const opacity = 1 - progess;

        paint.setColor(CK.parseColorString(ping.color));
        paint.setAlphaf(opacity);

        const canvas = nodusCanvas.getCanvas();
        canvas.drawCircle(ping.x, ping.y, radius, paint);
        
        if(progess < 0.8){
            canvas.drawCircle(ping.x, ping.y, radius * 0.6, paint);
        }

        paint.setStyle(CK.PaintStyle.Fill);
        canvas.drawCircle(ping.x, ping.y, (4 / scale) * (1 - progess), paint);
        paint.setStyle(CK.PaintStyle.Stroke);
    });
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
    canvas.clear((userData.currentProjectProperties as any).backgroundColor ? CK.TRANSPARENT : CK.parseColorString((userData.currentProjectProperties as any).backgroundColor));
    canvas.scale(realScale, realScale);
    canvas.translate(-bounds.x, -bounds.y);

    nodes.filter(node => node.lock).forEach(node => {
        drawNode(CK, canvas, node, true);
        drawNodeText(CK, canvas, node, nodusCanvas.getFont());
    });

    connections.forEach(conn => {
        const fromNode = getNode(conn.from);
        const toNode = getNode(conn.to);
        if(fromNode && toNode){
            drawConnection(CK, canvas, fromNode, toNode, conn, true);
        }
    });

    nodes.filter(node => !node.lock).forEach(node => {
        drawNode(CK, canvas, node, true);
        drawNodeText(CK, canvas, node, nodusCanvas.getFont());
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

export const drawSelectionRect = () => {
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

export const drawConnectionPoint = (CK: CanvasKit, canvas: Canvas, point: {x: number, y: number}, color: string = "#ffffff") => {
    const fillPaint = getPaint(CK, `point_fill_${color}`, (p) => p.setStyle(CK.PaintStyle.Fill));
    fillPaint.setColor(CK.parseColorString(color));
    canvas.drawCircle(point.x, point.y, 5, fillPaint);

    const strokePaint = getPaint(CK, "point_stroke", (p) => {
        p.setStyle(CK.PaintStyle.Stroke);
        p.setStrokeWidth(1);
    });
    strokePaint.setColor(CK.parseColorString("#000000"));
    canvas.drawCircle(point.x, point.y, 5, strokePaint);
};