import { Canvas, CanvasKit, FontMgr } from "canvaskit-wasm";
import { Node, updateNodeSize } from "../models/nodes";
import { selectedNodeId } from "../models/nodes"; 
import { NodeToNode } from "../utils/path";
import { HexToColor } from "../utils/color";
import { obtenerColorTexto } from "../utils/color";
import { GRID_SIZE } from "../utils/math";
import { flowConecctions, offsetX, offsetY, scale } from "../views/Editor/Editor";
import { nodusCanvas } from "../core/NodusCanvas";

export const drawNode = (CK: CanvasKit, canvas: Canvas, node: Node) => {

    const color = HexToColor(node.color);
    const paint = new CK.Paint();

    paint.setColor(CK.Color(color[0], color[1], color[2], node.opacity));
    paint.setAntiAlias(true);

    const rect = CK.RRectXY(CK.LTRBRect(node.x, node.y, node.x + node.width, node.y + node.height), node.radius, node.radius);
    
    if(selectedNodeId() === node.id) {
        const shader = CK.Shader.MakeLinearGradient([node.x - 5, node.y - 5], [node.x + node.width + 5, 5 + node.height + node.y], 
            [CK.Color(color[1], color[2], color[0] - color[2]), CK.Color(color[1] - color[2], color[0], color[0] + color[1])],
            null,
            CK.TileMode.Decal
        );
        paint.setShader(shader);
        const rect2 = CK.RRectXY(CK.LTRBRect(node.x - 5, node.y - 5, node.x + node.width + 5, node.y + node.height + 5), node.radius + 5, node.radius + 5);
        canvas.drawRRect(rect2, paint);
        paint.setShader(null);
    }
    
    canvas.drawRRect(rect, paint);
}

export const drawConnection  = (CK: CanvasKit, canvas : Canvas, fromNode: Node, toNode: Node, tipo : number) => {

    const linePaint = new CK.Paint();
    linePaint.setStyle(CK.PaintStyle.Stroke);
    linePaint.setAntiAlias(true);
    
    linePaint.setColor(CK.Color(123, 220, 230, 0.8)); 
    
    const fromColor = CK.Color(HexToColor(fromNode.color)[0], HexToColor(fromNode.color)[1], HexToColor(fromNode.color)[2]);
    const toColor = CK.Color(HexToColor(toNode.color)[0], HexToColor(toNode.color)[1], HexToColor(toNode.color)[2]);

    const path = NodeToNode(CK, fromNode, toNode, tipo);
    
    const shader = CK.Shader.MakeLinearGradient(
        [fromNode.x + fromNode.width / 2, fromNode.y + fromNode.height / 2],
        [toNode.x + toNode.width / 2, toNode.y + toNode.height / 2],
        [fromColor, toColor, fromColor],
        [2 * flowConecctions - 1, 2 * flowConecctions - 0.5, 2 * flowConecctions],
        CK.TileMode.Clamp
    );

    linePaint.setShader(shader);
    linePaint.setDither(true);

    linePaint.setStrokeWidth(4);
    linePaint.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 4, false));
    canvas.drawPath(path, linePaint);
    
    linePaint.setStrokeWidth(1);
    linePaint.setMaskFilter(null);
    canvas.drawPath(path, linePaint);

    // Limpieza
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
        [CK.Color(2, 7, 10), CK.Color(8, 32, 30)],
        [0, 1],
        CK.TileMode.Clamp
    );


    paint.setShader(gradient);
    paint.setAntiAlias(true);
    canvas.drawRect(CK.LTRBRect(0, 0, width, height), paint);
    paint.setShader(null);
    gradient.delete();
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
    paragraph.layout(node.width - 20); // El texto se ajusta al ancho del nodo

    updateNodeSize(node.id, node.width, paragraph.getHeight() + 20);

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