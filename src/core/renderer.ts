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

export const drawNodeOpcionalText = (CK: CanvasKit, canvas: Canvas, node: Node) => {
    /**
     * Texto superior (opcional)
     */

    if(node.properties.textAbove){

        const fontSize = node.properties.textAboveFontSize || 12;

        const textAboveStyle = new CK.TextStyle({
            color: CK.parseColorString(node.properties.textAboveColor || node.color),
            fontSize: fontSize,
            fontFamilies: ['Inter 28pt Mudium']
        });

        const textAboveParagraphStyle = new CK.ParagraphStyle({
            textStyle: textAboveStyle,
            textAlign: CK.TextAlign.Center,
        });

        const textAboveBuilder = CK.ParagraphBuilder.Make(textAboveParagraphStyle, nodusCanvas.getFont()!);

        textAboveBuilder.addText(node.properties.textAbove);

        const textAboveParagraph = textAboveBuilder.build();

        textAboveParagraph.layout(node.width);

        canvas.drawParagraph(textAboveParagraph, node.x, node.y - textAboveParagraph.getHeight() - (node.properties.textOffset || 5));

        textAboveParagraph.delete();
        textAboveBuilder.delete();
    }

    if(node.properties.textBelow){

        const fontSize = node.properties.textBelowFontSize || 12;

        const textBelowStyle = new CK.TextStyle({
            color: CK.parseColorString(node.properties.textBelowColor || node.color),
            fontSize: fontSize,
            fontFamilies: ['Inter 28pt Mudium']
        });

        const textBelowParagraphStyle = new CK.ParagraphStyle({
            textStyle: textBelowStyle,
            textAlign: CK.TextAlign.Center,
        });

        const textBelowBuilder = CK.ParagraphBuilder.Make(textBelowParagraphStyle, nodusCanvas.getFont()!);

        textBelowBuilder.addText(node.properties.textBelow);

        const textBelowParagraph = textBelowBuilder.build();

        textBelowParagraph.layout(node.width);

        canvas.drawParagraph(textBelowParagraph, node.x, node.y + node.height + (node.properties.textOffset || 5));

        textBelowParagraph.delete();
        textBelowBuilder.delete();
    }

    if(node.properties.textLeft){

        const fontSize = node.properties.textLeftFontSize || 12;

        const textLeftStyle = new CK.TextStyle({
            color: CK.parseColorString(node.properties.textLeftColor || node.color),
            fontSize: fontSize,
            fontFamilies: ['Inter 28pt Mudium']
        });

        const textLeftParagraphStyle = new CK.ParagraphStyle({
            textStyle: textLeftStyle,
            textAlign: CK.TextAlign.Right,
        });

        const textLeftBuilder = CK.ParagraphBuilder.Make(textLeftParagraphStyle, nodusCanvas.getFont()!);

        textLeftBuilder.addText(node.properties.textLeft);

        const textLeftParagraph = textLeftBuilder.build();

        textLeftParagraph.layout(200);

        canvas.drawParagraph(textLeftParagraph, node.x - textLeftParagraph.getMaxWidth() - (node.properties.textOffset || 5), node.y + (node.height / 2) - (textLeftParagraph.getHeight() / 2));

        textLeftParagraph.delete();
        textLeftBuilder.delete();
    }

    if(node.properties.textRight){

        const fontSize = node.properties.textRightFontSize || 12;
        const textRightStyle = new CK.TextStyle({
            color: CK.parseColorString(node.properties.textRightColor || node.color),
            fontSize: fontSize,
            fontFamilies: ['Inter 28pt Mudium']
        });

        const textRightParagraphStyle = new CK.ParagraphStyle({
            textStyle: textRightStyle,
            textAlign: CK.TextAlign.Left,
        });
        
        const textRightBuilder = CK.ParagraphBuilder.Make(textRightParagraphStyle, nodusCanvas.getFont()!);

        textRightBuilder.addText(node.properties.textRight);

        const textRightParagraph = textRightBuilder.build();

        textRightParagraph.layout(200);

        canvas.drawParagraph(textRightParagraph, node.x + node.width + (node.properties.textOffset || 5), node.y + (node.height / 2) - (textRightParagraph.getHeight() / 2));

        textRightParagraph.delete();
        textRightBuilder.delete();
    }
}

export const drawNode = (CK: CanvasKit, canvas: Canvas, node: Node, isExport = false) => {

    const color = HexToColor(node.color);
    const paint = new CK.Paint();

    paint.setAntiAlias(true);
    paint.setDither(true);

    const fillColor = CK.Color(color[0], color[1], color[2], node.opacity);
    const rectBounds = CK.LTRBRect(node.x, node.y, node.x + node.width, node.y + node.height);

    paint.setColor(fillColor);
    if(node.properties.dashedBorder){

        paint.setStyle(CK.PaintStyle.Stroke);
        const dash = node.properties.dashedBorder || 3;
        const dashPathEffect = CK.PathEffect.MakeDash([dash, dash], 0);
        const borderWidth = node.properties.borderWidth || 2;
        const path = new CK.Path();

        switch(node.style){
            case 2: // ellipse
                path.addOval(rectBounds);
                break;
            case 3: // diamond (rombo)
                const cx = node.x + node.width / 2;
                const cy = node.y + node.height / 2;
                path.moveTo(cx, node.y);
                path.lineTo(node.x + node.width, cy);
                path.lineTo(cx, node.y + node.height);
                path.lineTo(node.x, cy);
                path.close();
                break;
            default: // rectangle (default behavior)
                const rrect = CK.RRectXY(rectBounds, node.radius, node.radius);
                path.addRRect(rrect);
        }

        paint.setPathEffect(dashPathEffect);
        paint.setStrokeWidth(borderWidth);
        canvas.drawPath(path, paint);
        path.delete();
        dashPathEffect.delete();

        paint.setPathEffect(null);

    } else {
        // Draw shape based on node.style
        switch(node.style){
            case 2: // ellipse
                paint.setColor(fillColor);
                paint.setStyle(CK.PaintStyle.Fill);
                canvas.drawOval(rectBounds, paint);
                break;
            case 3: // diamond (rombo)
                paint.setColor(fillColor);
                paint.setStyle(CK.PaintStyle.Fill);
                const shapePath = new CK.Path();
                const cx = node.x + node.width / 2;
                const cy = node.y + node.height / 2;
                shapePath.moveTo(cx, node.y);
                shapePath.lineTo(node.x + node.width, cy);
                shapePath.lineTo(cx, node.y + node.height);
                shapePath.lineTo(node.x, cy);
                shapePath.close();
                canvas.drawPath(shapePath, paint);
                shapePath.delete();
                break;
            default: // rectangle (default behavior)
                paint.setColor(fillColor);
                paint.setStyle(CK.PaintStyle.Fill);
                const rrect = CK.RRectXY(rectBounds, node.radius, node.radius);
                canvas.drawRRect(rrect, paint);
        }
    }

    
    if(node.properties.doubleBorder && !node.properties.dashedBorder){

        paint.setStyle(CK.PaintStyle.Stroke);
        paint.setStrokeWidth(3);

        switch(node.style){
            case 2: // ellipse
                canvas.drawOval(CK.LTRBRect(node.x - 6, node.y - 6, node.x + node.width + 6, node.y + node.height + 6), paint);
                break;
            case 3: // diamond (rombo)
                const diamondPath = new CK.Path();
                const cx = node.x + node.width / 2;
                const cy = node.y + node.height / 2;
                diamondPath.moveTo(cx, node.y - 6);
                diamondPath.lineTo(node.x + node.width + 6, cy);
                diamondPath.lineTo(cx, node.y + node.height + 6);
                diamondPath.lineTo(node.x - 6, cy);
                diamondPath.close();
                canvas.drawPath(diamondPath, paint);
                diamondPath.delete();
                break;
            default: // rectangle (default behavior)
                const rrectBorder = CK.RRectXY(CK.LTRBRect(node.x - 6, node.y - 6, node.x + node.width + 6, node.y + node.height + 6), node.radius + 6, node.radius + 6);
                canvas.drawRRect(rrectBorder, paint);
        }
    }

    if(node.properties.disjointMembership){
        paint.setStyle(CK.PaintStyle.Stroke);
        paint.setStrokeWidth(2);
        
        //Semicirculo inferior con un margen de 100px

        const semiPath = new CK.Path();
        const cx = node.x + node.width / 2;
        const height = node.y + node.height;
        semiPath.moveTo(node.x - 60, height + 40);
        semiPath.quadTo(cx, node.y + node.height + 100, node.x + node.width + 60, height + 40);
        canvas.drawPath(semiPath, paint);
        semiPath.delete();
    } else if(node.properties.overlappingMembership){
        paint.setStyle(CK.PaintStyle.Stroke);
        paint.setStrokeWidth(2);

        const overlapPath = new CK.Path();
        const y = node.y + node.height + 40;

        overlapPath.moveTo(node.x - 60, y);
        overlapPath.lineTo(node.x + node.width + 60, y);
        overlapPath.dash(5, 5, 0);
        canvas.drawPath(overlapPath, paint);
        overlapPath.delete();
    }

    // Overlays: occupied / selected
    if(!isExport){
        const user = ocupadoPor(node.id);

        if(user){
            paint.setAlphaf(1);
            paint.setStyle(CK.PaintStyle.Stroke);
            paint.setColor(CK.parseColorString(user.color));
            paint.setStrokeWidth(5);

            if(node.style === 2){
                // ellipse
                canvas.drawOval(CK.LTRBRect(node.x - 5, node.y - 5, node.x + node.width + 5, node.y + node.height + 5), paint);
            } else if(node.style === 3){
                // diamond bigger
                const bigPath = new CK.Path();
                const bx = node.x + node.width / 2;
                const by = node.y + node.height / 2;
                bigPath.moveTo(bx, node.y - 5);
                bigPath.lineTo(node.x + node.width + 5, by);
                bigPath.lineTo(bx, node.y + node.height + 5);
                bigPath.lineTo(node.x - 5, by);
                bigPath.close();
                canvas.drawPath(bigPath, paint);
                bigPath.delete();
            } else {
                const rect2 = CK.RRectXY(CK.LTRBRect(node.x - 5, node.y - 5, node.x + node.width + 5, node.y + node.height + 5), node.radius + 5, node.radius + 5);
                canvas.drawRRect(rect2, paint);
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

            const builder = CK.ParagraphBuilder.Make(paragraphStyle, nodusCanvas.getFont()!);
            builder.addText(`Occupied by: ${user.nombre}`);

            const paragraph = builder.build();
            paragraph.layout(300);

            canvas.drawParagraph(paragraph, node.x + 10, node.y - 22);

            paragraph.delete();
            builder.delete();
        } else if(selectedNodesIds().includes(node.id)){

            const colorText = obtenerColorTexto(node.color);

            paint.setAlphaf(1);
            paint.setStyle(CK.PaintStyle.Stroke);
            paint.setColor(CK.parseColorString(colorText));
            paint.setStrokeWidth(4);

            if(node.style === 2){
                canvas.drawOval(CK.LTRBRect(node.x - 2, node.y - 2, node.x + node.width + 2, node.y + node.height + 2), paint);
            } else if(node.style === 3){
                const selPath = new CK.Path();
                const sx = node.x + node.width / 2;
                const sy = node.y + node.height / 2;
                selPath.moveTo(sx, node.y - 2);
                selPath.lineTo(node.x + node.width + 2, sy);
                selPath.lineTo(sx, node.y + node.height + 2);
                selPath.lineTo(node.x - 2, sy);
                selPath.close();
                canvas.drawPath(selPath, paint);
                selPath.delete();
            } else {
                const rectSel = CK.RRectXY(CK.LTRBRect(node.x - 2, node.y - 2, node.x + node.width + 2, node.y + node.height + 2), node.radius + 4, node.radius + 4);
                canvas.drawRRect(rectSel, paint);
            }
        }
    }

    paint.delete();

    drawNodeOpcionalText(CK, canvas, node);
};

export const drawNodeGrid = (CK: CanvasKit, canvas: Canvas, node: Node) => {

    /**
     * Dibujar asintotas verticales y horintales en cada lado
     * todas las lineas debe cubrir toda la pantalla para que el usuario pueda aproximar la cercania a otros elementos
     */

    
    const paint = new CK.Paint();
    paint.setColor(CK.Color(155,155,255,0.5));
    paint.setStyle(CK.PaintStyle.Stroke);
    paint.setStrokeWidth(1);

    const startX = -nodusCanvas.camera.offsetX() / nodusCanvas.camera.zoom();
    const startY = -nodusCanvas.camera.offsetY() / nodusCanvas.camera.zoom();

    const endX = startX + nodusCanvas.camera.getWordlSize().width;
    const endY = startY + nodusCanvas.camera.getWordlSize().height;
    
    // Linea Drecha (x + width)
    canvas.drawLine(node.x + node.width, startY, node.x + node.width, endY, paint);

    // Linea Izquierda (x)
    canvas.drawLine(node.x, startY, node.x, endY, paint);

    // Linea Superior (y)
    canvas.drawLine(startX, node.y, endX, node.y, paint);

    // Linea Inferior (y + height)
    canvas.drawLine(startX, node.y + node.height, endX, node.y + node.height, paint);

    paint.delete();
}

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

    const paint = new CK.Paint();

    paint.setColor(CK.Color(64, 150, 255));
    paint.setStyle(CK.PaintStyle.Stroke);

    canvas.drawRect(rect, paint);
    
    const newDots: {x:number, y:number, direction: ANCHOR_POINT}[] = [];
    anchorPoints.forEach(point => {
        paint.setColor(CK.Color(240,240,240));
        paint.setStyle(CK.PaintStyle.Fill);
        
        const absolutePointPosition = {
            x: bounds.x - MARGIN_BOX + (bounds.width + MARGIN_BOX * 2) * point.x,
            y: bounds.y - MARGIN_BOX + (bounds.height + MARGIN_BOX * 2) * point.y
        }
        const anchorRect = CK.XYWHRect(absolutePointPosition.x - 4, absolutePointPosition.y - 4, 8, 8);

        canvas.drawRect(anchorRect, paint);
        
        paint.setColor(CK.Color(7,5,5));
        paint.setStyle(CK.PaintStyle.Stroke);
        paint.setStrokeWidth(1);
        canvas.drawRect(anchorRect, paint);

        newDots.push({
            x: absolutePointPosition.x,
            y: absolutePointPosition.y,
            direction: point.direction
        });
    });

    setResizingDots(newDots);

    paint.delete();
}

export const drawConnection  = (CK: CanvasKit, canvas : Canvas, fromNode: Node, toNode: Node, conn: Connection, isExport = false) => {

    const linePaint = new CK.Paint();
    linePaint.setStyle(CK.PaintStyle.Stroke);
    linePaint.setAntiAlias(true);
    
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

    linePaint.setDither(true);

    if(selectedConnectionId() !== conn.id || isExport){

        if(conn.properties.dashed){
            path.dash(10, 5, conn.properties.noFlow ? 0 : - flowConecctions * 15);
        }

        if(conn.properties.color){
            const customColor = CK.parseColorString(conn.properties.color);
            linePaint.setColor(customColor);
        } else {
            linePaint.setShader(shader);
        }

        linePaint.setStrokeWidth(conn.properties.thickness || 4);
        linePaint.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 4, false));
        canvas.drawPath(path, linePaint);
        linePaint.setStrokeWidth(1);
        
        linePaint.setMaskFilter(null);
        canvas.drawPath(path, linePaint);

    } else {

        linePaint.setStrokeWidth(5);
        linePaint.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 5, false));
        canvas.drawPath(path, linePaint);
        linePaint.setStrokeWidth(4);
        
        linePaint.setShader(shader);
        linePaint.setMaskFilter(null);
        canvas.drawPath(path, linePaint);
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

        const textBuilder = CK.ParagraphBuilder.Make(textParagraphStyle, nodusCanvas.getFont()!);
        textBuilder.addText(conn.properties.label);

        const textParagraph = textBuilder.build();

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

        textParagraph.delete();
        textBuilder.delete();
    }

    path.delete();
    linePaint.delete();
    shader.delete();

}

export const drawBackground = () => {
    const nodus = nodusCanvas;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const CK = nodus.getCK();
    const canvas = nodus.getCanvas();
    
    const diagonal = Math.sqrt(width * width + height * height);
    const paint =  new CK.Paint();
    paint.setDither(true);

    const gradient = CK.Shader.MakeRadialGradient(
        [0, 0], diagonal, 
        [CK.Color(30, 14, 36), CK.Color(0,0,0,0)],
        [0, 1],
        CK.TileMode.Clamp
    );

    const gradient2 = CK.Shader.MakeRadialGradient(
        [width, height], diagonal, 
        [CK.Color(12, 42, 26), CK.Color(0,0,0,0)],
        [0, 1],
        CK.TileMode.Clamp
    );


    paint.setAntiAlias(true);
    
    paint.setShader(gradient);
    canvas.drawRect(CK.LTRBRect(0, 0, diagonal, diagonal), paint);
    
    paint.setShader(gradient2);
    canvas.drawRect(CK.LTRBRect(width - diagonal, height - diagonal, width, height), paint);

    gradient.delete();
    gradient2.delete();
    paint.delete();
}

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

    const builder = CK.ParagraphBuilder.Make(paragraphStyle, fontMgr);
    builder.addText(node.title || "Nuevo Nodo");

    const paragraph = builder.build();
    paragraph.layout(node.width - 20);

    canvas.drawParagraph(paragraph, node.x + 10, node.y + (node.height / 2) - paragraph.getHeight() / 2);

    paragraph.delete();
    builder.delete();
};

export const drawElasticLine = (CK: CanvasKit, canvas: Canvas, fromNode: Node, mousePos: any, startPoint?: {x:number,y:number}) => {
    const p = new CK.Path();
    const startX = startPoint ? startPoint.x : fromNode.x + fromNode.width / 2;
    const startY = startPoint ? startPoint.y : fromNode.y + fromNode.height / 2;
    
    p.moveTo(startX, startY);
    const cpOffset = (mousePos.x - startX) / 2;
    p.quadTo(startX + cpOffset, startY, mousePos.x, mousePos.y);
    
    const linePaint = new CK.Paint();
    linePaint.setColor(CK.Color(51, 156, 255, 0.5));
    linePaint.setStyle(CK.PaintStyle.Stroke);
    linePaint.setStrokeWidth(2);

    canvas.drawPath(p, linePaint);

    p.delete();
    linePaint.delete();
};

/**
 * 40 = 5
 * 20 = 10
 * 10 = 20
 * 5 = 40
 * 1 = 80
 */


export const drawGrid = (activePos : {x: number, y: number}) => {

    const scale = nodusCanvas.camera.zoom();
    const offsetX = nodusCanvas.camera.offsetX();
    const offsetY = nodusCanvas.camera.offsetY();

    const GRID_ADJUST = Math.max(Math.round(GRID_SIZE / scale), 20);

    const CK = nodusCanvas.getCK();
    const canvas = nodusCanvas.getCanvas();

    const spacing = GRID_ADJUST;
    const dotSize = 1.5 / scale;

    const startX = -offsetX / scale;
    const startY = -offsetY / scale;

    const paint = new CK.Paint()

    if(activePos){
        const shader = CK.Shader.MakeRadialGradient(
            [activePos.x, activePos.y],
            350 / scale,
            [CK.Color(180, 180, 180, 0.45), CK.TRANSPARENT],
            [0,1],
            CK.TileMode.Clamp
        );

        paint.setShader(shader);
        shader.delete();
    } else {
        return;
    }

    for(let x = startX; x < window.innerWidth / scale + startX; x += spacing){
        for(let y = startY; y < window.innerHeight / scale + startY; y += spacing){
            canvas.drawCircle(x, y, dotSize, paint);
        }
    }

    paint.delete();

}

export const drawExternalCursor = (x: number, y: number, color: string, name: string) => {

    const scale = nodusCanvas.camera.zoom();

    const CK = nodusCanvas.getCK();
    const canvas = nodusCanvas.getCanvas();

    const paint = new CK.Paint();
    paint.setAntiAlias(true);

    const path = new CK.Path();
    path.moveTo(0, 0);
    path.lineTo(15 / scale, 12 / scale);
    path.lineTo(5 / scale, 11 / scale);
    path.lineTo(0, 20 / scale);
    path.close();

    canvas.save();
    canvas.translate(x, y);
    
    paint.setStyle(CK.PaintStyle.Stroke);
    paint.setStrokeWidth(2 / scale);
    paint.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 1, false));
    paint.setColor(CK.Color(255,255,255,0.6));
    canvas.drawPath(path, paint);

    paint.setColor(CK.parseColorString(color));
    paint.setStyle(CK.PaintStyle.Fill);
    paint.setMaskFilter(null);
    canvas.drawPath(path, paint);

    const textStyle = new CK.TextStyle({
        color: CK.WHITE,
        fontSize: 14 / scale,
        fontFamilies: ['Inter 28pt Mudium']        
    });

    const paragraphStyle = new CK.ParagraphStyle({
        textStyle: textStyle,
        textAlign: CK.TextAlign.Left,
    });

    const builder = CK.ParagraphBuilder.Make(paragraphStyle, nodusCanvas.getFont()!);
    builder.addText(name);

    const paragraph = builder.build();
    paragraph.layout(300 / scale);

    canvas.drawParagraph(paragraph, 12 /scale, 20 / scale);

    paragraph.delete();
    builder.delete();
    paint.delete();
    path.delete();

    canvas.restore();
};

export const drawPings = () => {

    const scale = nodusCanvas.camera.zoom();

    const now = Date.now();
    const CK = nodusCanvas.getCK();
    const paint = new CK.Paint();
    paint.setStyle(CK.PaintStyle.Stroke);
    paint.setStrokeWidth(2 / scale);

    pings.forEach(ping => {

        const elapsed = now - ping.startTime;
        const progess = elapsed / 1500;

        const radius = progess * 60 / scale;
        const opacity = 1 - progess;


        paint.setColor(CK.parseColorString(ping.color));
        paint.setAlphaf(opacity);

        const canvas = nodusCanvas.getCanvas();

        canvas.drawCircle(ping.x, ping.y, radius, paint);
        if(progess < 0.8 ){
            canvas.drawCircle(ping.x, ping.y, radius * 0.6, paint);
        }

        paint.setStyle(CK.PaintStyle.Fill);
        canvas.drawCircle(ping.x, ping.y, (4 / scale) * (1 - progess), paint);
        paint.setStyle(CK.PaintStyle.Stroke);

    });
    paint.delete();
}

export const exportDiagramAsPng = async () => {
    const toastId = showToast("Preparing for export...", ToastType.PROCESSING);

    const bounds = calculateDiagramBounds(nodes);

    const CK = nodusCanvas.getCK();

    const sufrace = CK.MakeSurface(bounds.width, bounds.height);
    if(!sufrace){
        removeToast(toastId);
        showToast("Error creating rendering surface", ToastType.ERROR);
        return;
    }

    const canvas = sufrace.getCanvas();

    canvas.clear(CK.TRANSPARENT);

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
        filters: [{
            name: 'Image',
            extensions: ['png']
        }],
        defaultPath: 'nodus_flow_diagram.png'
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
}

export const drawSelectionRect = () => {
    const CK = nodusCanvas.getCK();
    const canvas = nodusCanvas.getCanvas();
    const rect = CK.RRectXY(CK.LTRBRect(selectionRect.x0, selectionRect.y0, selectionRect.x1, selectionRect.y1), 0,0);

    const paint = new CK.Paint();
    paint.setColor(CK.Color(64,150,255, 0.3));
    canvas.drawRRect(rect, paint);

    paint.setStyle(CK.PaintStyle.Stroke);
    paint.setStrokeWidth(1);
    paint.setColor(CK.Color(64,150,255,0.8));
    canvas.drawRRect(rect, paint);

    paint.delete();
}

export const drawConnectionPoint = (CK: CanvasKit, canvas: Canvas, point: {x: number, y: number}, color: string = "#ffffff") => {
    const paint = new CK.Paint();
    paint.setColor(CK.parseColorString(color));
    paint.setStyle(CK.PaintStyle.Fill);
    canvas.drawCircle(point.x, point.y, 5, paint);

    paint.setStyle(CK.PaintStyle.Stroke);
    paint.setColor(CK.parseColorString("#000000"));
    paint.setStrokeWidth(1);
    canvas.drawCircle(point.x, point.y, 5, paint);

    paint.delete();
}