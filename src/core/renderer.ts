import { Canvas, CanvasKit, FontMgr } from "canvaskit-wasm";
import { Node } from "../models/nodes";
import { selectedNodeId } from "../models/nodes"; 
import { NodeToNode } from "../utils/path";
import { HexToColor } from "../utils/color";
import { obtenerColorTexto } from "../utils/color";
import { GRID_SIZE } from "../utils/math";
import { flowConecctions, offsetX, offsetY, scale } from "../views/Editor/Editor";
import { nodusCanvas } from "../core/NodusCanvas";
import { selectedConnectionId } from "../models/connections";

export const drawNode = (CK: CanvasKit, canvas: Canvas, node: Node) => {

    const color = HexToColor(node.color);
    const paint = new CK.Paint();

    paint.setColor(CK.Color(color[0], color[1], color[2], node.opacity));
    paint.setAntiAlias(true);

    const rect = CK.RRectXY(CK.LTRBRect(node.x, node.y, node.x + node.width, node.y + node.height), node.radius, node.radius);

    canvas.drawRRect(rect, paint);
    
    if(selectedNodeId() === node.id) {
        paint.setAlphaf(1);
        paint.setStyle(CK.PaintStyle.Stroke);
        paint.setStrokeWidth(5);
        const shader = CK.Shader.MakeLinearGradient([node.x - 5, node.y - 5], [node.x + node.width + 5, 5 + node.height + node.y], 
            [CK.Color(color[1], color[2], color[0] - color[2]), CK.Color(color[1] - color[2], color[0], color[0] + color[1])],
            null,
            CK.TileMode.Decal
        );
        paint.setShader(shader);
        const rect2 = CK.RRectXY(CK.LTRBRect(node.x, node.y, node.x + node.width, node.y + node.height), node.radius + 5, node.radius + 5);
        canvas.drawRRect(rect2, paint);
        paint.setShader(null);
    }
    
}

export const drawConnection  = (CK: CanvasKit, canvas : Canvas, fromNode: Node, toNode: Node, id: string) => {

    const linePaint = new CK.Paint();
    linePaint.setStyle(CK.PaintStyle.Stroke);
    linePaint.setAntiAlias(true);
    
    linePaint.setColor(CK.Color(255,255,255)); 
    
    const fromColor = CK.Color(HexToColor(fromNode.color)[0], HexToColor(fromNode.color)[1], HexToColor(fromNode.color)[2]);
    const toColor = CK.Color(HexToColor(toNode.color)[0], HexToColor(toNode.color)[1], HexToColor(toNode.color)[2]);

    const path = NodeToNode(CK, fromNode, toNode);

    const shader = CK.Shader.MakeLinearGradient(
        [fromNode.x + fromNode.width / 2, fromNode.y + fromNode.height / 2],
        [toNode.x + toNode.width / 2, toNode.y + toNode.height / 2],
        [fromColor, toColor, fromColor],
        [2 * flowConecctions - 1, 2 * flowConecctions - 0.5, 2 * flowConecctions],
        CK.TileMode.Clamp
    );

    linePaint.setDither(true);

    if(selectedConnectionId() !== id){
        path.dash(10, 5, - flowConecctions * 15);

        linePaint.setShader(shader);
        linePaint.setStrokeWidth(4);
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

    path.delete();
    linePaint.delete();
    shader.delete();

}

export const drawBackground = () => {
    const dpr = window.devicePixelRatio || 1;
    const nodus = nodusCanvas;
    const width = window.innerWidth * dpr;
    const height = window.innerHeight * dpr;
    const CK = nodus.getCK();
    const canvas = nodus.getCanvas();
    
    const diagonal = Math.sqrt(width * width + height * height);
    const paint =  new CK.Paint();
    paint.setDither(true);

    const gradient = CK.Shader.MakeRadialGradient(
        [0, 0], diagonal, 
        [CK.Color(15, 12, 26), CK.Color(0,0,0,0)],
        [0, 1],
        CK.TileMode.Clamp
    );

    const gradient2 = CK.Shader.MakeRadialGradient(
        [width, height], diagonal, 
        [CK.Color(8, 28, 30), CK.Color(0,0,0,0)],
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

    const color = HexToColor(obtenerColorTexto(node.color))

    const textStyle = new CK.TextStyle({
        color: CK.Color(color[0], color[1], color[2]),
        fontSize: 15,
        fontFamilies: ['Inter 28pt Mudium']
    });

    const paragraphStyle = new CK.ParagraphStyle({
        textStyle: textStyle,
        textAlign: CK.TextAlign.Center,
    });

    const builder = CK.ParagraphBuilder.Make(paragraphStyle, fontMgr);
    builder.addText(node.title || "Nuevo Nodo");

    const paragraph = builder.build();
    paragraph.layout(node.width - 20);

    canvas.drawParagraph(paragraph, node.x + 7, node.y + (node.height / 2) - paragraph.getHeight() / 2);

    paragraph.delete();
    builder.delete();
};

export const drawElasticLine = (CK: CanvasKit, canvas: Canvas, fromNode: Node, mousePos: any) => {
    const p = new CK.Path();
    const startX = fromNode.x + fromNode.width / 2;
    const startY = fromNode.y + fromNode.height / 2;
    
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

export const drawGrid = (activePos : {x: number, y: number}) => {

    if(scale < 0.7) return;

    const CK = nodusCanvas.getCK();
    const canvas = nodusCanvas.getCanvas();

    const spacing = GRID_SIZE * scale;
    const dotSize = 1.5 * scale;

    const startX = -offsetX;
    const startY = -offsetY;

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